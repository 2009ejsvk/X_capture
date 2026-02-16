const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const { spawn } = require("child_process");
const express = require("express");
const { chromium } = require("playwright");
const { fetchTweetModel, parseTweetInput } = require("./src/tweetService");
const { renderTweetDocument } = require("./src/renderCard");

const PORT = Number(process.env.PORT || 3000);
const TWEET_CACHE_TTL_MS = Number(process.env.TWEET_CACHE_TTL_MS || 10 * 60 * 1000);
const TWEET_CACHE_MAX_ENTRIES = Number(process.env.TWEET_CACHE_MAX_ENTRIES || 300);
const FFMPEG_BIN = process.env.FFMPEG_PATH || "ffmpeg";
const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/public", express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "tweet-recomposer-capture"
  });
});

app.get("/api/tweet", async (req, res, next) => {
  try {
    const inputUrl = readRequiredUrl(req.query.url);
    const tweet = await fetchTweetModelCached(inputUrl);
    res.json({ ok: true, tweet });
  } catch (error) {
    next(error);
  }
});

app.get("/api/card", async (req, res, next) => {
  try {
    const inputUrl = readRequiredUrl(req.query.url);
    const tweet = await fetchTweetModelCached(inputUrl);
    const width = parseNumber(req.query.width, 1080, 420, 1080);
    const legacyFontSize =
      req.query.fontSize === undefined
        ? null
        : parseNumber(req.query.fontSize, 100, 60, 180);
    const bodyFontSize = parseNumber(
      req.query.bodyFontSize,
      legacyFontSize ?? 105,
      60,
      180
    );
    const uiFontSize = parseNumber(
      req.query.uiFontSize,
      legacyFontSize ?? 95,
      60,
      180
    );
    const locale = parseLocale(req.query.locale);
    const theme = parseTheme(req.query.theme);
    const renderOptions = {
      includeMedia: parseBoolean(req.query.includeMedia, true),
      includeSharedTweet: parseBoolean(req.query.includeRetweet, true),
      includeSharedMedia: parseBoolean(req.query.includeRetweetMedia, true),
      separateShared: parseBoolean(req.query.separateShared, false),
      stackMultiPhoto: parseBoolean(req.query.stackMultiPhoto, false),
      stackPhotoGap: parseBoolean(req.query.stackPhotoGap, true),
      includeReplyThread: parseBoolean(req.query.includeReplyThread, false),
      selectedMediaKeys: parseMediaKeyList(req.query.selectedMediaKeys),
      mediaSelectionEnabled: parseBoolean(req.query.mediaSelectionEnabled, false),
      manualText: parseManualText(req.query.manualText)
    };
    const html = renderTweetDocument({
      tweet,
      width,
      bodyFontSize,
      uiFontSize,
      theme,
      locale,
      options: renderOptions
    });
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    next(error);
  }
});

