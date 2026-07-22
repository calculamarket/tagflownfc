-- Storage bucket for user-uploaded tag assets (logo, cover image, PDF).
-- Public read: these files are served on public landing pages / PDF tags.
-- Writes are restricted to each user's own top-level folder (<user_id>/...),
-- which is what keeps one user from overwriting another's files.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tag-assets',
  'tag-assets',
  true,
  10485760, -- 10 MB
  ARRAY[
    'image/png','image/jpeg','image/jpg','image/webp','image/gif','image/svg+xml',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read tag assets" ON storage.objects;
CREATE POLICY "Public read tag assets" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'tag-assets');

DROP POLICY IF EXISTS "Users upload own tag assets" ON storage.objects;
CREATE POLICY "Users upload own tag assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tag-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own tag assets" ON storage.objects;
CREATE POLICY "Users update own tag assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tag-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own tag assets" ON storage.objects;
CREATE POLICY "Users delete own tag assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tag-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
