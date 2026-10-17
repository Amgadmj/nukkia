# AI video pipeline: what exists, what is missing, what the research says

Date: 2026-10-17 (revision 2, checked against `master` at `bcfbfa2`).
Input: `ai_video_workflow_agent_brief.txt` (the seven-stage "asymmetric credit" pipeline).
Companion: [the revised brief](2026-10-17-agent-brief-v2.txt).

Four research agents (A/V sync, render cost, VLM gating, assembly) checked vendor documentation and current
pricing. Revision 2 adds three kinds of evidence:

- the Higgsfield model pages, read directly;
- the Vercel limits page and the ElevenLabs pricing page;
- measurements of the original August pipeline run, whose files sit in `AI media/` (`ffmpeg -i` on every test and final).

Claims that only secondary sources support are marked _unverified_.

## Corrections in revision 2

| Revision 1 said | Correct | Source |
|---|---|---|
| Gemini writes the storyboard; Gate 2 "reuses the existing Gemini integration for text" | Text and storyboard come from **Claude** (`claude-sonnet-4-6`, via `generateJson` in `ai.server.ts`). Gemini handles only images (`gemini-3.1-flash-image`) and Veo. Both providers can judge keyframes (images). Only Gemini takes video input directly. | `src/lib/ai.server.ts` header and `generateJson` |
| Open question: does Higgsfield expose Seedance image-to-video? | **Yes.** `POST /bytedance/seedance-2.0/image-to-video` takes `image_url` (required) and `end_image_url` (optional last frame), with duration 4–15 and 480p–4k. There is no `aspect_ratio`: the framing follows the input image. `reference-to-video` accepts up to 9 `image_urls`, 3 `video_urls` and 3 `audio_urls`. | docs.higgsfield.ai, Seedance 2.0 model pages |
| "No documented seed" (from a third-party guide) | Confirmed on the primary source. None of the three Seedance 2.0 schemas has a `seed` or `mode` field, and every schema rejects extra properties. | same |
| "The 50 MB limit applies per file, so storage is not a constraint" | **It is a constraint for native 1080p.** The August finals measure 25.5–30.4 Mbps, which is **48–57 MB per 15 s clip**. Two of five exceed the 50 MiB cap (52,428,800 bytes). `downloadHiggsfieldVideo` rejects those **after the credits are spent**. A final re-encoded at about 7.5 Mbps fits easily: the 30 s assembled master is 28.8 MB. | ffprobe of `final_gen*.mp4`, `gen2_take*.mp4`, `HORMUZ_FINAL_30s_PROVISIONAL.mp4` |
| Assembly normalises to 30 fps | **Keep 24 fps.** Seedance outputs 24 fps, and forcing 30 duplicates frames, which causes judder. Snap cuts on the 24 fps grid. Audio comes out as 44.1 kHz AAC; resample it to 48 kHz. Clips run 15.09 s, not 15.00, so trim to the planned length. | ffprobe of every clip |
| Stage 6 "has no slack" (estimated) | **Measured.** The August run produced 5 native-1080p finals for 2 kept clips (gen1: 2, gen2: 3). That is 5 × 135 = **675 credits against the 270 budget**, a yield of exactly 2.5. The 480p tests themselves exist (864×496, about 2 Mbps), so the CLI's "fast" rung was real; the public API has no equivalent. | files in `AI media/` |
| "Do not ship on ElevenLabs v3 while it is beta" | The API pricing page lists v3 at $0.08 per 1K characters with no beta label. The help-centre rule still stands: output from beta services is not for commercial use. Confirm v3's status in the account before choosing it. Multilingual v2 is the safe default. | elevenlabs.io/pricing/api |
| The default (Veo) path renders the script's length | **Veo receives no duration**, only `aspectRatio`. The prompt says 15–45 s, but the clip comes back at Veo 3.1's per-call maximum of about 8 s. A video unit is sold as "one finished 15-second video". | `startVideoGeneration` in `ai.server.ts` |
| Polling is the only option | Higgsfield documents **webhooks** for completion. The code polls today. | docs.higgsfield.ai, how-to/webhooks |
| libass availability unknown | The local Windows `ffmpeg-static` (6.1.1, gyan build) has `subtitles`, `ass`, `xfade`, `sidechaincompress` and `loudnorm`. The **Linux binary that Vercel runs is still unverified**, so check it in CI. | `ffmpeg -filters` locally |