app.post("/api/capture", async (req, res, next) => {
  try {
    const inputUrl = readRequiredUrl(req.body?.url);
    const width = parseNumber(req.body?.width, 1080, 420, 1080);
    const legacyFontSize =
      req.body?.fontSize === undefined
        ? null
        : parseNumber(req.body?.fontSize, 100, 60, 180);
    const bodyFontSize = parseNumber(
      req.body?.bodyFontSize,
      legacyFontSize ?? 105,
      60,
      180
    );
    const uiFontSize = parseNumber(
      req.body?.uiFontSize,
      legacyFontSize ?? 95,
      60,
      180
    );
    const scale = parseNumber(req.body?.scale, 2, 1, 3);
    const locale = parseLocale(req.body?.locale);
    const theme = parseTheme(req.body?.theme);
    const mediaFit = parseMediaFit(req.body?.mediaFit);
    const composeVideo = parseBoolean(req.body?.composeVideo, true);
    const renderOptions = {
      includeMedia: parseBoolean(req.body?.includeMedia, true),
      includeSharedTweet: parseBoolean(req.body?.includeRetweet, true),
      includeSharedMedia: parseBoolean(req.body?.includeRetweetMedia, true),
      separateShared: parseBoolean(req.body?.separateShared, false),
      stackMultiPhoto: parseBoolean(req.body?.stackMultiPhoto, false),
      stackPhotoGap: parseBoolean(req.body?.stackPhotoGap, true),
      includeReplyThread: parseBoolean(req.body?.includeReplyThread, false),
      selectedMediaKeys: parseMediaKeyList(req.body?.selectedMediaKeys),
      mediaSelectionEnabled: parseBoolean(req.body?.mediaSelectionEnabled, false),
      manualText: parseManualText(req.body?.manualText)
    };
    const tweet = await fetchTweetModelCached(inputUrl);

    const renderInput = {
      tweet,
      width,
      bodyFontSize,
      uiFontSize,
      theme,
      locale,
      options: renderOptions
    };
    const html = renderTweetDocument(renderInput);

    const primaryVideo =
      composeVideo && renderOptions.includeMedia
        ? pickComposableVideo(tweet, renderOptions)
        : null;
    if (primaryVideo) {
      try {
        const videoBuffer = await composeTweetVideo({
          cardHtml: html,
          mediaUrl: primaryVideo.url,
          width,
          scale,
          mediaFit
        });
        const filename = `tweet-${tweet.id || "capture"}.mp4`;
        res.setHeader("content-type", "video/mp4");
        res.setHeader("content-disposition", `attachment; filename="${filename}"`);
        res.setHeader("x-tweet-id", String(tweet.id || ""));
        res.setHeader("x-capture-kind", "video");
        res.send(videoBuffer);
        return;
      } catch {
        // Fall back to PNG when composition fails.
      }
    }

    const pngBuffer = await capturePng(html, width, scale);
    const filename = `tweet-${tweet.id || "capture"}.png`;
    res.setHeader("content-type", "image/png");
    res.setHeader("content-disposition", `attachment; filename="${filename}"`);
    res.setHeader("x-tweet-id", String(tweet.id || ""));
    res.setHeader("x-capture-kind", "image");
    res.send(pngBuffer);
  } catch (error) {
    next(error);
  }
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, error: "API endpoint not found." });
  }
  return next();
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((error, _req, res, _next) => {
  const status = typeof error.statusCode === "number" ? error.statusCode : 500;
  const message = error.message || "Unexpected server error.";
  res.status(status).json({
    ok: false,
    error: message
  });
});

let browserPromise = null;
const contextPromises = new Map();
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true
    });
  }
  return browserPromise;
}

async function getContext(scale) {
  const key = String(scale);
  if (!contextPromises.has(key)) {
    const browser = await getBrowser();
    const contextPromise = browser.newContext({
      deviceScaleFactor: scale,
      viewport: {
        width: 1400,
        height: 2200
      }
    });
    contextPromises.set(key, contextPromise);
  }
  return contextPromises.get(key);
}

async function capturePng(html, width, scale) {
  const snapshot = await captureCardSnapshot({
    html,
    width,
    scale,
    detectVideoBox: false
  });
  return snapshot.buffer;
}

