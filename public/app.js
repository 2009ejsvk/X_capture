const urlInput = document.getElementById("tweet-url");
const themeInput = document.getElementById("theme");
const widthInput = document.getElementById("width");
const ratioInput = document.getElementById("ratio");
const fontPresetInput = document.getElementById("font-preset");
const bodyFontSizeInput = document.getElementById("body-font-size");
const bodyFontSizeValue = document.getElementById("body-font-size-value");
const uiFontSizeInput = document.getElementById("ui-font-size");
const uiFontSizeValue = document.getElementById("ui-font-size-value");
const videoFitInput = document.getElementById("video-fit");
const manualTextInput = document.getElementById("manual-text");
const includeMediaInput = document.getElementById("include-media");
const includeRetweetInput = document.getElementById("include-retweet");
const includeRetweetMediaInput = document.getElementById("include-retweet-media");
const separateSharedInput = document.getElementById("separate-shared");
const stackMultiPhotoInput = document.getElementById("stack-multi-photo");
const stackPhotoGapInput = document.getElementById("stack-photo-gap");
const includeReplyThreadInput = document.getElementById("include-reply-thread");
const mediaPickerWrap = document.getElementById("media-picker-wrap");
const mediaPickerList = document.getElementById("media-picker-list");
const statusText = document.getElementById("status");
const previewFrame = document.getElementById("preview-frame");
const resultImage = document.getElementById("result-image");
const resultVideo = document.getElementById("result-video");
const downloadLink = document.getElementById("download-link");

const STORAGE_KEY = "tweet-recomposer:last-url";
const PREVIEW_DELAY_MS = 80;
const CAPTURE_DELAY_MS = 260;
const MEDIA_PICKER_DELAY_MS = 160;
const WYSIWYG_CAPTURE_SCALE = 1;
const RUNTIME_SERVER = "server";
const RUNTIME_CLIENT = "client";
const TWEET_CACHE_LIMIT = 12;

const savedUrl = localStorage.getItem(STORAGE_KEY);
if (savedUrl) {
  urlInput.value = savedUrl;
}

let autoEnabled = false;
let previewTimer = null;
let captureTimer = null;
let captureInFlight = false;
let captureQueued = false;
let captureObjectUrl = "";
let latestCaptureSettings = null;
let lastPreviewSignature = "";
let lastCaptureSignature = "";
let mediaPickerTimer = null;
let mediaFetchController = null;
let mediaTweetId = "";
let mediaOptions = [];
let mediaSelectionByKey = new Map();
let runtimeMode = "";
let previewSequence = 0;
let mediaFetchSequence = 0;
const tweetModelCache = new Map();

bindEvents();
bootstrap();

function bindEvents() {
  const scheduleNormal = () => scheduleAutoUpdate(false);
  const scheduleFast = () => scheduleAutoUpdate(true);

  urlInput.addEventListener("input", scheduleNormal);
  urlInput.addEventListener("paste", scheduleNormal);
  urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      scheduleFast();
    }
  });

  themeInput.addEventListener("change", scheduleFast);
  ratioInput.addEventListener("change", scheduleFast);
  if (fontPresetInput) {
    fontPresetInput.addEventListener("change", scheduleFast);
  }
  widthInput.addEventListener("input", scheduleFast);
  bodyFontSizeInput.addEventListener("input", () => {
    updateFontSizeLabels();
    scheduleFast();
  });
  uiFontSizeInput.addEventListener("input", () => {
    updateFontSizeLabels();
    scheduleFast();
  });
  includeMediaInput.addEventListener("change", () => {
    syncMediaDependentToggles();
    scheduleFast();
  });
  includeRetweetMediaInput.addEventListener("change", scheduleFast);
  separateSharedInput.addEventListener("change", scheduleFast);
  stackMultiPhotoInput.addEventListener("change", () => {
    syncMediaDependentToggles();
    scheduleFast();
  });
  stackPhotoGapInput.addEventListener("change", scheduleFast);
  includeReplyThreadInput.addEventListener("change", scheduleFast);
  videoFitInput.addEventListener("change", scheduleFast);
  manualTextInput.addEventListener("input", scheduleNormal);
  includeRetweetInput.addEventListener("change", () => {
    syncRetweetMediaToggle();
    scheduleFast();
  });
}

