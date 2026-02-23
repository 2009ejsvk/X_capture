const FONT_PRESETS = Object.freeze({
  system: {
    main:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
    copy:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  },
  grotesk: {
    main: '"Space Grotesk", "IBM Plex Sans KR", "Segoe UI", sans-serif',
    copy: '"IBM Plex Sans KR", "Space Grotesk", "Segoe UI", sans-serif'
  },
  noto: {
    main: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", sans-serif',
    copy: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", sans-serif'
  }
});

function renderTweetDocument({
  tweet,
  width = 1080,
  theme = "paper",
  fontPreset = "system",
  locale = "ko-KR",
  bodyFontSize,
  uiFontSize,
  fontSize,
  options = {}
}) {
  const safeTheme = theme === "slate" ? "slate" : "paper";
  const clampedWidth = clampWidth(width);
  const numericLegacyFontSize = Number.isFinite(Number(fontSize))
    ? Number(fontSize)
    : null;
  const clampedBodyScale = clampFontScale(
    bodyFontSize ?? numericLegacyFontSize ?? 105,
    105
  );
  const clampedUiScale = clampFontScale(uiFontSize ?? numericLegacyFontSize ?? 95, 95);
  const fontTokens = resolveFontPreset(fontPreset);
  const renderOptions = normalizeRenderOptions(options);
  const selectedMediaKeySet = createSelectedMediaKeySet(
    renderOptions.selectedMediaKeys,
    renderOptions.mediaSelectionEnabled
  );
  const createdAt = formatDate(tweet.createdAt, locale);
  const authorHandle = tweet.author?.screenName ? `@${tweet.author.screenName}` : "";
  const sourceHtml = [createdAt, tweet.source].filter(Boolean).join(" · ");
  const manualTextHtml = renderOptions.manualText
    ? `<p class="manual-text">${formatPlainText(renderOptions.manualText)}</p>`
    : "";
  const avatarUrl = tweet.author?.avatarUrl ? escapeHtml(tweet.author.avatarUrl) : "";
  const mediaHtml = renderMediaBlock(
    {
      photos: tweet.photos || [],
      videos: tweet.videos || [],
      article: tweet.article || null
    },
    renderOptions.includeMedia,
    renderOptions.stackMultiPhoto,
    renderOptions.stackPhotoGap,
    "main",
    selectedMediaKeySet
  );
  const sharedBlocks = renderSharedTweet({
    sharedTweet: tweet.sharedTweet,
    locale,
    includeSharedTweet: renderOptions.includeSharedTweet,
    includeSharedMedia: renderOptions.includeSharedMedia,
    separateShared: renderOptions.separateShared,
    stackMultiPhoto: renderOptions.stackMultiPhoto,
    stackPhotoGap: renderOptions.stackPhotoGap,
    selectedMediaKeySet
  });
  const replyThreadHtml = renderReplyThread({
    replyChain: tweet.replyChain || [],
    locale,
    includeReplyThread: renderOptions.includeReplyThread,
    includeMedia: renderOptions.includeMedia,
    stackMultiPhoto: renderOptions.stackMultiPhoto,
    stackPhotoGap: renderOptions.stackPhotoGap,
    selectedMediaKeySet
  });
  const metricsHtml = renderMetrics(tweet.stats || {}, locale);

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>트윗 카드</title>
  <style>
    :root {
      --font-main: ${fontTokens.main};
      --font-copy: ${fontTokens.copy};
      --paper-card: #ffffff;
      --paper-line: #dde5ef;
      --paper-text: #101820;
      --paper-sub: #5a6777;
      --paper-link: #0f6892;
      --paper-chip: #f4f7fb;
      --slate-card: #111d2d;
      --slate-line: #273c57;
      --slate-text: #eef3ff;
      --slate-sub: #9fb0c7;
      --slate-link: #8ac9ff;
      --slate-chip: #1a2b42;
      --font-body-scale: ${clampedBodyScale};
      --font-ui-scale: ${clampedUiScale};
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 24px;
      background: #f3f6fb;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      color: var(--paper-text);
      font-family: var(--font-main);
    }

    body.theme-slate {
      background: #0b1626;
      color: var(--slate-text);
    }

    #capture-root {
      width: ${clampedWidth}px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .tweet-card {
      width: 100%;
      border-radius: 0;
      background: var(--paper-card);
      border: 1px solid var(--paper-line);
      box-shadow: 0 16px 36px rgba(17, 33, 52, 0.12);
      overflow: hidden;
    }

    body.theme-slate .tweet-card {
      background: var(--slate-card);
      border-color: var(--slate-line);
      box-shadow: 0 16px 36px rgba(0, 7, 16, 0.5);
    }

    .shared-card,
    body.theme-slate .shared-card {
      background: #ffffff;
      border-color: #d8e1eb;
      color: #101820;
    }

    .reply-card {
      box-shadow: none;
    }

    .reply-card .inner {
      padding: 20px 24px;
    }

    .inner {
      padding: 24px;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 0;
      object-fit: cover;
      background: #dfe7f2;
      flex: 0 0 auto;
    }

    .author {
      min-width: 0;
    }

    .author-name {
      font-family: var(--font-main);
      font-size: calc(1.05rem * var(--font-ui-scale));
      font-weight: 700;
      line-height: 1.2;
      word-break: break-word;
    }

    .author-handle {
      margin-top: 2px;
      font-size: calc(0.9rem * var(--font-ui-scale));
      color: var(--paper-sub);
    }

    body.theme-slate .author-handle {
      color: var(--slate-sub);
    }

    .tweet-text {
      margin: 16px 0 0;
      white-space: normal;
      overflow-wrap: anywhere;
      font-family: var(--font-copy);
      font-size: calc(1.03rem * var(--font-body-scale));
      font-weight: 500;
      line-height: 1.62;
      letter-spacing: 0;
    }

    .tweet-text a {
      color: var(--paper-link);
      text-decoration: none;
      border-bottom: 1px solid rgba(15, 104, 146, 0.35);
    }

    body.theme-slate .tweet-text a {
      color: var(--slate-link);
      border-bottom-color: rgba(138, 201, 255, 0.4);
    }

    .manual-text {
      margin: 10px 0 0;
      padding-left: 10px;
      border-left: 3px solid var(--paper-line);
      color: var(--paper-sub);
      font-family: var(--font-copy);
      font-size: calc(0.93rem * var(--font-body-scale));
      font-weight: 500;
      line-height: 1.58;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    body.theme-slate .manual-text {
      border-left-color: var(--slate-line);
      color: var(--slate-sub);
    }

    .meta {
      margin: 12px 0 0;
      color: var(--paper-sub);
      font-family: var(--font-copy);
      font-size: calc(0.82rem * var(--font-ui-scale));
      font-weight: 500;
      line-height: 1.4;
    }

    body.theme-slate .meta {
      color: var(--slate-sub);
    }

    .media-grid {
      margin-top: 14px;
      display: grid;
      gap: 6px;
      border-radius: 0;
      overflow: hidden;
    }

    .media-grid.count-1 {
      grid-template-columns: 1fr;
    }

    .media-grid.count-2,
    .media-grid.count-3,
    .media-grid.count-4 {
      grid-template-columns: 1fr 1fr;
    }

    .media-grid.count-3 .media-item:first-child {
      grid-row: span 2;
    }

    .media-grid.media-grid-vertical {
      grid-template-columns: 1fr;
    }

    .media-grid.media-grid-vertical.media-grid-vertical-tight {
      gap: 0;
    }

    .media-grid.media-grid-vertical .media-item {
      min-height: 220px;
    }

    .media-item {
      min-height: 160px;
      background: var(--paper-chip);
      position: relative;
      overflow: hidden;
    }

    body.theme-slate .media-item {
      background: var(--slate-chip);
    }

    .media-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .video-badge {
      position: absolute;
      right: 10px;
      bottom: 10px;
      padding: 4px 8px;
      border-radius: 0;
      color: #fff;
      background: rgba(0, 0, 0, 0.65);
      font-family: var(--font-main);
      font-size: calc(0.74rem * var(--font-ui-scale));
      font-weight: 700;
      line-height: 1;
    }

    .article {
      margin-top: 12px;
      border: 1px solid var(--paper-line);
      border-radius: 0;
      overflow: hidden;
      background: var(--paper-card);
    }

    body.theme-slate .article {
      border-color: var(--slate-line);
      background: var(--slate-card);
    }

    .article-cover {
      width: 100%;
      max-height: 240px;
      object-fit: cover;
      display: block;
      background: var(--paper-chip);
    }

    body.theme-slate .article-cover {
      background: var(--slate-chip);
    }

    .article-body {
      padding: 11px 12px 12px;
    }

    .article-title {
      margin: 0;
      font-family: var(--font-main);
      font-size: calc(0.92rem * var(--font-ui-scale));
      font-weight: 700;
      line-height: 1.4;
    }

    .article-preview {
      margin: 6px 0 0;
      color: var(--paper-sub);
      font-family: var(--font-copy);
      font-size: calc(0.83rem * var(--font-ui-scale));
      font-weight: 500;
      line-height: 1.45;
    }

    body.theme-slate .article-preview {
      color: var(--slate-sub);
    }

    .shared {
      margin-top: 14px;
      border: 1px solid #d8e1eb;
      border-radius: 0;
      padding: 12px;
      background: #ffffff;
      color: #101820;
    }

    body.theme-slate .shared {
      border-color: #d8e1eb;
      background: #ffffff;
      color: #101820;
    }

    .shared .header,
    .shared-card .header {
      margin-top: 0;
    }

    .shared .avatar,
    .shared-card .avatar {
      width: 36px;
      height: 36px;
    }

    .shared .author-name,
    .shared-card .author-name {
      font-size: calc(0.94rem * var(--font-ui-scale));
    }

    .shared .author-handle,
    .shared-card .author-handle {
      font-size: calc(0.81rem * var(--font-ui-scale));
    }

    .shared .tweet-text,
    .shared-card .tweet-text {
      margin-top: 10px;
      font-size: calc(0.95rem * var(--font-body-scale));
    }

    .shared .meta,
    .shared-card .meta {
      margin-top: 8px;
      font-size: calc(0.76rem * var(--font-ui-scale));
    }

    .shared .author-handle,
    .shared .meta,
    .shared-card .author-handle,
    .shared-card .meta {
      color: #5f6b79;
    }

    .shared .tweet-text a,
    .shared-card .tweet-text a {
      color: #0f6892;
      border-bottom-color: rgba(15, 104, 146, 0.35);
    }

    .shared-card .media-item,
    body.theme-slate .shared-card .media-item {
      background: #f4f7fb;
    }

    .shared-card .article,
    body.theme-slate .shared-card .article {
      border-color: #d8e1eb;
      background: #ffffff;
    }

    .shared-card .article-cover,
    body.theme-slate .shared-card .article-cover {
      background: #f4f7fb;
    }

    .metrics {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid var(--paper-line);
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      column-gap: 8px;
    }

    body.theme-slate .metrics {
      border-top-color: var(--slate-line);
    }

    .metric-action {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-width: 0;
      padding: 3px 0;
      font-family: var(--font-main);
      font-size: calc(0.8rem * var(--font-ui-scale));
      font-weight: 600;
      line-height: 1;
      color: #71767b;
    }

    body.theme-slate .metric-action {
      color: #ffffff;
    }

    .metric-icon {
      width: calc(1.05rem * var(--font-ui-scale));
      height: calc(1.05rem * var(--font-ui-scale));
      flex: 0 0 auto;
      fill: currentColor;
      opacity: 0.95;
    }

    .metric-value {
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body class="${safeTheme === "slate" ? "theme-slate" : "theme-paper"}">
  <main id="capture-root">
    ${replyThreadHtml}
    <section id="tweet-card" class="tweet-card">
      <div class="inner">
        <header class="header">
          ${avatarUrl ? `<img class="avatar" src="${avatarUrl}" alt="" />` : `<div class="avatar" aria-hidden="true"></div>`}
          <div class="author">
            <div class="author-name">${escapeHtml(tweet.author?.name || "Unknown")}</div>
            ${authorHandle ? `<div class="author-handle">${escapeHtml(authorHandle)}</div>` : ""}
          </div>
        </header>
        ${tweet.text ? `<p class="tweet-text">${formatTweetText(tweet.text)}</p>` : ""}
        ${manualTextHtml}
        ${mediaHtml}
        ${sharedBlocks.inlineHtml}
        ${sourceHtml ? `<p class="meta">${escapeHtml(sourceHtml)}</p>` : ""}
        ${metricsHtml}
      </div>
    </section>
    ${sharedBlocks.standaloneHtml}
  </main>
</body>
</html>`;
}

function resolveFontPreset(input) {
  if (typeof input !== "string") {
    return FONT_PRESETS.system;
  }
  return FONT_PRESETS[input] || FONT_PRESETS.system;
}

function normalizeRenderOptions(options) {
  return {
    includeMedia: options.includeMedia !== false,
    includeSharedTweet: options.includeSharedTweet !== false,
    includeSharedMedia: options.includeSharedMedia !== false,
    separateShared: options.separateShared === true,
    stackMultiPhoto: options.stackMultiPhoto === true,
    stackPhotoGap: options.stackPhotoGap !== false,
    includeReplyThread: options.includeReplyThread === true,
    selectedMediaKeys: normalizeSelectedMediaKeys(options.selectedMediaKeys),
    mediaSelectionEnabled: options.mediaSelectionEnabled === true,
    manualText: normalizeManualText(options.manualText)
  };
}

function renderSharedTweet({
  sharedTweet,
  locale,
  includeSharedTweet,
  includeSharedMedia,
  separateShared,
  stackMultiPhoto,
  stackPhotoGap,
  selectedMediaKeySet
}) {
  if (!includeSharedTweet || !sharedTweet) {
    return {
      inlineHtml: "",
      standaloneHtml: ""
    };
  }

  const authorHandle = sharedTweet.author?.screenName
    ? `@${sharedTweet.author.screenName}`
    : "";
  const source = [formatDate(sharedTweet.createdAt, locale), sharedTweet.source]
    .filter(Boolean)
    .join(" · ");
  const avatarUrl = sharedTweet.author?.avatarUrl
    ? escapeHtml(sharedTweet.author.avatarUrl)
    : "";
  const mediaHtml = renderMediaBlock(
    {
      photos: sharedTweet.photos || [],
      videos: sharedTweet.videos || [],
      article: sharedTweet.article || null
    },
    includeSharedMedia,
    stackMultiPhoto,
    stackPhotoGap,
    "shared",
    selectedMediaKeySet
  );

  const sharedCore = `
    <header class="header">
      ${avatarUrl ? `<img class="avatar" src="${avatarUrl}" alt="" />` : `<div class="avatar" aria-hidden="true"></div>`}
      <div class="author">
        <div class="author-name">${escapeHtml(sharedTweet.author?.name || "Unknown")}</div>
        ${authorHandle ? `<div class="author-handle">${escapeHtml(authorHandle)}</div>` : ""}
      </div>
    </header>
    ${sharedTweet.text ? `<p class="tweet-text">${formatTweetText(sharedTweet.text)}</p>` : ""}
    ${source ? `<p class="meta">${escapeHtml(source)}</p>` : ""}
    ${mediaHtml}
  `;

  if (separateShared) {
    return {
      inlineHtml: "",
      standaloneHtml: `<section id="shared-card" class="tweet-card shared-card">
    <div class="inner">${sharedCore}</div>
  </section>`
    };
  }

  return {
    inlineHtml: `<section class="shared">${sharedCore}</section>`,
    standaloneHtml: ""
  };
}

function renderReplyThread({
  replyChain,
  locale,
  includeReplyThread,
  includeMedia,
  stackMultiPhoto,
  stackPhotoGap,
  selectedMediaKeySet
}) {
  if (!includeReplyThread || !Array.isArray(replyChain) || replyChain.length === 0) {
    return "";
  }

  return replyChain
    .map((replyTweet, replyIndex) => {
      const authorHandle = replyTweet.author?.screenName
        ? `@${replyTweet.author.screenName}`
        : "";
      const avatarUrl = replyTweet.author?.avatarUrl
        ? escapeHtml(replyTweet.author.avatarUrl)
        : "";
      const source = [formatDate(replyTweet.createdAt, locale), replyTweet.source]
        .filter(Boolean)
        .join(" · ");
      const mediaHtml = renderMediaBlock(
        {
          photos: replyTweet.photos || [],
          videos: replyTweet.videos || [],
          article: replyTweet.article || null
        },
        includeMedia,
        stackMultiPhoto,
        stackPhotoGap,
        `reply-${replyIndex}`,
        selectedMediaKeySet
      );

      return `<section class="tweet-card reply-card">
    <div class="inner">
      <header class="header">
        ${avatarUrl ? `<img class="avatar" src="${avatarUrl}" alt="" />` : `<div class="avatar" aria-hidden="true"></div>`}
        <div class="author">
          <div class="author-name">${escapeHtml(replyTweet.author?.name || "Unknown")}</div>
          ${authorHandle ? `<div class="author-handle">${escapeHtml(authorHandle)}</div>` : ""}
        </div>
      </header>
      ${replyTweet.text ? `<p class="tweet-text">${formatTweetText(replyTweet.text)}</p>` : ""}
      ${mediaHtml}
      ${source ? `<p class="meta">${escapeHtml(source)}</p>` : ""}
    </div>
  </section>`;
    })
    .join("");
}

function renderMediaBlock(
  media,
  includeMedia,
  stackMultiPhoto,
  stackPhotoGap,
  contextKey,
  selectedMediaKeySet
) {
  if (!includeMedia) {
    return "";
  }
  return [
    renderPhotoGrid(
      media.photos || [],
      stackMultiPhoto,
      stackPhotoGap,
      contextKey,
      selectedMediaKeySet
    ),
    renderVideoGrid(media.videos || [], contextKey, selectedMediaKeySet),
    renderArticle(media.article || null)
  ].join("");
}

function renderPhotoGrid(
  photos,
  stackMultiPhoto,
  stackPhotoGap,
  contextKey,
  selectedMediaKeySet
) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return "";
  }
  const selectedItems = photos
    .map((photo, index) => ({ photo, index }))
    .filter((entry) => isPhotoSelected(contextKey, entry.index, selectedMediaKeySet))
    .slice(0, 4);
  if (selectedItems.length === 0) {
    return "";
  }
  const countClass =
    stackMultiPhoto && selectedItems.length >= 2
      ? `media-grid-vertical${stackPhotoGap ? "" : " media-grid-vertical-tight"}`
      : `count-${Math.min(selectedItems.length, 4)}`;
  const html = selectedItems
    .map((entry) => {
      const photo = entry.photo;
      const url = escapeHtml(photo.url || "");
      if (!url) {
        return "";
      }
      return `<div class="media-item"><img src="${url}" alt="" /></div>`;
    })
    .join("");
  if (!html) {
    return "";
  }
  return `<section class="media-grid ${countClass}">${html}</section>`;
}

function renderVideoGrid(videos, contextKey, selectedMediaKeySet) {
  if (!Array.isArray(videos) || videos.length === 0) {
    return "";
  }
  const selectedItems = videos
    .map((video, index) => ({ video, index }))
    .filter((entry) => isVideoSelected(contextKey, entry.index, selectedMediaKeySet))
    .slice(0, 2);
  if (selectedItems.length === 0) {
    return "";
  }
  const items = selectedItems
    .map((entry) => {
      const video = entry.video;
      const thumb = escapeHtml(video.thumbnailUrl || "");
      if (!thumb) {
        return "";
      }
      return `<div class="media-item"><img src="${thumb}" alt="" /><span class="video-badge">영상</span></div>`;
    })
    .join("");
  if (!items) {
    return "";
  }
  return `<section class="media-grid count-${selectedItems.length > 1 ? 2 : 1}">${items}</section>`;
}

function renderArticle(article) {
  if (!article) {
    return "";
  }
  const title = escapeHtml(article.title || "");
  const preview = escapeHtml(article.previewText || "");
  const cover = escapeHtml(article.coverImage || "");
  if (!title && !preview && !cover) {
    return "";
  }
  return `<section class="article">
    ${cover ? `<img class="article-cover" src="${cover}" alt="" />` : ""}
    <div class="article-body">
      ${title ? `<p class="article-title">${title}</p>` : ""}
      ${preview ? `<p class="article-preview">${preview}</p>` : ""}
    </div>
  </section>`;
}

function normalizeSelectedMediaKeys(value) {
  const source =
    Array.isArray(value)
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? value.split(",")
        : [];
  if (source.length === 0) {
    return [];
  }
  const output = [];
  const seen = new Set();
  for (const key of source) {
    if (typeof key !== "string") {
      continue;
    }
    const normalized = key.trim();
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

function createSelectedMediaKeySet(keys, isEnabled) {
  if (!isEnabled) {
    return null;
  }
  if (!Array.isArray(keys)) {
    return new Set();
  }
  return new Set(keys);
}

function isPhotoSelected(contextKey, photoIndex, selectedMediaKeySet) {
  if (selectedMediaKeySet === null) {
    return true;
  }
  return selectedMediaKeySet.has(makePhotoSelectionKey(contextKey, photoIndex));
}

function makePhotoSelectionKey(contextKey, photoIndex) {
  return `${contextKey}-photo-${photoIndex}`;
}

function isVideoSelected(contextKey, videoIndex, selectedMediaKeySet) {
  if (selectedMediaKeySet === null) {
    return true;
  }
  return selectedMediaKeySet.has(makeVideoSelectionKey(contextKey, videoIndex));
}

function makeVideoSelectionKey(contextKey, videoIndex) {
  return `${contextKey}-video-${videoIndex}`;
}

function renderMetrics(stats, locale) {
  const formatter = new Intl.NumberFormat(locale || "ko-KR", {
    notation: "compact",
    maximumFractionDigits: 1
  });
  const entries = [
    { key: "reply", label: "댓글", value: stats.replies },
    { key: "retweet", label: "리트윗", value: stats.retweets },
    { key: "like", label: "좋아요", value: stats.likes },
    { key: "bookmark", label: "북마크", value: stats.bookmarks },
    { key: "view", label: "조회", value: stats.views }
  ].filter((entry) => typeof entry.value === "number");
  if (entries.length === 0) {
    return "";
  }
  return `<footer class="metrics">${entries
    .map((entry) => {
      const iconPath = getMetricIconPath(entry.key);
      const formatted = formatter.format(entry.value);
      return `<span class="metric-action" aria-label="${entry.label} ${formatted}">
        <svg viewBox="0 0 24 24" aria-hidden="true" class="metric-icon"><path d="${iconPath}"></path></svg>
        <span class="metric-value">${formatted}</span>
      </span>`;
    })
    .join("")}</footer>`;
}

function getMetricIconPath(metricKey) {
  if (metricKey === "reply") {
    return "M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z";
  }
  if (metricKey === "retweet") {
    return "M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z";
  }
  if (metricKey === "like") {
    return "M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z";
  }
  if (metricKey === "bookmark") {
    return "M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z";
  }
  return "M3 21V10h3v11H3zm7 0V3h3v18h-3zm7 0V7h3v14h-3z";
}

function formatTweetText(text) {
  const escaped = escapeHtml(String(text || ""));
  return escaped
    .replace(/(https?:\/\/[^\s<]+)/gi, (url) => {
      const safeUrl = escapeHtml(url);
      return `<a href="${safeUrl}">${escapeHtml(compactUrl(url))}</a>`;
    })
    .replace(/\n/g, "<br />");
}

function formatPlainText(text) {
  return escapeHtml(String(text || "")).replace(/\n/g, "<br />");
}

function compactUrl(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const compact = `${parsed.hostname}${parsed.pathname}`;
    if (compact.length <= 42) {
      return compact;
    }
    return `${compact.slice(0, 39)}...`;
  } catch {
    if (urlValue.length <= 42) {
      return urlValue;
    }
    return `${urlValue.slice(0, 39)}...`;
  }
}

function formatDate(value, locale) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(locale || "ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function clampWidth(inputWidth) {
  const number = Number(inputWidth);
  if (!Number.isFinite(number)) {
    return 1080;
  }
  return Math.min(1080, Math.max(420, Math.round(number)));
}

function clampFontScale(inputFontSize, fallbackPercent = 100) {
  const number = Number(inputFontSize);
  if (!Number.isFinite(number)) {
    return fallbackPercent / 100;
  }
  const clampedPercent = Math.min(180, Math.max(60, Math.round(number)));
  return clampedPercent / 100;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  renderTweetDocument
};