async function captureCardSnapshot({ html, width, scale, detectVideoBox }) {
  const context = await getContext(scale);
  const page = await context.newPage();
  await page.setViewportSize({
    width: Math.round(width + 120),
    height: 1700
  });

  try {
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("#capture-root", { state: "visible", timeout: 20000 });
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map(
          (image) =>
            new Promise((resolve) => {
              if (image.complete) {
                resolve();
                return;
              }
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
              setTimeout(resolve, 2500);
            })
        )
      );
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });

    const geometry = await page.evaluate((shouldDetectVideoBox) => {
      const root = document.querySelector("#capture-root");
      if (!root) {
        return null;
      }
      const rootRect = root.getBoundingClientRect();
      let mediaBox = null;

      if (shouldDetectVideoBox) {
        const primaryCard = root.querySelector("#tweet-card");
        const badge = (primaryCard || root).querySelector(".video-badge");
        const mediaItem = badge ? badge.closest(".media-item") : null;
        if (mediaItem) {
          const mediaRect = mediaItem.getBoundingClientRect();
          mediaBox = {
            x: mediaRect.left - rootRect.left,
            y: mediaRect.top - rootRect.top,
            width: mediaRect.width,
            height: mediaRect.height
          };
        }
      }

      return {
        width: rootRect.width,
        height: rootRect.height,
        mediaBox
      };
    }, Boolean(detectVideoBox));

    const captureRoot = page.locator("#capture-root");
    const buffer = await captureRoot.screenshot({
      type: "png"
    });

    return {
      buffer,
      pixelWidth: Math.max(2, Math.round((geometry?.width || width) * scale)),
      pixelHeight: Math.max(2, Math.round((geometry?.height || 1) * scale)),
      mediaBox: scaleMediaBox(geometry?.mediaBox, scale)
    };
  } finally {
    await page.close();
  }
}

function pickComposableVideo(tweet, renderOptions = {}) {
  if (!tweet || typeof tweet !== "object") {
    return null;
  }
  const shouldFilter = renderOptions.mediaSelectionEnabled === true;
  const selectedKeySet = shouldFilter
    ? new Set(Array.isArray(renderOptions.selectedMediaKeys) ? renderOptions.selectedMediaKeys : [])
    : null;

  const candidates = [];
  appendComposableVideos(candidates, tweet.videos, "main", selectedKeySet);

  const includeSharedTweet = renderOptions.includeSharedTweet !== false;
  const includeSharedMedia = renderOptions.includeSharedMedia !== false;
  if (includeSharedTweet && includeSharedMedia) {
    appendComposableVideos(candidates, tweet.sharedTweet?.videos, "shared", selectedKeySet);
  }

  if (renderOptions.includeReplyThread === true && Array.isArray(tweet.replyChain)) {
    tweet.replyChain.forEach((replyTweet, replyIndex) => {
      appendComposableVideos(
        candidates,
        replyTweet?.videos,
        `reply-${replyIndex}`,
        selectedKeySet
      );
    });
  }

  return candidates[0] || null;
}

function appendComposableVideos(target, videos, contextKey, selectedKeySet) {
  if (!Array.isArray(videos) || videos.length === 0) {
    return;
  }
  for (let index = 0; index < videos.length; index += 1) {
    if (selectedKeySet && !selectedKeySet.has(`${contextKey}-video-${index}`)) {
      continue;
    }
    const video = videos[index];
    if (video && typeof video.url === "string" && video.url.trim() !== "") {
      target.push(video);
    }
  }
}

