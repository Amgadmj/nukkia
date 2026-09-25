-- Prepared locally only. Requires separate, explicit activation; this file
-- must not be applied automatically. Existing kit/diagnostic rows are untouched.
BEGIN;

CREATE TABLE public.brand_stories (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  manifesto text NOT NULL CHECK (char_length(manifesto) <= 4000 AND btrim(manifesto) <> ''),
  mission text NOT NULL CHECK (char_length(mission) <= 1000 AND btrim(mission) <> ''),
  vision text NOT NULL CHECK (char_length(vision) <= 1000 AND btrim(vision) <> ''),
  "values" text[] NOT NULL CHECK (
    cardinality("values") BETWEEN 1 AND 8
    AND array_ndims("values") = 1
    AND array_position("values", NULL) IS NULL
    AND array_position("values", '') IS NULL
    AND char_length(array_to_string("values", '')) <= 2400
  ),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.brand_stories FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.brand_stories TO authenticated;
GRANT ALL ON public.brand_stories TO service_role;
ALTER TABLE public.brand_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand stories read by company" ON public.brand_stories
  FOR SELECT TO authenticated USING (public.owns_company(company_id));
CREATE POLICY "brand stories insert by company" ON public.brand_stories
  FOR INSERT TO authenticated WITH CHECK (public.owns_company(company_id));
CREATE POLICY "brand stories update by company" ON public.brand_stories
  FOR UPDATE TO authenticated USING (public.owns_company(company_id))
  WITH CHECK (public.owns_company(company_id));
CREATE TRIGGER brand_stories_updated BEFORE UPDATE ON public.brand_stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