function scheduleAutoUpdate(immediate) {
  if (!autoEnabled) {
    return;
  }

  if (previewTimer) {
    clearTimeout(previewTimer);
  }
  if (captureTimer) {
    clearTimeout(captureTimer);
  }
  if (mediaPickerTimer) {
    clearTimeout(mediaPickerTimer);
  }

  previewTimer = setTimeout(() => {
    runPreviewUpdate().catch((error) => {
      setStatus(error.message || "프리뷰 갱신 실패", true);
    });
  }, immediate ? 0 : PREVIEW_DELAY_MS);

  captureTimer = setTimeout(() => {
    queueCaptureUpdate();
  }, CAPTURE_DELAY_MS);

  mediaPickerTimer = setTimeout(() => {
    refreshMediaPicker().catch(() => {});
  }, immediate ? 0 : MEDIA_PICKER_DELAY_MS);
}

async function runPreviewUpdate() {
  const settings = readSettings(false);
  if (!settings) {
    clearOutputs();
    clearMediaPicker();
    setStatus("트윗 URL을 입력하면 자동 반영됩니다.", false);
    return;
  }
  if (!isReadyForRender(settings.url)) {
    setStatus("트윗 URL 입력 중입니다. id까지 입력하면 즉시 반영됩니다.", false);
    return;
  }

  const signature = makeSignature(settings);
  if (signature === lastPreviewSignature) {
    return;
  }

  const sequence = ++previewSequence;
  if (runtimeMode === RUNTIME_SERVER) {
    const cardUrl = buildCardUrl(settings);
    previewFrame.removeAttribute("srcdoc");
    previewFrame.src = cardUrl;
    lastPreviewSignature = signature;
    setStatus("프리뷰 갱신됨", false);
    return;
  }

  const tweet = await fetchTweetModel(settings.url, false, null);
  if (!tweet) {
    throw new Error("트윗 데이터를 불러오지 못했습니다.");
  }
  if (sequence !== previewSequence) {
    return;
  }
  const documentHtml = buildClientCardDocument(tweet, settings);
  previewFrame.removeAttribute("src");
  previewFrame.srcdoc = documentHtml;
  lastPreviewSignature = signature;
  setStatus("프리뷰 갱신됨 (브라우저 모드)", false);
}

function queueCaptureUpdate() {
  const settings = readSettings(false);
  if (!settings || !isReadyForRender(settings.url)) {
    return;
  }

  const signature = makeSignature(settings);
  latestCaptureSettings = settings;

  if (signature === lastCaptureSignature && !captureInFlight) {
    return;
  }

  if (captureInFlight) {
    captureQueued = true;
    return;
  }

  runCaptureUpdate().catch((error) => {
    setStatus(error.message || "자동 캡처 실패", true);
  });
}

async function runCaptureUpdate() {
  if (!latestCaptureSettings) {
    return;
  }

  const settings = latestCaptureSettings;
  const signature = makeSignature(settings);
  if (signature === lastCaptureSignature) {
    return;
  }

  captureInFlight = true;
  captureQueued = false;
  setStatus("캡처 생성 중...", false);

  try {
    if (shouldUseServerCapture(settings)) {
      await runServerCapture(settings);
    } else if (canUseBrowserCapture()) {
      try {
        await runClientCapture(settings);
      } catch (error) {
        if (runtimeMode === RUNTIME_SERVER) {
          await runServerCapture(settings);
        } else {
          throw error;
        }
      }
    } else if (runtimeMode === RUNTIME_SERVER) {
      // Fallback path when browser capture library is unavailable.
      await runServerCapture(settings);
    } else {
      throw new Error("브라우저 캡처를 사용할 수 없습니다.");
    }
    lastCaptureSignature = signature;
    setStatus("자동 반영 완료", false);
  } finally {
    captureInFlight = false;
    if (captureQueued) {
      captureQueued = false;
      runCaptureUpdate().catch((error) => {
        setStatus(error.message || "자동 캡처 실패", true);
      });
    }
  }
}

