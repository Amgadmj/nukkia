-- P1 security/cost hardening + schema for the two new capabilities
-- (AI onboarding auto-fill, generalized content engine) + LGPD consent
-- capture. See docs/ENGINEERING_PLAN.md. Additive only.

-- ---------------------------------------------------------------------------
-- 1. Social OAuth tokens were plain text in a table `authenticated` could
--    SELECT/UPDATE directly via the REST API (R-1, High). Split them into a
--    server-only table with no client grants at all — only service_role
--    (the future connect/publish job) can ever touch them. `redes.tsx` only
--    ever selected provider/username/status, so this is not a behavior
--    change for anything shipped today.
-- ---------------------------------------------------------------------------
ALTER TABLE public.social_accounts
  DROP COLUMN access_token,
  DROP COLUMN refresh_token,
  DROP COLUMN token_expires_at;

CREATE TABLE public.social_account_secrets (
  social_account_id uuid PRIMARY KEY REFERENCES public.social_accounts (id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_account_secrets ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.social_account_secrets TO service_role;
-- No GRANT to authenticated/anon on purpose: RLS with zero policies already
-- denies them, the missing GRANT is the defense-in-depth second layer.
CREATE TRIGGER social_account_secrets_updated BEFORE UPDATE ON public.social_account_secrets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 2. Fields that must never be client-writable because they're either scored
--    trust data (XP, level, diagnostic score/report) or would need to be
--    forgeable to be worth forging (metrics). The app never actually
--    performs these client-side writes after this change set (missions
--    complete via the RPC below; user_progress is seeded by trigger;
--    diagnostics/metrics are never updated in place) — this is closing a
--    hole, not removing used functionality.
-- ---------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON public.missions FROM authenticated;
REVOKE INSERT, UPDATE ON public.user_progress FROM authenticated;
REVOKE UPDATE, DELETE ON public.diagnostics FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.metrics_snapshots FROM authenticated;

-- ---------------------------------------------------------------------------
-- 3. user_progress is now created automatically when a company is created,
--    instead of via a client-side upsert-in-render (painel.tsx) that no
--    longer has the grant to run anyway.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_progress (company_id) VALUES (NEW.id) ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_company() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_company_created AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.handle_new_company();

-- ---------------------------------------------------------------------------
-- 4. Mission completion and XP/level are now computed server-side, in one
--    atomic, idempotent call, instead of the client reading cached XP,
--    adding to it, and upserting the result (C13 — loses XP on quick double
--    completion; also let any signed-in user set their own XP directly).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_mission(_mission_id uuid)
RETURNS TABLE(new_xp integer, new_level integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _company_id uuid;
  _mission_xp integer;
  _status text;
BEGIN
  SELECT m.company_id, m.xp, m.status INTO _company_id, _mission_xp, _status
  FROM public.missions m WHERE m.id = _mission_id;

  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Missão não encontrada';
  END IF;
  IF NOT public.owns_company(_company_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF _status <> 'done' THEN
    UPDATE public.missions SET status = 'done', completed_at = now() WHERE id = _mission_id;
    UPDATE public.user_progress up
    SET xp = up.xp + _mission_xp,
        level = GREATEST(1, floor((up.xp + _mission_xp) / 500.0)::integer + 1)
    WHERE up.company_id = _company_id;
  END IF;

  RETURN QUERY SELECT up.xp, up.level FROM public.user_progress up WHERE up.company_id = _company_id;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_mission(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. AI usage ledger + atomic check-and-record function. Limits are passed
--    in by the calling code (src/lib/quota.server.ts), not hardcoded here,
--    so they can be tuned per plan tier without a migration.
-- ---------------------------------------------------------------------------
CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (char_length(kind) <= 40),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_lookup_idx ON public.ai_usage (company_id, kind, created_at);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai usage by company" ON public.ai_usage FOR SELECT TO authenticated
USING (public.owns_company(company_id));

CREATE OR REPLACE FUNCTION public.check_and_record_ai_usage(
  _company_id uuid, _kind text, _daily_limit integer, _monthly_limit integer
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _daily_count integer;
  _monthly_count integer;
BEGIN
  IF NOT public.owns_company(_company_id) THEN
    RETURN false;
  END IF;

  -- Serialize concurrent calls for the same company so two requests racing
  -- inside the same window can't both slip under the limit.
  PERFORM pg_advisory_xact_lock(hashtextextended(_company_id::text, 0));

  SELECT count(*) INTO _daily_count FROM public.ai_usage
  WHERE company_id = _company_id AND kind = _kind AND created_at > now() - interval '1 day';
  SELECT count(*) INTO _monthly_count FROM public.ai_usage
  WHERE company_id = _company_id AND kind = _kind AND created_at > now() - interval '30 days';

  IF _daily_count >= _daily_limit OR _monthly_count >= _monthly_limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_usage (company_id, kind) VALUES (_company_id, _kind);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.check_and_record_ai_usage(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_record_ai_usage(uuid, text, integer, integer)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. AI onboarding auto-fill (new capability 1): raw AI draft + per-field
--    confidence/origin, capped so a pathological response can't bloat the row.
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies ADD COLUMN research jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_research_size CHECK (octet_length(research::text) <= 20000);

-- ---------------------------------------------------------------------------
-- 7. Generalized content engine (new capability 2): carousels store their
--    slide image URLs, video-format items store a text storyboard now and a
--    render URL once a video provider is configured.
-- ---------------------------------------------------------------------------
-- `image_path`/slide paths are STORAGE PATHS, not URLs — the previous design
-- (arte.ts) saved a signed URL with a 1-year expiry straight into the row
-- (R-4/B-2 in the security review: unrevocable, breaks after a year). The
-- client re-signs a short-lived URL on read from the path instead (it has
-- SELECT via the storage RLS policy, so it can do this without the service
-- role). `image_url` is kept, now populated with a much shorter-lived
-- (7-day) convenience URL alongside the path — a bounded interim fix, not
-- the full move to sign-on-every-read (tracked in docs/ENGINEERING_PLAN.md).
ALTER TABLE public.content_items
  ADD COLUMN image_path text,
  ADD COLUMN slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN storyboard jsonb,
  ADD COLUMN video_url text;
ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_slides_size CHECK (octet_length(slides::text) <= 20000),
  ADD CONSTRAINT content_items_storyboard_size
    CHECK (storyboard IS NULL OR octet_length(storyboard::text) <= 20000);

-- ---------------------------------------------------------------------------
-- 8. LGPD: record consent version + timestamp at signup. Populated by
--    handle_new_user from auth signup metadata (src/routes/auth.tsx sends
--    consent_version), so it works even when email confirmation delays the
--    first session.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN consent_version text,
  ADD COLUMN consent_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, consent_version, consent_accepted_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'consent_version',
    CASE WHEN NEW.raw_user_meta_data ->> 'consent_version' IS NOT NULL THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;
