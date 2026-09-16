-- Políticas de acesso aos arquivos de marca e peças, restritas à empresa do usuário
CREATE POLICY "Usuário lê arquivos da sua empresa"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('brand-assets','content-media')
  AND public.owns_company((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Usuário envia arquivos da sua empresa"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('brand-assets','content-media')
  AND public.owns_company((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Usuário atualiza arquivos da sua empresa"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('brand-assets','content-media')
  AND public.owns_company((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Usuário remove arquivos da sua empresa"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('brand-assets','content-media')
  AND public.owns_company((storage.foldername(name))[1]::uuid)
);