async function runServerCapture(settings) {
  const renderWidth = resolveRenderWidth(settings);
  const captureScale = resolveCaptureScale(settings, renderWidth);
  const payload = {
    url: settings.url,
    theme: settings.theme,
    fontPreset: settings.fontPreset,
    width: renderWidth,
    bodyFontSize: settings.bodyFontSize,
    uiFontSize: settings.uiFontSize,
    scale: captureScale,
    includeMedia: settings.includeMedia,
    includeRetweet: settings.includeRetweet,
    includeRetweetMedia: settings.includeRetweetMedia,
    separateShared: settings.separateShared,
    stackMultiPhoto: settings.stackMultiPhoto,
    stackPhotoGap: settings.stackPhotoGap,
    includeReplyThread: settings.includeReplyThread,
    selectedMediaKeys: settings.selectedMediaKeys,
    mediaSelectionEnabled: settings.mediaSelectionEnabled,
    mediaFit: settings.videoFit,
    manualText: settings.manualText
  };

  const response = await fetch("/api/capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorPayload = await safeJson(response);
    throw new Error(errorPayload?.error || "Capture failed.");
  }

  const blob = await response.blob();
  const tweetId = response.headers.get("x-tweet-id") || "capture";
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const disposition = response.headers.get("content-disposition") || "";
  const fallbackExt = contentType.startsWith("video/") ? "mp4" : "png";
  const fallbackName = `tweet-${tweetId}.${fallbackExt}`;
  const filename = parseFilenameFromDisposition(disposition) || fallbackName;
  applyCapturedAsset(blob, contentType, filename);
}

function shouldUseServerCapture(settings) {
  if (!settings) {
    return false;
  }
  // WYSIWYG priority: capture with the same browser renderer whenever possible.
  return runtimeMode === RUNTIME_SERVER && !canUseBrowserCapture();
}

async function runClientCapture(settings) {
  if (typeof window.html2canvas !== "function") {
    throw new Error("브라우저 캡처 라이브러리가 로드되지 않았습니다.");
  }
  const renderWidth = resolveRenderWidth(settings);
  const captureScale = resolveCaptureScale(settings, renderWidth);
  await ensureClientPreviewIsFresh(settings);
  const frameDocument = previewFrame.contentDocument;
  if (!frameDocument) {
    throw new Error("프리뷰 문서를 읽을 수 없습니다.");
  }
  await waitForFrameMediaReady(frameDocument);
  const canvas = await captureFrameToCanvas(() => {
    const currentDocument = previewFrame.contentDocument;
    if (!currentDocument) {
      return null;
    }
    return currentDocument.getElementById("capture-root") || currentDocument.body;
  }, captureScale);
  const blob = await canvasToBlob(canvas);
  const tweetId = extractTweetId(settings.url) || "capture";
  const filename = `tweet-${tweetId}.png`;
  applyCapturedAsset(blob, "image/png", filename);
}

async function captureFrameToCanvas(targetResolver, scale) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const target = targetResolver();
      if (!target) {
        throw new Error("캡처 대상이 없습니다.");
      }
      return await window.html2canvas(target, {
        scale,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: null,
        foreignObjectRendering: true
      });
    } catch (error) {
      lastError = error;
      if (!isRetriableCaptureError(error) || attempt === 2) {
        throw error;
      }
      await delay(180);
    }
  }
  throw lastError || new Error("캡처 실패");
}

function isRetriableCaptureError(error) {
  const message = String(error?.message || "");
  return /parsing css component value|unexpected eof|not attached to a window/i.test(message);
}

function applyCapturedAsset(blob, contentType, filename) {
  const objectUrl = URL.createObjectURL(blob);
  if (captureObjectUrl) {
    URL.revokeObjectURL(captureObjectUrl);
  }
  captureObjectUrl = objectUrl;

  if (String(contentType || "").startsWith("video/")) {
    resultImage.removeAttribute("src");
    resultImage.classList.remove("visible");
    resultVideo.src = objectUrl;
    resultVideo.load();
    resultVideo.classList.add("visible");
    resultVideo.currentTime = 0;
    resultVideo.play().catch(() => {});
  } else {
    resultVideo.pause();
    resultVideo.removeAttribute("src");
    resultVideo.classList.remove("visible");
    resultImage.src = objectUrl;
    resultImage.classList.add("visible");
  }

  downloadLink.href = objectUrl;
  downloadLink.download = filename;
  downloadLink.classList.remove("hidden");
}

