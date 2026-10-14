# Content Engine

`src/lib/content-engine/` generalizes two production patterns this org has
already proven — AgrosTech's brand-anchored carousel pipeline, and the
Higgsfield/Nano-Banana/Seedance generation workflow's use of a persistent
style/character reference to keep a series visually consistent — into a
format any SME's brand kit can drive through Nukkia, not just AgrosTech.

## What exists today

| Format                    | Function                                  | Output                                                                       |
| ------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| `post`/`stories`/`artigo` | `generateStaticArt`                       | one image, brand-anchored                                                    |
| `carrossel`               | `generateCarousel`                        | 4–6 slide images (cover → body → CTA)                                        |
| `reels`                   | `generateVideoStoryboard` + `renderVideo` | a script/shot-list always; a rendered video only if a provider is configured |

All three call the same `buildStyleAnchor()` first — a text description of
the company's palette, tone and segment, prepended to every prompt so a
carousel's 5 slides (or a static post next to it) read as one brand instead
of five independent AI calls that happen to share a topic.

## The video seam, explicitly

`renderVideo()` in `index.ts` is a deliberate stub: if `VIDEO_PROVIDER` is
unset (the default), it returns `{ status: "awaiting_provider" }` and the
storyboard is still saved — nothing generated is lost, and someone can
produce the video by hand from the stored script today. **No provider is
wired in.** This was a real decision made without asking mid-task (see
`docs/ENGINEERING_PLAN.md`, "New capability 2"): plugging in an actual video
provider (Higgsfield's API or similar) needs an API key and a cost decision
that's the user's call, not something to fabricate a fake integration for.

To wire one in: set `VIDEO_PROVIDER`/`VIDEO_PROVIDER_API_KEY` in `.env`
(see `.env.example`), then fill in the branch in `renderVideo()` with the
real API call. The function signature (`Storyboard in, VideoRenderResult
out`) is already the seam — nothing else in the codebase needs to change.

## Where images live

Every generated image is uploaded to the private `content-media` bucket and
the **storage path** is what gets persisted (`content_items.image_path`,
each carousel slide's `path`). A signed URL is also generated for immediate
display, but capped at 7 days — the original design saved a 1-year signed
URL straight into the row, which can't be revoked and silently breaks a
year later. The 7-day cap is a bounded interim fix; the full fix (the client
re-signing from the stored path whenever it renders an image, with no
expiry-driven breakage at all) needs a small UI change tracked in
`docs/ENGINEERING_PLAN.md`.

## Cost control

Every entry point (`/api/arte`) checks `checkAiQuota()` before calling any
model, once per request regardless of how many images that format produces
internally (a 6-slide carousel is one quota unit, not six) — see
`src/lib/quota.server.ts` for the actual per-format caps.

## Video provider: Higgsfield (opt-in)

`VIDEO_PROVIDER=higgsfield` routes reels rendering through
`src/lib/higgsfield.server.ts` (Seedance 2.0 text-to-video, public API). Veo stays the default.

- **One generation per reel.** Seedance renders 4 to 15 s per request, so the storyboard's
  blocks are scaled onto one 15 s clip as timed, hard-cut segments.
- **Cost guard.** `planVideoRender` estimates credits (draft 3, standard 4.5, premium 9 credits
  per second) and refuses a plan above `HIGGSFIELD_MAX_CREDITS_PER_RENDER` (default 70) before
  any request is made. The per-company `video_render` quota still applies.
- **Safe retries.** Each render sends an `Idempotency-Key` that is reused across the transient
  retries inside that call, so a timeout after acceptance cannot create or charge a second job.
- **Operation id.** Stored as `higgsfield:<request_id>` in `content_items.video_operation`;
  `checkVideoRender` dispatches on that prefix, so Veo jobs already in flight keep working.
- **Storage.** The output URL expires after at least 7 days, so the mp4 is copied into
  `content-media` on completion. That bucket caps files at 50 MB; a 1080p 15 s render may need
  the limit raised before `premium` is enabled.
- **Not yet built:** multi-clip films with stitching, character sheets and storyboard boards,
  image-to-video from a brand reference, a webhook receiver (polling is used today), and a
  persisted per-render credit ledger.
