-- P0 fixes from the 2026-09-16 engineering review (docs/ENGINEERING_PLAN.md).
-- Additive only — does not touch the three migrations already applied to prod.

-- ---------------------------------------------------------------------------
-- 1. brand_kits had no UNIQUE(company_id) but the app upserts on that column.
--    Every such upsert fails (ON CONFLICT target does not exist), which is
--    why the brand/identity step could never be saved. Defensively dedupe
--    first (keep the most recently updated row per company) in case any rows
--    were created another way, then add the constraint the app relies on.
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY company_id ORDER BY updated_at DESC, created_at DESC
  ) AS rn
  FROM public.brand_kits
)
DELETE FROM public.brand_kits WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE public.brand_kits
  ADD CONSTRAINT brand_kits_company_id_key UNIQUE (company_id);

-- ---------------------------------------------------------------------------
-- 2. Status/format columns were free text and already disagreed with what
--    the app writes ('pending' default vs 'todo' from the API). Pin down the
--    real value sets with CHECK constraints. App code is updated in the same
--    change set to only ever write 'pending'/'done'.
-- ---------------------------------------------------------------------------
ALTER TABLE public.missions
  ADD CONSTRAINT missions_status_check CHECK (status IN ('pending', 'done'));

ALTER TABLE public.diagnostics
  ADD CONSTRAINT diagnostics_status_check CHECK (status IN ('draft', 'ready'));

ALTER TABLE public.content_plans
  ADD CONSTRAINT content_plans_status_check CHECK (status IN ('draft', 'active', 'archived'));

ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_status_check
    CHECK (status IN ('draft', 'approved', 'scheduled', 'published', 'failed')),
  ADD CONSTRAINT content_items_format_check
    CHECK (format IN ('post', 'carrossel', 'reels', 'stories', 'artigo', 'arte'));

ALTER TABLE public.social_accounts
  ADD CONSTRAINT social_accounts_status_check
    CHECK (status IN ('connected', 'disconnected', 'error', 'pending'));

ALTER TABLE public.scheduled_posts
  ADD CONSTRAINT scheduled_posts_status_check
    CHECK (status IN ('scheduled', 'publishing', 'published', 'failed', 'canceled'));

-- ---------------------------------------------------------------------------
-- 3. Length caps on user-writable fields that flow straight into AI prompts
--    (content_items.title/pillar via /api/arte, brand_kits.tone via /api/plano)
--    or are otherwise unbounded free text. Closes the "10 KB prompt in a
--    title column" cost/abuse vector flagged in the security review (AI-2).
-- ---------------------------------------------------------------------------
ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_title_len CHECK (char_length(title) <= 200),
  ADD CONSTRAINT content_items_pillar_len CHECK (pillar IS NULL OR char_length(pillar) <= 120),
  ADD CONSTRAINT content_items_caption_len CHECK (caption IS NULL OR char_length(caption) <= 2200),
  ADD CONSTRAINT content_items_hashtags_len CHECK (hashtags IS NULL OR char_length(hashtags) <= 500),
  ADD CONSTRAINT content_items_cta_len CHECK (cta IS NULL OR char_length(cta) <= 200);

ALTER TABLE public.brand_kits
  ADD CONSTRAINT brand_kits_tone_len CHECK (tone IS NULL OR char_length(tone) <= 200);

ALTER TABLE public.companies
  ADD CONSTRAINT companies_name_len CHECK (char_length(name) <= 200),
  ADD CONSTRAINT companies_segment_len CHECK (segment IS NULL OR char_length(segment) <= 200);

-- ---------------------------------------------------------------------------
-- 4. Missing indexes on company_id FKs, plus the two composite indexes the
--    future calendar/cron views need.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS diagnostics_company_id_idx ON public.diagnostics (company_id);
CREATE INDEX IF NOT EXISTS missions_company_id_idx ON public.missions (company_id);
CREATE INDEX IF NOT EXISTS content_items_company_id_idx ON public.content_items (company_id);
CREATE INDEX IF NOT EXISTS content_items_plan_id_idx ON public.content_items (plan_id);
CREATE INDEX IF NOT EXISTS content_items_calendar_idx
  ON public.content_items (company_id, scheduled_for);