async function ensureClientPreviewIsFresh(settings) {
  const signature = makeSignature(settings);
  if (signature !== lastPreviewSignature) {
    await runPreviewUpdate();
  }
  await waitForPreviewFrameLoad();
}

async function waitForPreviewFrameLoad() {
  if (!previewFrame) {
    return;
  }
  if (previewFrame.contentDocument && previewFrame.contentDocument.readyState === "complete") {
    return;
  }
  await new Promise((resolve) => {
    let done = false;
    const complete = () => {
      if (done) {
        return;
      }
      done = true;
      resolve();
    };
    previewFrame.addEventListener("load", complete, { once: true });
    setTimeout(complete, 1800);
  });
}

async function waitForFrameMediaReady(frameDocument) {
  if (!frameDocument) {
    return;
  }
  const imageElements = Array.from(frameDocument.querySelectorAll("img"));
  await Promise.all(
    imageElements.map((element) => {
      if (element.complete) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        let done = false;
        const complete = () => {
          if (done) {
            return;
          }
          done = true;
          resolve();
        };
        element.addEventListener("load", complete, { once: true });
        element.addEventListener("error", complete, { once: true });
        setTimeout(complete, 2000);
      });
    })
  );
  const fontSet = frameDocument.fonts;
  if (fontSet && typeof fontSet.ready?.then === "function") {
    await Promise.race([fontSet.ready, delay(2000)]);
  }
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function canvasToBlob(canvas) {
  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) {
    throw new Error("이미지 생성에 실패했습니다.");
  }
  return blob;
}

function readSettings(showError) {
  const url = (urlInput.value || "").trim();
  if (!url) {
    if (showError) {
      setStatus("트윗 URL을 입력해 주세요.", true);
    }
    return null;
  }
  localStorage.setItem(STORAGE_KEY, url);
  return {
    url,
    theme: themeInput.value || "paper",
    fontPreset: normalizeFontPreset(fontPresetInput?.value),
    ratio: ratioInput.value === "desktop" ? "desktop" : "mobile",
    width: clampNumber(Number(widthInput.value), 420, 1080, 1080),
    bodyFontSize: clampNumber(Number(bodyFontSizeInput.value), 60, 180, 105),
    uiFontSize: clampNumber(Number(uiFontSizeInput.value), 60, 180, 95),
    includeMedia: includeMediaInput.checked,
    includeRetweet: includeRetweetInput.checked,
    includeRetweetMedia: includeRetweetMediaInput.checked,
    separateShared: includeRetweetInput.checked && separateSharedInput.checked,
    stackMultiPhoto: includeMediaInput.checked && stackMultiPhotoInput.checked,
    stackPhotoGap:
      includeMediaInput.checked &&
      stackMultiPhotoInput.checked &&
      stackPhotoGapInput.checked,
    includeReplyThread: includeReplyThreadInput.checked,
    selectedMediaKeys: includeMediaInput.checked ? getSelectedMediaKeys() : [],
    mediaSelectionEnabled: includeMediaInput.checked && mediaOptions.length > 0,
    videoFit: videoFitInput.value === "contain" ? "contain" : "cover",
    manualText: normalizeManualText(manualTextInput.value)
  };
}

function normalizeFontPreset(value) {
  if (value === "grotesk" || value === "noto") {
    return value;
  }
  return "system";
}

function buildCardUrl(settings) {
  const renderWidth = resolveRenderWidth(settings);
  const params = new URLSearchParams({
    url: settings.url,
    theme: settings.theme,
    fontPreset: settings.fontPreset,
    width: String(renderWidth),
    bodyFontSize: String(settings.bodyFontSize),
    uiFontSize: String(settings.uiFontSize),
    includeMedia: String(settings.includeMedia),
    includeRetweet: String(settings.includeRetweet),
    includeRetweetMedia: String(settings.includeRetweetMedia),
    separateShared: String(settings.separateShared),
    stackMultiPhoto: String(settings.stackMultiPhoto),
    stackPhotoGap: String(settings.stackPhotoGap),
    includeReplyThread: String(settings.includeReplyThread),
    selectedMediaKeys: settings.selectedMediaKeys.join(","),
    mediaSelectionEnabled: String(settings.mediaSelectionEnabled),
    manualText: settings.manualText
  });
  return `/api/card?${params.toString()}`;
}

