-- uploadGeneratedVideo (src/lib/content-engine) stores Veo renders as video/mp4
-- in content-media, but the bucket only accepted images, so every video upload
-- was rejected. Allow MP4 and raise the size cap to fit an 8s 720p render.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'video/mp4'],
    file_size_limit = 52428800
WHERE id = 'content-media';
