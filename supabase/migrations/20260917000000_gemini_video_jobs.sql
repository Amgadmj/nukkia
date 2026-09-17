-- Schema for the Veo async video-render job (content engine now has a real
-- video provider wired in — see docs/CONTENT_ENGINE.md). Veo generation is a
-- long-running operation (minutes), so it can't complete inside the single
-- request that kicks it off: this tracks the operation name while pending
-- and the storage path once rendered, polled by GET /api/video-status.

ALTER TABLE public.content_items
  ADD COLUMN video_operation text,
  ADD COLUMN video_path text,
  ADD COLUMN video_error text;

ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_video_error_len
    CHECK (video_error IS NULL OR char_length(video_error) <= 500);