function buildClientCardDocument(tweet, settings) {
  const renderer = window.tweetCardRenderer;
  if (!renderer || typeof renderer.renderTweetDocument !== "function") {
    throw new Error("브라우저 렌더러를 찾을 수 없습니다.");
  }
  return renderer.renderTweetDocument({
    tweet,
    width: resolveRenderWidth(settings),
    theme: settings.theme,
    fontPreset: settings.fontPreset,
    locale: "ko-KR",
    bodyFontSize: settings.bodyFontSize,
    uiFontSize: settings.uiFontSize,
    options: {
      includeMedia: settings.includeMedia,
      includeSharedTweet: settings.includeRetweet,
      includeSharedMedia: settings.includeRetweetMedia,
      separateShared: settings.separateShared,
      stackMultiPhoto: settings.stackMultiPhoto,
      stackPhotoGap: settings.stackPhotoGap,
      includeReplyThread: settings.includeReplyThread,
      selectedMediaKeys: settings.selectedMediaKeys,
      mediaSelectionEnabled: settings.mediaSelectionEnabled,
      manualText: settings.manualText
    }
  });
}

async function fetchTweetModel(url, preferFresh, signal) {
  const tweetId = extractTweetId(url);
  if (!preferFresh && tweetId && tweetModelCache.has(tweetId)) {
    return tweetModelCache.get(tweetId);
  }

  let tweet = null;
  if (runtimeMode === RUNTIME_SERVER) {
    const response = await fetch(`/api/tweet?url=${encodeURIComponent(url)}`, {
      method: "GET",
      signal
    });
    if (!response.ok) {
      throw new Error("트윗 정보를 가져오지 못했습니다.");
    }
    const payload = await safeJson(response);
    tweet = payload?.tweet || null;
  } else {
    const service = window.clientTweetService;
    if (!service || typeof service.fetchTweetModel !== "function") {
      throw new Error("브라우저 트윗 서비스가 없습니다.");
    }
    tweet = await service.fetchTweetModel(url);
  }

  if (!tweet) {
    throw new Error("트윗 데이터를 읽을 수 없습니다.");
  }
  if (tweetId) {
    cacheTweetModel(tweetId, tweet);
  }
  return tweet;
}

function cacheTweetModel(tweetId, tweet) {
  if (!tweetId || !tweet) {
    return;
  }
  if (tweetModelCache.has(tweetId)) {
    tweetModelCache.delete(tweetId);
  }
  tweetModelCache.set(tweetId, tweet);
  while (tweetModelCache.size > TWEET_CACHE_LIMIT) {
    const oldestKey = tweetModelCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    tweetModelCache.delete(oldestKey);
  }
}

function makeSignature(settings) {
  return JSON.stringify(settings);
}

function isReadyForRender(input) {
  const value = String(input || "").trim();
  if (/^\d{8,25}$/.test(value)) {
    return true;
  }
  return /status\/\d{8,25}/i.test(value);
}

function clearOutputs() {
  previewSequence += 1;
  previewFrame.removeAttribute("srcdoc");
  previewFrame.src = "about:blank";
  resultImage.removeAttribute("src");
  resultImage.classList.remove("visible");
  resultVideo.pause();
  resultVideo.removeAttribute("src");
  resultVideo.classList.remove("visible");
  downloadLink.href = "#";
  downloadLink.classList.add("hidden");
  lastPreviewSignature = "";
  lastCaptureSignature = "";
  latestCaptureSettings = null;
  if (captureObjectUrl) {
    URL.revokeObjectURL(captureObjectUrl);
    captureObjectUrl = "";
  }
}