Vercel limits are now confirmed on the primary page (updated 2026-08-24):

- Duration: 300 s default on every plan; Pro allows up to 800 s, and up to 1800 s in beta.
- Memory and CPU: Hobby 2 GB / 1 vCPU; Pro up to 4 GB / 2 vCPU.
- Bundle: 250 MB (5 GB with the large-functions beta).
- Request and response body: 4.5 MB.

## 1. What the code does today

The reels path is a **single-shot, text-to-video** flow:

1. `/api/arte` with `format: "reels"` calls `generateVideoStoryboard`
   ([content-engine/index.ts](../../src/lib/content-engine/index.ts)).
   - **Claude** returns 2 to 6 blocks (`narracao`, `visual_descricao`, `duracao_seg`), totalling 15 to 45 s.
   - The storyboard is saved first, so a render failure does not lose it.
2. Quota and video-unit balance are checked ([video-units.server.ts](../../src/lib/video-units.server.ts)).
3. `startVideoRender` sends **one** generation.
   - **Default, Veo 3.1:** all the shots go into one prose prompt, with no duration parameter.
   - **`VIDEO_PROVIDER=higgsfield`, Seedance 2.0** ([higgsfield.server.ts](../../src/lib/higgsfield.server.ts)):
     - uses the `text-to-video` endpoint only;
     - `planVideoRender` squeezes the blocks onto a clip of at most 15 s, with timed hard cuts;
     - plans above `HIGGSFIELD_MAX_CREDITS_PER_RENDER` (default 70) are refused;
     - each request carries an Idempotency-Key;
     - audio is ambient only, and narration is deliberately left out of the prompt.
4. The client polls `/api/video-status`. When the job is done, the MP4 is copied into `content-media`
   (50 MiB per file) and one video unit is consumed. Consumption is idempotent per operation.
5. Separately, `/api/promo-video` ([promo-video.server.ts](../../src/lib/promo-video.server.ts)) runs
   `ffmpeg-static` to build a 720×900 slideshow from 1 to 3 approved PNGs. It has no AI footage and no audio.
6. Pricing already models the full pipeline:
   - `FILM_FIXED_CREDITS = 49.5`, `renderCredits = 68.5`, `videoYield = 2.5` (target 1.8);
   - the admin panel warns when yield goes above 2.3;
   - the `film_30s` SKU is closed.
