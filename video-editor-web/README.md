# Clip Combiner (web scaffold)

Combine short clips into one longer video, with AI proposing a few different
edit options and the user describing guidelines in plain text. This is a
browser-first scaffold meant to validate the concept before an iOS build.

## How it works

The AI never touches raw video or generates video directly. It looks at a
handful of extracted frames per clip plus your text guidelines, and returns
a structured **edit plan** (which clips, in what order, trimmed to what
in/out points). The browser then renders that plan deterministically.

```
Import clips (<input type="file">)
  -> extract a few frames per clip client-side (lib/frames.ts, canvas)
  -> POST frames + clip metadata + guidelines to /api/analyze
       -> app/api/analyze/route.ts calls Claude (tool-use, forced structured output)
       -> validated against lib/schema.ts (zod) before returning
  -> show 2-4 candidate edit plans (components/PlanOptions.tsx)
  -> user picks one -> render entirely in-browser via ffmpeg.wasm (lib/ffmpegClient.ts)
  -> preview + download the resulting MP4
```

Only small JPEG frames and text ever leave the browser during analysis; the
full video files are only touched locally by ffmpeg.wasm during render.

## Project layout

- `app/page.tsx` — main UI flow (upload → guidelines → options → render)
- `app/api/analyze/route.ts` — the one backend endpoint; holds the Anthropic
  API key server-side and proxies the AI call
- `lib/types.ts` — shared types, including the `EditPlan` contract
- `lib/schema.ts` — zod schema + JSON schema used to force/validate the
  AI's structured output
- `lib/frames.ts` — client-side frame extraction via `<video>` + `<canvas>`
- `lib/prompt.ts` — builds the system prompt and multimodal message content
- `lib/ffmpegClient.ts` — trims/concatenates clips per an `EditPlan` using
  `ffmpeg.wasm`, entirely in the browser
- `components/` — `ClipUploader`, `GuidelinesForm`, `PlanOptions`, `RenderPanel`

## Setup

```bash
npm install
cp .env.local.example .env.local   # then set ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000, import a few short video files, optionally type
guidelines, click "Generate edit options", then render one of the proposed
plans.

## Notes / follow-ups

- **ffmpeg.wasm core**: loaded from unpkg at runtime (single-threaded core,
  no special headers needed). For production, self-host the core files
  instead of depending on a CDN at request time.
- **Rendering is entirely client-side** right now (no video upload, no
  storage infra). If render performance becomes a bottleneck on longer/larger
  clips, the natural next step is a server-side `ffmpeg` render path — the
  `EditPlan` contract doesn't need to change, only where it gets executed.
- **Transcription isn't wired up yet.** The AI call currently only sees
  frames, not spoken audio. If clip audio matters for editing decisions,
  add a transcription step (server-side, since browsers don't do reliable
  file-based speech-to-text) and include the transcript text in
  `lib/prompt.ts`.
- **Porting to iOS later**: `app/api/analyze/route.ts`, `lib/schema.ts`, and
  `lib/prompt.ts` are UI-agnostic and can move to an iOS backend largely
  as-is. Only `lib/frames.ts` (→ `AVAssetImageGenerator`) and
  `lib/ffmpegClient.ts` (→ `AVMutableComposition` /
  `AVAssetExportSession`) need native reimplementations.
