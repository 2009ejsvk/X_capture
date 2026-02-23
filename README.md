# Tweet Recomposer Capture

Small personal web service:

1. Paste a tweet URL
2. Rebuild it into a custom card layout (auto-updates on input changes)
3. Capture and download as PNG, or MP4 when tweet media is GIF/video (server mode)

## Stack

- Node.js + Express
- Playwright (Chromium) for server-side image capture
- FFmpeg for GIF/video + tweet card composition
- fxtwitter API (`api.fxtwitter.com`) as tweet data source
- oEmbed fallback when API fetch fails

## Run locally

```bash
npm install
npm run install:browsers
npm start
```

Open `http://localhost:3000`.

`ffmpeg` must be installed and available in `PATH` to enable GIF/video composition.

## Environment variables

- `PORT` (default: `3000`)
- `FXTWITTER_API_BASE` (default: `https://api.fxtwitter.com`)
- `TWEET_CACHE_TTL_MS` (default: `600000`)
- `TWEET_CACHE_MAX_ENTRIES` (default: `300`)
- `FFMPEG_PATH` (optional absolute path to ffmpeg executable)

## API summary

- `GET /api/health`
- `GET /api/tweet?url=<tweet-url>`
- `GET /api/card`
- `POST /api/capture` (returns `image/png` or `video/mp4`)

`GET /api/card` major query params:

- `url` (required)
- `theme` = `paper | slate`
- `fontPreset` = `system | grotesk | noto`
- `width` = `420..1080`
- `bodyFontSize` = `60..180`
- `uiFontSize` = `60..180`
- `includeMedia` = `true | false`
- `includeRetweet` = `true | false`
- `includeRetweetMedia` = `true | false`
- `separateShared` = `true | false`
- `stackMultiPhoto` = `true | false`
- `stackPhotoGap` = `true | false`
- `includeReplyThread` = `true | false`
- `mediaSelectionEnabled` = `true | false`
- `selectedMediaKeys` = comma-separated keys (example: `main-photo-0,main-video-0,shared-photo-0,reply-0-video-0`)

`POST /api/capture` body supports the same content options plus:

- `scale` = `1..3`
- `mediaFit` = `cover | contain`
- `composeVideo` = `true | false` (default `true`)

`POST /api/capture` body example:

```json
{
  "url": "https://x.com/yona_pip/status/2022590641214222759",
  "theme": "paper",
  "fontPreset": "system",
  "width": 540,
  "bodyFontSize": 105,
  "uiFontSize": 95,
  "scale": 2,
  "composeVideo": true,
  "mediaFit": "cover",
  "includeMedia": true,
  "includeRetweet": true,
  "includeRetweetMedia": true,
  "separateShared": false,
  "stackMultiPhoto": true,
  "stackPhotoGap": false,
  "includeReplyThread": true,
  "mediaSelectionEnabled": true,
  "selectedMediaKeys": ["main-photo-0", "main-video-0"]
}
```

## Deploy quickly from GitHub

### Option A: Railway

1. Push this project to GitHub.
2. Create a new Railway project from the GitHub repo.
3. Set start command: `npm start`
4. Add deploy command: `npm install && npm run install:browsers`
5. Deploy.

### Option B: Render (Web Service)

1. Push this project to GitHub.
2. Create a new Render Web Service from the repo.
3. Build command: `npm install && npm run install:browsers`
4. Start command: `npm start`
5. Deploy.

### Option C: GitHub Pages (Browser Mode, No Backend)

Use this when you want to run on the visitor's device resources only.

1. This repo already includes a `docs/` folder for Pages deploy.
2. Commit and push.
3. In GitHub repo settings, enable Pages from `main` branch / `docs` folder.
4. Open your Pages URL.

When you edit `public/`, copy the same files to `docs/` before pushing.

Browser mode notes:

- Works without `server.js` (no Express/Playwright/FFmpeg).
- Tweet load/render/capture runs in the user's browser.
- Capture output is PNG only.
- GIF/video MP4 composition is not available in browser mode.

## Notes

- This service depends on a public unofficial API. Some tweets may fail to load.
- Only public tweets are expected to work.
- GIF/video tweets return composed MP4 when possible.
- Captures are generated on demand and are not stored.

## QA

- Quick smoke test checklist: `SMOKE_CHECKLIST.md`