function setStatus(message, isError) {
  statusText.textContent = message;
  statusText.classList.toggle("error", Boolean(isError));
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function bootstrap() {
  if (window.location.protocol === "file:") {
    setStatus("file:// 로 열려 있습니다. `npm start` 후 http://localhost:3000 으로 접속해 주세요.", true);
    return;
  }

  if (await isServerAvailable()) {
    runtimeMode = RUNTIME_SERVER;
    setStatus("서버 모드 연결 완료 (캡처는 브라우저 우선)", false);
  } else if (isClientModeAvailable()) {
    runtimeMode = RUNTIME_CLIENT;
    setStatus("브라우저 모드: 이 기기 자원으로 처리합니다.", false);
  } else {
    setStatus("서버 연결 실패, 브라우저 모드 구성도 없어 실행할 수 없습니다.", true);
    return;
  }

  autoEnabled = true;
  syncRetweetMediaToggle();
  syncMediaDependentToggles();
  updateFontSizeLabels();
  scheduleAutoUpdate(true);
}

async function isServerAvailable() {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 1200);
  try {
    const response = await fetch("/api/health", {
      method: "GET",
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function isClientModeAvailable() {
  return Boolean(
    window.tweetCardRenderer &&
      typeof window.tweetCardRenderer.renderTweetDocument === "function" &&
      window.clientTweetService &&
      typeof window.clientTweetService.fetchTweetModel === "function" &&
      typeof window.html2canvas === "function"
  );
}

function canUseBrowserCapture() {
  return typeof window.html2canvas === "function";
}

function syncRetweetMediaToggle() {
  if (includeRetweetInput.checked) {
    includeRetweetMediaInput.disabled = false;
    separateSharedInput.disabled = false;
    return;
  }
  includeRetweetMediaInput.checked = false;
  includeRetweetMediaInput.disabled = true;
  separateSharedInput.checked = false;
  separateSharedInput.disabled = true;
}

function syncMediaDependentToggles() {
  videoFitInput.disabled = !includeMediaInput.checked;
  stackMultiPhotoInput.disabled = !includeMediaInput.checked;
  stackPhotoGapInput.disabled =
    !includeMediaInput.checked || !stackMultiPhotoInput.checked;
  if (!includeMediaInput.checked) {
    stackMultiPhotoInput.checked = false;
    stackPhotoGapInput.checked = true;
  }
  applyMediaPickerDisabledState();
}

function getSelectedMediaKeys() {
  if (mediaSelectionByKey.size === 0) {
    return [];
  }
  return Array.from(mediaSelectionByKey.entries())
    .filter((entry) => entry[1] === true)
    .map((entry) => entry[0])
    .sort();
}

async function refreshMediaPicker() {
  const currentUrl = (urlInput.value || "").trim();
  const tweetId = extractTweetId(currentUrl);
  if (!tweetId) {
    if (mediaTweetId) {
      clearMediaPicker();
    }
    return;
  }
  if (tweetId === mediaTweetId) {
    applyMediaPickerDisabledState();
    return;
  }

  const sequence = ++mediaFetchSequence;
  let signal = null;
  if (runtimeMode === RUNTIME_SERVER) {
    if (mediaFetchController) {
      mediaFetchController.abort();
    }
    const controller = new AbortController();
    mediaFetchController = controller;
    signal = controller.signal;
  }

  let tweet = null;
  try {
    tweet = await fetchTweetModel(currentUrl, true, signal);
  } catch {
    tweet = null;
  }

  if (signal && signal.aborted) {
    return;
  }
  if (sequence !== mediaFetchSequence) {
    return;
  }
  if (extractTweetId((urlInput.value || "").trim()) !== tweetId) {
    return;
  }

  mediaTweetId = tweetId;
  mediaOptions = extractMediaOptions(tweet);
  applyMediaSelectionDefaults(mediaOptions);
  renderMediaPicker();
}

function extractTweetId(input) {
  const value = String(input || "").trim();
  if (/^\d{8,25}$/.test(value)) {
    return value;
  }
  const match = value.match(/status\/(\d{8,25})/i);
  return match && match[1] ? match[1] : "";
}

function extractMediaOptions(tweet) {
  if (!tweet || typeof tweet !== "object") {
    return [];
  }
  const options = [];

  appendPhotoOptions(options, tweet.photos, "main", "원본");
  appendVideoOptions(options, tweet.videos, "main", "원본");
  appendPhotoOptions(options, tweet.sharedTweet?.photos, "shared", "인용/리트윗");
  appendVideoOptions(options, tweet.sharedTweet?.videos, "shared", "인용/리트윗");

  if (Array.isArray(tweet.replyChain)) {
    tweet.replyChain.forEach((replyTweet, replyIndex) => {
      appendPhotoOptions(
        options,
        replyTweet?.photos,
        `reply-${replyIndex}`,
        `답글 ${replyIndex + 1}`
      );
      appendVideoOptions(
        options,
        replyTweet?.videos,
        `reply-${replyIndex}`,
        `답글 ${replyIndex + 1}`
      );
    });
  }

  return options;
}

function appendPhotoOptions(target, photos, contextKey, prefixLabel) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return;
  }
  photos.forEach((_photo, index) => {
    target.push({
      key: `${contextKey}-photo-${index}`,
      kind: "photo",
      label: `${prefixLabel} 이미지 ${index + 1}`
    });
  });
}

function appendVideoOptions(target, videos, contextKey, prefixLabel) {
  if (!Array.isArray(videos) || videos.length === 0) {
    return;
  }
  videos.forEach((video, index) => {
    const isGif = Boolean(video && video.isGif);
    target.push({
      key: `${contextKey}-video-${index}`,
      kind: "video",
      label: `${prefixLabel} ${isGif ? "GIF" : "영상"} ${index + 1}`
    });
  });
}

function applyMediaSelectionDefaults(nextOptions) {
  const nextSelection = new Map();
  nextOptions.forEach((option) => {
    const prev = mediaSelectionByKey.get(option.key);
    nextSelection.set(option.key, prev !== false);
  });
  mediaSelectionByKey = nextSelection;
}

function renderMediaPicker() {
  if (!mediaPickerWrap || !mediaPickerList) {
    return;
  }
  mediaPickerList.replaceChildren();
  if (!Array.isArray(mediaOptions) || mediaOptions.length === 0) {
    mediaPickerWrap.hidden = true;
    mediaPickerWrap.classList.remove("is-disabled");
    return;
  }

  mediaOptions.forEach((option) => {
    const row = document.createElement("label");
    row.className = "media-picker-item";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = mediaSelectionByKey.get(option.key) !== false;
    input.disabled = !includeMediaInput.checked;
    input.addEventListener("change", () => {
      mediaSelectionByKey.set(option.key, input.checked);
      scheduleAutoUpdate(true);
    });

    const text = document.createElement("span");
    text.textContent = option.label;

    row.append(input, text);
    mediaPickerList.append(row);
  });

  mediaPickerWrap.hidden = false;
  applyMediaPickerDisabledState();
}

function applyMediaPickerDisabledState() {
  if (!mediaPickerWrap || !mediaPickerList || mediaPickerWrap.hidden) {
    return;
  }
  const isDisabled = !includeMediaInput.checked;
  mediaPickerWrap.classList.toggle("is-disabled", isDisabled);
  const inputs = mediaPickerList.querySelectorAll("input[type='checkbox']");
  inputs.forEach((input) => {
    input.disabled = isDisabled;
  });
}

function clearMediaPicker() {
  mediaFetchSequence += 1;
  mediaTweetId = "";
  mediaOptions = [];
  mediaSelectionByKey = new Map();
  if (mediaFetchController) {
    mediaFetchController.abort();
    mediaFetchController = null;
  }
  if (mediaPickerWrap) {
    mediaPickerWrap.hidden = true;
    mediaPickerWrap.classList.remove("is-disabled");
  }
  if (mediaPickerList) {
    mediaPickerList.replaceChildren();
  }
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function updateFontSizeLabels() {
  if (bodyFontSizeValue) {
    const bodyValue = clampNumber(Number(bodyFontSizeInput.value), 60, 180, 105);
    bodyFontSizeValue.textContent = `${bodyValue}%`;
  }
  if (uiFontSizeValue) {
    const uiValue = clampNumber(Number(uiFontSizeInput.value), 60, 180, 95);
    uiFontSizeValue.textContent = `${uiValue}%`;
  }
}

function resolveRenderWidth(settings) {
  if (settings.ratio === "mobile") {
    return clampNumber(Math.round(settings.width * 0.5), 390, 560, 540);
  }
  return settings.width;
}

function resolveCaptureScale(settings, renderWidth) {
  if (!settings || !renderWidth) {
    return WYSIWYG_CAPTURE_SCALE;
  }
  return WYSIWYG_CAPTURE_SCALE;
}

function clampFloat(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function normalizeManualText(value) {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }
  return normalized.slice(0, 2000);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseFilenameFromDisposition(disposition) {
  if (typeof disposition !== "string" || disposition.trim() === "") {
    return "";
  }
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }
  const plainMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  if (plainMatch && plainMatch[1]) {
    return plainMatch[1].trim();
  }
  return "";
}