async function composeTweetVideo({ cardHtml, mediaUrl, width, scale, mediaFit }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tweet-compose-"));
  const cardPath = path.join(tempDir, "card.png");
  const outputPath = path.join(tempDir, "output.mp4");

  try {
    const snapshot = await captureCardSnapshot({
      html: cardHtml,
      width,
      scale,
      detectVideoBox: true
    });
    await fs.writeFile(cardPath, snapshot.buffer);
    const mediaInput = await prepareMediaInput(mediaUrl, tempDir);
    const mediaBox =
      snapshot.mediaBox ||
      createCenteredMediaBox({
        width: snapshot.pixelWidth,
        height: snapshot.pixelHeight
      });

    await runFfmpegCompose({
      cardPath,
      mediaInput,
      outputPath,
      mediaBox,
      mediaFit
    });

    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function prepareMediaInput(mediaUrl, tempDir) {
  if (/\.m3u8(\?|$)/i.test(mediaUrl)) {
    return mediaUrl;
  }

  const response = await fetch(mediaUrl, {
    headers: {
      "user-agent": "tweet-recomposer/0.1"
    }
  });
  if (!response.ok) {
    throw new Error("Could not download tweet video.");
  }

  const data = Buffer.from(await response.arrayBuffer());
  if (data.length === 0) {
    throw new Error("Tweet video download returned empty data.");
  }
  const ext = guessMediaExtension(mediaUrl, response.headers.get("content-type"));
  const mediaPath = path.join(tempDir, `media${ext}`);
  await fs.writeFile(mediaPath, data);
  return mediaPath;
}

function guessMediaExtension(urlValue, contentType) {
  const normalizedType = String(contentType || "").toLowerCase();
  if (normalizedType.includes("video/mp4")) {
    return ".mp4";
  }
  if (normalizedType.includes("image/gif")) {
    return ".gif";
  }
  if (normalizedType.includes("video/webm")) {
    return ".webm";
  }
  if (normalizedType.includes("video/quicktime")) {
    return ".mov";
  }

  const source = String(urlValue || "").toLowerCase();
  if (source.includes(".gif")) {
    return ".gif";
  }
  if (source.includes(".webm")) {
    return ".webm";
  }
  if (source.includes(".mov")) {
    return ".mov";
  }
  return ".mp4";
}

async function runFfmpegCompose({
  cardPath,
  mediaInput,
  outputPath,
  mediaBox,
  mediaFit
}) {
  const box = normalizeMediaBox(mediaBox, 2, 2);
  const fitMode = parseMediaFit(mediaFit);
  const videoTransform =
    fitMode === "contain"
      ? `scale=${box.width}:${box.height}:force_original_aspect_ratio=decrease,pad=${box.width}:${box.height}:(ow-iw)/2:(oh-ih)/2:black`
      : `scale=${box.width}:${box.height}:force_original_aspect_ratio=increase,crop=${box.width}:${box.height}`;
  const filter = `[0:v]pad=ceil(iw/2)*2:ceil(ih/2)*2:0:0[card];[1:v]${videoTransform}[vid];[card][vid]overlay=${box.x}:${box.y}:format=auto:shortest=1[v]`;
  const args = [
    "-y",
    "-loop",
    "1",
    "-framerate",
    "30",
    "-i",
    cardPath,
    "-i",
    mediaInput,
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-map",
    "1:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    "-shortest",
    outputPath
  ];

  await new Promise((resolve, reject) => {
    const ffmpegProcess = spawn(FFMPEG_BIN, args, { windowsHide: true });
    let stderr = "";
    ffmpegProcess.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 5000) {
        stderr = stderr.slice(-5000);
      }
    });
    ffmpegProcess.on("error", reject);
    ffmpegProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg failed with code ${code}: ${stderr}`));
    });
  });
}

function scaleMediaBox(mediaBox, scale) {
  if (!mediaBox) {
    return null;
  }
  return normalizeMediaBox(
    {
      x: mediaBox.x * scale,
      y: mediaBox.y * scale,
      width: mediaBox.width * scale,
      height: mediaBox.height * scale
    },
    2,
    2
  );
}

function normalizeMediaBox(mediaBox, fallbackWidth, fallbackHeight) {
  if (!mediaBox) {
    return {
      x: 0,
      y: 0,
      width: ensureEven(fallbackWidth),
      height: ensureEven(fallbackHeight)
    };
  }

  const width = ensureEven(Math.max(2, Math.round(mediaBox.width)));
  const height = ensureEven(Math.max(2, Math.round(mediaBox.height)));
  const x = Math.max(0, Math.round(mediaBox.x));
  const y = Math.max(0, Math.round(mediaBox.y));

  return {
    x,
    y,
    width,
    height
  };
}

function createCenteredMediaBox({ width, height }) {
  const safeWidth = Math.max(2, Math.round(width));
  const safeHeight = Math.max(2, Math.round(height));
  const boxWidth = ensureEven(Math.max(2, Math.round(safeWidth * 0.9)));
  const boxHeight = ensureEven(
    Math.max(2, Math.round(Math.min(safeHeight * 0.62, boxWidth * 0.75)))
  );
  return {
    x: Math.max(0, Math.round((safeWidth - boxWidth) / 2)),
    y: Math.max(0, Math.round((safeHeight - boxHeight) / 2)),
    width: boxWidth,
    height: boxHeight
  };
}

function ensureEven(value) {
  const rounded = Math.max(2, Math.round(value));
  if (rounded % 2 === 0) {
    return rounded;
  }
  return rounded + 1;
}

function readRequiredUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    const error = new Error("url is required.");
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
}

function parseNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function parseTheme(theme) {
  if (theme === "slate") {
    return "slate";
  }
  return "paper";
}

function parseMediaFit(mediaFit) {
  if (typeof mediaFit === "string" && mediaFit.trim().toLowerCase() === "contain") {
    return "contain";
  }
  return "cover";
}

function parseLocale(locale) {
  if (typeof locale !== "string" || locale.trim() === "") {
    return "ko-KR";
  }
  return locale.trim();
}

function parseBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function parseManualText(value) {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }
  return normalized.slice(0, 2000);
}

function parseMediaKeyList(value) {
  const raw =
    Array.isArray(value)
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? value.split(",")
        : [];

  if (raw.length === 0) {
    return [];
  }

  const output = [];
  const seen = new Set();
  for (const item of raw) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim();
    if (!/^[a-z0-9-]{3,120}$/i.test(normalized)) {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
    if (output.length >= 300) {
      break;
    }
  }
  return output;
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  if (contextPromises.size > 0) {
    const contexts = Array.from(contextPromises.values());
    contextPromises.clear();
    await Promise.all(
      contexts.map(async (contextPromise) => {
        try {
          const context = await contextPromise;
          await context.close();
        } catch {
          return;
        }
      })
    );
  }
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
  }
  process.exit(0);
}

app.listen(PORT, () => {
  console.log(`tweet-recomposer-capture running at http://localhost:${PORT}`);
});