CREATE INDEX IF NOT EXISTS scheduled_posts_company_id_idx ON public.scheduled_posts (company_id);
CREATE INDEX IF NOT EXISTS scheduled_posts_content_item_id_idx
  ON public.scheduled_posts (content_item_id);
CREATE INDEX IF NOT EXISTS scheduled_posts_due_idx
  ON public.scheduled_posts (status, scheduled_for);

-- ---------------------------------------------------------------------------
-- 5. updated_at triggers were missing on missions (no column at all) and
--    user_progress (column existed, no trigger).
-- ---------------------------------------------------------------------------
ALTER TABLE public.missions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER missions_updated BEFORE UPDATE ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER user_progress_updated BEFORE UPDATE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 6. Storage buckets were never created in a migration, so a fresh project
--    can't reproduce the schema the storage policies (migration 3) assume.
--    Private, size-capped, image-only.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('brand-assets', 'brand-assets', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('content-media', 'content-media', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. The storage RLS policies cast the first path segment straight to uuid
--    ((storage.foldername(name))[1]::uuid), which raises an error instead of
--    denying access when that segment isn't a UUID. Replace the four
--    policies with a guarded helper.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.owns_company_folder(_folder text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _folder ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN public.owns_company(_folder::uuid)
    ELSE false
  END
$$;
REVOKE ALL ON FUNCTION public.owns_company_folder(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_company_folder(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Usuário lê arquivos da sua empresa" ON storage.objects;
DROP POLICY IF EXISTS "Usuário envia arquivos da sua empresa" ON storage.objects;
DROP POLICY IF EXISTS "Usuário atualiza arquivos da sua empresa" ON storage.objects;
DROP POLICY IF EXISTS "Usuário remove arquivos da sua empresa" ON storage.objects;

CREATE POLICY "Usuário lê arquivos da sua empresa"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('brand-assets', 'content-media')
  AND public.owns_company_folder((storage.foldername(name))[1]));

CREATE POLICY "Usuário envia arquivos da sua empresa"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('brand-assets', 'content-media')
  AND public.owns_company_folder((storage.foldername(name))[1]));

CREATE POLICY "Usuário atualiza arquivos da sua empresa"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('brand-assets', 'content-media')
  AND public.owns_company_folder((storage.foldername(name))[1]));

CREATE POLICY "Usuário remove arquivos da sua empresa"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('brand-assets', 'content-media')
  AND public.owns_company_folder((storage.foldername(name))[1]));

-- ---------------------------------------------------------------------------
-- 8. Composite FKs so scheduled_posts/content_items can only ever reference
--    a row that belongs to the SAME company (A-4 in the security review).
--    Nullable FK columns are unaffected (NULL always satisfies a composite
--    FK), so this is purely additive safety, not a behavior change today.
-- ---------------------------------------------------------------------------
ALTER TABLE public.content_plans
  ADD CONSTRAINT content_plans_id_company_key UNIQUE (id, company_id);
ALTER TABLE public.content_items
  DROP CONSTRAINT content_items_plan_id_fkey,
  ADD CONSTRAINT content_items_plan_id_fkey
    FOREIGN KEY (plan_id, company_id) REFERENCES public.content_plans (id, company_id)
    ON DELETE CASCADE;

ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_id_company_key UNIQUE (id, company_id);
ALTER TABLE public.scheduled_posts
  DROP CONSTRAINT scheduled_posts_content_item_id_fkey,
  ADD CONSTRAINT scheduled_posts_content_item_id_fkey
    FOREIGN KEY (content_item_id, company_id) REFERENCES public.content_items (id, company_id)
    ON DELETE CASCADE;

-- Note: a UNIQUE(owner_id) on companies (one company per account) was
-- considered and deliberately NOT added here. The double-submit race it
-- would guard against is already closed client-side (the submit button is
-- disabled while the insert is in flight), and forcing uniqueness via
-- migration on a live table risks cascade-deleting real child data (a
-- diagnostic, brand kit, or content plan) attached to whichever duplicate
-- row loses. If real duplicates are ever found in prod, merge them by hand
-- first, then add the constraint in a follow-up migration.
