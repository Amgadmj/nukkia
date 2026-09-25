-- LOCAL PREPARATION ONLY: apply through the normal reviewed migration workflow
-- to activate cross-device drafts. The application falls back locally until then.
-- Dedicated storage: never add draft rows to diagnostics (latest-report queries).
CREATE TABLE public.onboarding_drafts (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- NULL is a completion tombstone. It retains no answers and prevents stale
  -- devices from silently recreating an old draft after successful diagnosis.
  draft jsonb,
  revision uuid NOT NULL DEFAULT gen_random_uuid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_drafts_shape CHECK (
    draft IS NULL OR (
      jsonb_typeof(draft) = 'object'
      AND draft @> '{"version": 1}'::jsonb
      AND jsonb_typeof(draft -> 'answers') = 'object'
      AND draft -> 'step' IN ('0'::jsonb, '1'::jsonb, '2'::jsonb, '3'::jsonb, '4'::jsonb)
      AND octet_length(draft::text) <= 131072
    ) IS TRUE
  )
);
CREATE INDEX onboarding_drafts_owner_idx ON public.onboarding_drafts(owner_id);
ALTER TABLE public.onboarding_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onboarding_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.onboarding_drafts TO authenticated;
GRANT ALL ON public.onboarding_drafts TO service_role;

-- Deliberately stricter than owns_company(), which also permits admins.
CREATE POLICY "onboarding drafts owner only" ON public.onboarding_drafts
FOR ALL TO authenticated
USING (
  owner_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_id AND c.owner_id = auth.uid()
  )
)
WITH CHECK (
  owner_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_id AND c.owner_id = auth.uid()
  )
);

-- Bump revisions even for writes made outside this API, preserving CAS semantics.
CREATE FUNCTION public.onboarding_draft_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.revision = gen_random_uuid();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER onboarding_drafts_revision BEFORE UPDATE ON public.onboarding_drafts
FOR EACH ROW EXECUTE FUNCTION public.onboarding_draft_revision();