const tweetCache = new Map();

async function fetchTweetModelCached(inputUrl) {
  const cacheKey = makeTweetCacheKey(inputUrl);
  const now = Date.now();
  const entry = tweetCache.get(cacheKey);

  if (entry?.value) {
    if (entry.expiresAt > now) {
      touchCacheEntry(cacheKey, entry);
      return entry.value;
    }
    if (!entry.pending) {
      entry.pending = refreshTweetCache(cacheKey, inputUrl, entry.value);
    }
    touchCacheEntry(cacheKey, entry);
    return entry.value;
  }

  if (entry?.pending) {
    return entry.pending;
  }

  const pending = refreshTweetCache(cacheKey, inputUrl, null);
  tweetCache.set(cacheKey, { value: null, expiresAt: 0, pending });
  trimTweetCache();
  return pending;
}

async function refreshTweetCache(cacheKey, inputUrl, fallbackValue) {
  try {
    const value = await fetchTweetModel(inputUrl);
    tweetCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + TWEET_CACHE_TTL_MS,
      pending: null
    });
    trimTweetCache();
    return value;
  } catch (error) {
    if (fallbackValue) {
      const current = tweetCache.get(cacheKey) || {};
      tweetCache.set(cacheKey, {
        value: fallbackValue,
        expiresAt: Date.now() + Math.floor(TWEET_CACHE_TTL_MS / 3),
        pending: null
      });
      trimTweetCache();
      return fallbackValue;
    }
    tweetCache.delete(cacheKey);
    throw error;
  }
}

function makeTweetCacheKey(inputUrl) {
  try {
    const parsed = parseTweetInput(inputUrl);
    return parsed.id;
  } catch {
    return String(inputUrl).trim().toLowerCase();
  }
}

function touchCacheEntry(cacheKey, entry) {
  tweetCache.delete(cacheKey);
  tweetCache.set(cacheKey, entry);
}

function trimTweetCache() {
  if (tweetCache.size <= TWEET_CACHE_MAX_ENTRIES) {
    return;
  }
  const removeCount = tweetCache.size - TWEET_CACHE_MAX_ENTRIES;
  let removed = 0;
  for (const key of tweetCache.keys()) {
    tweetCache.delete(key);
    removed += 1;
    if (removed >= removeCount) {
      break;
    }
  }
}