7. **Synced from upstream (`bcfbfa2`, PR #17):**
   - The Health Studio tab is now labelled **"Roteiro de vídeo"**. It is still a synthetic editor of
     `text_card` scenes and is not connected to a provider.
   - A new **clinic media library** ([clinic-media.ts](../../src/lib/clinic-media.ts),
     `clinic-media-library.tsx`) lets the customer upload their own PNG, JPEG, WebP or MP4, up to 50 MB each,
     into `content-media/<company>/uploads`. Each upload requires a licence confirmation.
   - Nothing feeds these uploads into video generation yet.
   - The backlog ([proposed ownership](../operations/2026-10-13-proposed-backlog-ownership.md)) already lists
     the related work:
     - N19: separate likeness and voice grants
     - N20: own-twin provider adapter
     - N21: full-path budget and fenced jobs
     - N23: scene reuse and dependency invalidation
     - N17: Brazilian medical policy

## 2. Stage-by-stage gap matrix

| Brief stage | Status | What exists | What is missing |
|---|---|---|---|
| 1 Line sheet | **Partial** | Storyboard blocks carry `narracao` | A word budget. The script targets 15 to 45 s, while renders are 15 s (Seedance) or about 8 s (Veo). |
| 2 Character sheet + Gate 1 | **Missing** | A text-only `buildStyleAnchor`. Customer photos can now be uploaded (clinic media library). | Turning uploads into a reference sheet, passing it to `reference-to-video`, an identity check, likeness consent (N19) |
| 3 Beat map / shot list | **Partial** | `visual_descricao`, durations, timed segments in the Seedance prompt | Camera, framing and look fields per shot. Durations come from the LLM, not from audio. |
| 4 Storyboard boards + Gate 2 | **Missing** | The "Roteiro de vídeo" scene editor (synthetic) | 9:16 keyframes per shot, panel review, compliance check |
| 5 Low-res test + Gate 3 | **Missing** | A global `draft` profile (480p) set by environment variable | A test stage per project, image-to-video from the boards, a motion and seam gate. There is no fast rung on the API. |
| 6 1080p finals | **Partial** | One idempotent, metered render at the configured profile (default 720p) | Verification and upscaling. Native 1080p is blocked by the 70-credit ceiling, and its files would also exceed the 50 MiB cap. |
| 7 Stitch + VO | **Missing for AI video** | An ffmpeg runner (slideshow only) | Concat, any voice-over, subtitles, loudness, final encode |
| Cost ledger | **Partial** | Video units, an estimate before each render | A per-render credit ledger. `FILM_FIXED_CREDITS` does not match API prices. |

**Biggest product gap:** the `narracao` text is shown in the UI but **never voiced**.

## 3. Corrections to the original brief

1. **Stage 5 costs are not achievable on the public API.**
   - 480p standard costs 3 credits/s, so a 15 s test is 45 credits and a two-clip pass is 90.
   - The August tests were made on the CLI's fast rung, which the public API does not offer.
   - So "< 40 credits for stages 1 to 5" and `FILM_FIXED_CREDITS = 49.5` cannot hold on the API.
2. **Stage 6 overran in practice.** Two kept 1080p clips took 5 renders: 675 credits, not 270.
3. **"Approve at 480p, finalise at 1080p" does not ship what was approved.**
   - With no seed parameter and different latent noise at each resolution, motion and composition change.
   - The August gen2 needed three 1080p takes after its 480p test was approved.
   - The fix: **approve the actual take, then upscale it**.
4. **The cost formula slightly overcharges.** `68.5 × yield` charges the upscale to rejected renders.
   The correct form is `67.5 × yield + one upscale`.

## 4. Research insights

### A/V sync (Task 1)

- **Make the voice-over the timing master, before any video spend.** ElevenLabs `/with-timestamps`
  returns character-level alignment for pt-BR.
  - Price (verified on the pricing page): Multilingual v2 and v3 are $0.08 per 1K characters;
    Flash/Turbo are $0.04.
  - A 15 s voice-over is about 220 characters, so under 2 US cents.
  - Azure gives word boundaries. Google Chirp 3 HD and OpenAI TTS document no timestamps.
- **Algorithm:**
  1. Synthesise the whole script in one call.
  2. Map the character offsets back to block boundaries.
  3. Snap each cut to the nearest pause between words, then to the **24 fps** grid (41.7 ms per frame).
  4. Add a 0.3 to 0.5 s lead-in.
  5. Round up to a whole number of seconds, at most 15.
  6. Feed the results into the timed-cut prompt.
- **Planning budget:** about 2.5 words/s, roughly 32 to 38 words per 15 s.
- **New option:** `reference-to-video` accepts up to 3 `audio_urls` (2–15 s each). The scratch voice-over
  could be passed as an audio reference so the model paces the motion to it. _Whether it follows timing
  this way is untested._
- **Native speech is not the path for pt-BR.** No major model lists Portuguese lip-sync; Kling 3.0 lists
  five languages (_third-party comparison_). Keep model audio for ambience only, and ban on-camera speakers
  by default.

### Render cost (Task 2)

Cost of one kept 15 s clip at Higgsfield rates (US$0.0627 per credit):

| Ladder | Yield 2.5 (measured in August) | Yield 1.8 (target) |
|---|---|---|
| A: native 1080p | 337.5 cr / $21.2 | 243 cr / $15.2 |
| B: 720p take + upscale | ~170–181 cr / $10.6–11.3 | ~124–134 cr / $7.8–8.4 |
| C: 480p image-to-video + upscale | ~124 cr / $7.8 | ~93 cr / $5.8 |

- **Image-to-video exists on our current vendor.** Switching from `text-to-video` to `image-to-video`
  (first frame plus optional last frame) needs no new vendor. Board images must be generated at 9:16,
  because the output framing follows the image.
- **Upscalers** for 15 s at 1080×1920 (fal model pages): ByteDance about $0.11, FlashVSR about $0.37,
  SeedVR2 about $0.75, Topaz Starlight about $1.80. No independent flicker benchmark exists, so test them
  on our clips. Re-encode the upscaled output to about 8 Mbps before storing it, to stay under 50 MiB.
- **Vendor arbitrage:** BytePlus ModelArk reportedly lists Seedance 2.0 35–60% below Higgsfield.
  _Unverified: third-party guides only. Get a direct quote._ Higgsfield also lists Seedance 2.5 endpoints.
- **Delivery:** 1080×1920 upload, but it does not need to be generated natively at 1080p.

### Automated gating (Task 3)

- **VLMs are good at:** identity, on-screen text, prompt adherence and compliance.
- **VLMs are poor at fine temporal artifacts** (Spotlight, Artifact-Bench, TimeBlind benchmarks).
  Pair them with deterministic signals:
  - ArcFace face drift against the reference
  - PySceneDetect or the ffmpeg scene score, to confirm cuts within ±0.2 s of the plan
  - a frame-difference flicker heuristic
  - OCR
- **Model choice:**
  - Gemini takes video natively (1 fps by default, configurable). A 15 s clip costs cents or less.
  - Claude, already used for text, can judge keyframes and frame grids as images.
- **Judge hygiene:**
  - binary checks that require evidence
  - allow `null`, meaning "a human decides"
  - frame grids with timestamps
  - majority of 2–3 samples
  - calibrate on about 200 labelled clips (κ ≥ 0.6)
  - run in shadow mode first
- **First gate to build: Gate 2 compliance.** It checks for result promises, before/after imagery,
  identifiable patients and garbled pt-BR text, against ANVISA/CFM rules, before any video spend.
  This aligns with backlog N17. _Rule specifics need counsel._

### Assembly (Task 4)

- **Stay in TypeScript and reuse `runFfmpeg`.** A dedicated Vercel function (Pro: 300 s default, up to
  800 s, 4 GB / 2 vCPU) fits a 30 s 1080p job.
  - Media moves through Storage URLs, because the body limit is 4.5 MB.
  - Fallback options: Vercel Sandbox or Cloud Run with the same argument arrays.
- **The recipe:**
  - normalise each clip to 1080×1920, **24 fps**, yuv420p, 48 kHz, trimmed to the planned length
  - hard `concat` or `xfade`
  - duck ambience under the VO with `sidechaincompress`
  - two-pass `loudnorm` at −14 LUFS / −1.5 dBTP (a convention; platforms publish no target)
  - burned ASS captions with `\kf` word highlights taken from the TTS timestamps
  - H.264 high, about 8 Mbps, `+faststart`
- **Provenance:**
  - Seedance output reportedly carries C2PA credentials (_secondary source_). Re-encoding strips them.
  - Add a visible "Conteúdo gerado com IA" option.
  - The election runoff falls on 25 Oct 2026. TSE rules require AI disclosure in campaign content.

## 5. Recommended build order

1. **Finish the 15 s reel.**
   - Word budget, with Claude storyboards capped at 15 s.
   - Pass `durationSeconds` to Veo, or default to Seedance, so a sold "15-second video" really is 15 s.
   - TTS with timestamps, then timings, then assembly: VO, ducking, loudnorm, captions, 1080×1920 at 24 fps.
2. **Boards, Gate 2 and image-to-video.**
   - 9:16 keyframes per shot.
   - Compliance and OCR gate in shadow mode.
   - Switch Seedance to `image-to-video` with the boards as first (and last) frames.
3. **Take, Gate 3 and upscale.**
   - Approve the 480p or 720p take, then upscale and re-encode.
   - Per-render credit ledger.
   - Replace polling with Higgsfield webhooks.
   - Reopen `film_30s` when yield is ≤ 1.8.
4. **Reference sheet from customer uploads (Gate 1).**
   - Feed clinic-media photos into `reference-to-video`.
   - Only after likeness and voice consent records exist (N19).
   - Get a quote for direct Seedance access.

## 6. Still to verify

- Seedance i2v/reference credit prices per second. The public docs give none; check with the Higgsfield
  cost endpoint or the CLI.
- Whether `reference-to-video` audio references control pacing.
- libass in the Linux ffmpeg-static binary.
- How long a 30 s 1080p ffmpeg job takes on 2 vCPU.
- Upscaler flicker on our clips.
- A BytePlus quote.
- ElevenLabs v3 status in the account.
- CFM/ANVISA rule details, with counsel.
- Gate thresholds.
