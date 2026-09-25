-- Prepared locally only; activation requires a separate migration deployment.
BEGIN;

CREATE TABLE public.marketing_workspaces (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  revision uuid NOT NULL DEFAULT gen_random_uuid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.marketing_workspaces FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketing_workspaces TO authenticated;
ALTER TABLE public.marketing_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing workspaces owner select" ON public.marketing_workspaces
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.owner_id = auth.uid())
  );
CREATE POLICY "marketing workspaces owner insert" ON public.marketing_workspaces
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.owner_id = auth.uid())
  );
CREATE POLICY "marketing workspaces owner update" ON public.marketing_workspaces
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.owner_id = auth.uid())
  );

CREATE TRIGGER marketing_workspaces_updated BEFORE UPDATE ON public.marketing_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
