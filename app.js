(function () {
  const elements = {
    tweetUrl: document.getElementById("tweetUrl"),
    fetchBtn: document.getElementById("fetchBtn"),
    statusText: document.getElementById("statusText"),
    authorName: document.getElementById("authorName"),
    authorHandle: document.getElementById("authorHandle"),
    tweetDate: document.getElementById("tweetDate"),
    tweetText: document.getElementById("tweetText"),
    replyCount: document.getElementById("replyCount"),
    retweetCount: document.getElementById("retweetCount"),
    likeCount: document.getElementById("likeCount"),
    bookmarkCount: document.getElementById("bookmarkCount"),
    imageInput: document.getElementById("imageInput"),
    mediaLayout: document.getElementById("mediaLayout"),
    showQuoteToggle: document.getElementById("showQuoteToggle"),
    showQuoteMediaToggle: document.getElementById("showQuoteMediaToggle"),
    removeImageBtn: document.getElementById("removeImageBtn"),
    resetBtn: document.getElementById("resetBtn"),
    captureBtn: document.getElementById("captureBtn"),
    captureArea: document.getElementById("captureArea"),
    previewAvatar: document.getElementById("previewAvatar"),
    previewAvatarImage: document.getElementById("previewAvatarImage"),
    previewAvatarInitial: document.getElementById("previewAvatarInitial"),
    previewName: document.getElementById("previewName"),
    previewHandle: document.getElementById("previewHandle"),
    previewRetweet: document.getElementById("previewRetweet"),
    previewRetweetAvatar: document.getElementById("previewRetweetAvatar"),
    previewRetweetText: document.getElementById("previewRetweetText"),
    previewReplyParent: document.getElementById("previewReplyParent"),
    previewReplyParentAvatar: document.getElementById("previewReplyParentAvatar"),
    previewReplyParentName: document.getElementById("previewReplyParentName"),
    previewReplyParentHandle: document.getElementById("previewReplyParentHandle"),
    previewReplyParentText: document.getElementById("previewReplyParentText"),
    previewReplyParentMedia: document.getElementById("previewReplyParentMedia"),
    previewQuote: document.getElementById("previewQuote"),
    previewQuoteAvatar: document.getElementById("previewQuoteAvatar"),
    previewQuoteName: document.getElementById("previewQuoteName"),
    previewQuoteHandle: document.getElementById("previewQuoteHandle"),
    previewQuoteText: document.getElementById("previewQuoteText"),
    previewQuoteMedia: document.getElementById("previewQuoteMedia"),
    previewDate: document.getElementById("previewDate"),
    previewText: document.getElementById("previewText"),
    previewMedia: document.getElementById("previewMedia"),
    previewReplyCount: document.getElementById("previewReplyCount"),
    previewRetweetCount: document.getElementById("previewRetweetCount"),
    previewLikeCount: document.getElementById("previewLikeCount"),
    previewBookmarkCount: document.getElementById("previewBookmarkCount"),
    previewSource: document.getElementById("previewSource"),
  };

  function formatNumericDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  function currentDateTimeLabel() {
    return formatNumericDateTime(new Date());
  }

  const compactCountFormatter = new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  function formatCountLabel(rawValue) {
    if (rawValue == null) {
      return "0";
    }

    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      if (rawValue < 1000) {
        return Math.round(rawValue).toLocaleString("ko-KR");
      }
      return compactCountFormatter.format(rawValue);
    }

    const text = String(rawValue).trim();
    if (!text) {
      return "0";
    }

    if (/^\d[\d,]*$/.test(text)) {
      const parsed = Number(text.replace(/,/g, ""));
      if (Number.isFinite(parsed)) {
        if (parsed < 1000) {
          return parsed.toLocaleString("ko-KR");
        }
        return compactCountFormatter.format(parsed);
      }
    }

    return text;
  }

  function createInitialState() {
    return {
      sourceUrl: "",
      authorName: "X User",
      authorHandle: "@x",
      retweetByName: "",
      retweetByHandle: "",
      retweetByProfileImageSrc: "",
      replyParentAuthorName: "",
      replyParentAuthorHandle: "",
      replyParentAuthorProfileImageSrc: "",
      replyParentText: "",
      replyParentDataUrls: [],
      quoteAuthorName: "",
      quoteAuthorHandle: "",
      quoteAuthorProfileImageSrc: "",
      quoteText: "",
      quoteDataUrls: [],
      replyCount: "0",
      retweetCount: "0",
      likeCount: "0",
      bookmarkCount: "0",
      showQuote: true,
      showQuoteMedia: true,
      tweetDate: currentDateTimeLabel(),
      tweetText: "캡처할 트윗 본문이 여기에 표시됩니다.",
      profileImageSrc: "",
      mediaLayout: "grid",
      imageDataUrls: [],
    };
  }

  const state = createInitialState();

  function setStatus(message, type) {
    elements.statusText.textContent = message || "";
    elements.statusText.classList.remove("is-error", "is-success");

    if (type === "error") {
      elements.statusText.classList.add("is-error");
    }

    if (type === "success") {
      elements.statusText.classList.add("is-success");
    }
  }

  function parseHandle(authorUrl, fallbackName) {
    try {
      const path = new URL(authorUrl).pathname;
      const segment = path.split("/").filter(Boolean)[0];
      if (segment) {
        return segment.startsWith("@") ? segment : `@${segment}`;
      }
    } catch (error) {
      // Intentionally ignored.
    }

    if (!fallbackName) {
      return "@x";
    }

    const compact = fallbackName.replace(/\s+/g, "");
    return compact.startsWith("@") ? compact : `@${compact}`;
  }

  function normalizeHandle(rawHandle, fallbackHandle) {
    const value = String(rawHandle || "").trim();
    if (!value) {
      if (typeof fallbackHandle === "undefined") {
        return "@x";
      }
      return String(fallbackHandle || "").trim();
    }
    return value.startsWith("@") ? value : `@${value}`;
  }

  function pickFirstNonEmpty(values) {
    for (const value of values) {
      if (value == null) {
        continue;
      }
      const text = String(value).trim();
      if (text) {
        return text;
      }
    }
    return "";
  }

  function pickVxCount(payload, variants) {
    if (!payload || typeof payload !== "object") {
      return "";
    }

    const metrics = payload.metrics && typeof payload.metrics === "object" ? payload.metrics : null;
    const publicMetrics = payload.public_metrics && typeof payload.public_metrics === "object"
      ? payload.public_metrics
      : null;

    const candidates = [];
    variants.forEach((key) => {
      candidates.push(payload[key]);
      if (metrics && key in metrics) {
        candidates.push(metrics[key]);
      }
      if (publicMetrics && key in publicMetrics) {
        candidates.push(publicMetrics[key]);
      }
    });

    return pickFirstNonEmpty(candidates);
  }

  function pickVxRetweetedPayload(payload) {
    const candidates = [
      payload && payload.retweeted_tweet,
      payload && payload.retweetedTweet,
      payload && payload.retweeted_status,
      payload && payload.retweetedStatus,
      payload && payload.retweet,
      payload && payload.retweet_status,
      payload && payload.original_tweet,
      payload && payload.originalTweet,
    ];

    for (const candidate of candidates) {
      if (candidate && typeof candidate === "object") {
        return candidate;
      }
    }

    return null;
  }

  function pickVxName(payload, fallbackName) {
    const value = pickFirstNonEmpty([
      payload && payload.user_name,
      payload && payload.display_name,
      payload && payload.user && payload.user.name,
      payload && payload.author && payload.author.name,
    ]);
    return value || fallbackName || "X User";
  }

  function pickVxHandle(payload, fallbackHandle) {
    const rawHandle = pickFirstNonEmpty([
      payload && payload.user_screen_name,
      payload && payload.user && payload.user.screen_name,
      payload && payload.user && payload.user.username,
      payload && payload.author && payload.author.screen_name,
      payload && payload.author && payload.author.username,
    ]);
    const fallback = typeof fallbackHandle === "undefined" ? "@x" : fallbackHandle;
    return normalizeHandle(rawHandle, fallback);
  }

  function pickVxProfileImage(payload) {
    const imageUrl = pickFirstNonEmpty([
      payload && payload.user_profile_image_url,
      payload && payload.user && payload.user.profile_image_url,
      payload && payload.author && payload.author.profile_image_url,
      payload && payload.author && payload.author.avatar_url,
    ]);
    return imageUrl ? imageUrl.replace("_normal", "_400x400") : "";
  }

  function pickVxText(payload) {
    return pickFirstNonEmpty([
      payload && payload.full_text,
      payload && payload.text,
      payload && payload.tweet_text,
      payload && payload.content && payload.content.text,
    ]).replace(/\r\n/g, "\n");
  }

  function pickVxTweetUrl(payload) {
    return pickFirstNonEmpty([
      payload && payload.tweetURL,
      payload && payload.tweetUrl,
      payload && payload.qrtURL,
      payload && payload.url,
      payload && payload.permalink,
    ]);
  }

  function pickVxQuotePayload(payload) {
    const candidates = [
      payload && payload.quote,
      payload && payload.quoted_tweet,
      payload && payload.quotedTweet,
      payload && payload.quoted_status,
      payload && payload.quotedStatus,
      payload && payload.quote_tweet,
      payload && payload.quoteTweet,
      payload && payload.qrt,
      payload && payload.qrt_tweet,
      payload && payload.qrtTweet,
    ];

    for (const candidate of candidates) {
      if (candidate && typeof candidate === "object") {
        return candidate;
      }
    }

    return null;
  }

  function pickReplyParentReference(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const candidates = [
      payload.replying_to_status,
      payload.replyingToStatus,
      payload.replyingToID,
      payload.replying_to_status_id,
      payload.replying_to_status_id_str,
      payload.in_reply_to_status_id,
      payload.in_reply_to_status_id_str,
      payload.reply && payload.reply.status,
    ];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      if (typeof candidate === "object") {
        return { payload: candidate };
      }

      const matched = String(candidate).match(/\d{5,}/);
      if (matched) {
        return { id: matched[0] };
      }
    }

    return null;
  }

  async function fetchRawTweetPayload(tweetId) {
    const idText = String(tweetId || "").trim();
    const matched = idText.match(/\d{5,}/);
    if (!matched) {
      throw new Error("유효한 트윗 ID가 아닙니다.");
    }

    const endpoints = [
      `https://api.fxtwitter.com/status/${matched[0]}`,
      `https://api.vxtwitter.com/status/${matched[0]}`,
    ];

    let payload = null;
    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          lastError = new Error(`보조 API 오류 (${response.status})`);
          continue;
        }

        const body = await response.json();
        const candidate = body && typeof body === "object" && body.tweet ? body.tweet : body;
        if (candidate && typeof candidate === "object" && (candidate.tweetID || candidate.id)) {
          payload = candidate;
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (!payload) {
      throw lastError || new Error("보조 API에서 트윗을 찾지 못했습니다.");
    }

    return payload;
  }

  async function resolveReplyParentPayload(contentPayload, fallbackPayload) {
    const references = [pickReplyParentReference(contentPayload), pickReplyParentReference(fallbackPayload)]
      .filter(Boolean);

    const triedIds = new Set();
    for (const reference of references) {
      if (reference.payload) {
        return reference.payload;
      }

      if (reference.id && !triedIds.has(reference.id)) {
        triedIds.add(reference.id);
        try {
          return await fetchRawTweetPayload(reference.id);
        } catch (error) {
          // 부모 트윗 조회 실패는 본문 렌더링을 막지 않는다.
        }
      }
    }

    return null;
  }

  function normalizeQuoteMeta(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const text = pickVxText(payload);
    const authorName = pickVxName(payload, "");
    const authorHandle = pickVxHandle(payload, "");
    const authorProfileImageUrl = pickVxProfileImage(payload);
    const sourceUrl = pickVxTweetUrl(payload);
    const imageUrls = pickVxImages(payload);

    if (!text && !authorName && !authorHandle && !authorProfileImageUrl && !sourceUrl && !imageUrls.length) {
      return null;
    }

    return {
      text,
      authorName,
      authorHandle,
      authorProfileImageUrl,
      sourceUrl,
      imageUrls,
    };
  }

  function normalizeReplyParentMeta(payload) {
    return normalizeQuoteMeta(payload);
  }

  function parseOembedHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html || "", "text/html");
    const blockquote = doc.querySelector("blockquote.twitter-tweet");
    const textNode = blockquote ? blockquote.querySelector("p") : null;
    const text = textNode ? extractTextPreserveSpaces(textNode).replace(/\r\n/g, "\n") : "";

    const linkNodes = blockquote ? [...blockquote.querySelectorAll("a")] : [];
    const dateNode = linkNodes.length ? linkNodes[linkNodes.length - 1] : null;
    const dateLabel = dateNode ? dateNode.textContent.trim() : "";

    return { text, dateLabel };
  }

  function extractTextPreserveSpaces(node) {
    if (!node) {
      return "";
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue || "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    if (node.tagName === "BR") {
      return "\n";
    }

    let output = "";
    node.childNodes.forEach((child) => {
      output += extractTextPreserveSpaces(child);
    });
    return output;
  }

  function normalizeUrl(input) {
    const urlText = (input || "").trim();
    if (!urlText) {
      throw new Error("트윗 URL을 입력해 주세요.");
    }

    let url;
    try {
      url = new URL(urlText);
    } catch (error) {
      throw new Error("URL 형식이 올바르지 않습니다.");
    }

    const host = url.hostname.replace(/^www\./i, "");
    const isXHost = host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com";
    if (!isXHost) {
      throw new Error("x.com 또는 twitter.com URL만 지원합니다.");
    }

    const idMatch = url.pathname.match(/\/status\/(\d+)/i);
    if (!idMatch) {
      throw new Error("트윗 상세 URL(/status/숫자) 형식만 지원합니다.");
    }

    const tweetId = idMatch[1];
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const statusIndex = pathSegments.findIndex((segment) => segment.toLowerCase() === "status");
    const beforeStatus = statusIndex > 0 ? (pathSegments[statusIndex - 1] || "").toLowerCase() : "";
    const isUserPath = beforeStatus && beforeStatus !== "i" && beforeStatus !== "web";

    // /photo/1, /video/1, /i/web/status/... 같은 변형 링크를 정규화한다.
    const preferredUrl = isUserPath
      ? `https://x.com/${pathSegments[statusIndex - 1]}/status/${tweetId}`
      : `https://x.com/i/status/${tweetId}`;

    return {
      tweetId,
      preferredUrl,
      canonicalUrl: `https://x.com/i/status/${tweetId}`,
      twitterCanonicalUrl: `https://twitter.com/i/status/${tweetId}`,
    };
  }

  async function dataUrlFromRemoteImage(imageUrl) {
    if (!imageUrl) {
      return "";
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return "";
      }

      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("이미지 변환 실패"));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      return "";
    }
  }

  async function toDisplayImageSrc(imageUrl) {
    if (!imageUrl) {
      return "";
    }

    const dataUrl = await dataUrlFromRemoteImage(imageUrl);
    return dataUrl || imageUrl;
  }

  async function toDisplayImageSrcs(imageUrls) {
    const uniqueUrls = [...new Set((Array.isArray(imageUrls) ? imageUrls : [])
      .map((url) => String(url || "").trim())
      .filter(Boolean))].slice(0, 4);

    if (!uniqueUrls.length) {
      return [];
    }

    const converted = await Promise.all(uniqueUrls.map(toDisplayImageSrc));
    return converted.filter(Boolean);
  }

  async function fetchOembed(url) {
    const endpoint = `https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      const error = new Error(`oEmbed 오류 (${response.status})`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  async function fetchTweetFromOembed(info) {
    const urls = [info.preferredUrl, info.canonicalUrl, info.twitterCanonicalUrl];
    let lastError = null;

    for (const url of urls) {
      try {
        const payload = await fetchOembed(url);
        return { payload, usedUrl: url };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("oEmbed 호출에 실패했습니다.");
  }

  function formatDateLabel(rawDate) {
    if (!rawDate) {
      return currentDateTimeLabel();
    }

    const normalizedRawDate = String(rawDate).trim();
    if (!normalizedRawDate) {
      return currentDateTimeLabel();
    }

    const parsed = new Date(normalizedRawDate);
    if (Number.isNaN(parsed.getTime())) {
      const candidates = [normalizedRawDate];
      const dotParts = normalizedRawDate
        .split("·")
        .map((part) => part.trim())
        .filter(Boolean);

      if (dotParts.length >= 2) {
        const left = dotParts[0];
        const right = dotParts.slice(1).join(" ");
        candidates.push(`${right} ${left}`);
        candidates.push(right);
      }

      for (const candidate of candidates) {
        const reparsed = new Date(candidate);
        if (!Number.isNaN(reparsed.getTime())) {
          return formatNumericDateTime(reparsed);
        }
      }

      return normalizedRawDate;
    }

    return formatNumericDateTime(parsed);
  }

  function isImageLikeUrl(url) {
    const value = String(url || "");
    return (
      /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(value) ||
      /[?&]format=(jpg|jpeg|png|webp|gif)(&|$)/i.test(value)
    );
  }

  function pickVxImages(payload) {
    const images = [];
    let videoThumbnail = "";

    const mediaEntries = payload && payload.media && Array.isArray(payload.media.all)
      ? payload.media.all
      : [];

    if (mediaEntries.length) {
      for (const media of mediaEntries) {
        if (!media) {
          continue;
        }

        const mediaType = String(media.type || "").toLowerCase();
        const mediaUrl = pickFirstNonEmpty([media.url, media.media_url, media.image_url]);
        const thumbnail = pickFirstNonEmpty([media.thumbnail_url, media.thumb_url]);

        if ((mediaType === "photo" || mediaType === "image") && mediaUrl) {
          images.push(mediaUrl);
          continue;
        }

        if (!videoThumbnail && (mediaType === "video" || mediaType === "gif")) {
          videoThumbnail = thumbnail || mediaUrl;
        }
      }
    }

    if (Array.isArray(payload.media_extended)) {
      for (const media of payload.media_extended) {
        if (!media) {
          continue;
        }

        if (media.type === "image" && (media.url || media.thumbnail_url)) {
          images.push(media.url || media.thumbnail_url);
          continue;
        }

        if (!videoThumbnail && (media.type === "video" || media.type === "gif") && media.thumbnail_url) {
          videoThumbnail = media.thumbnail_url;
        }
      }
    }

    if (!images.length && Array.isArray(payload.mediaURLs) && payload.mediaURLs.length) {
      const imageLikes = payload.mediaURLs.filter((url) => isImageLikeUrl(url));
      images.push(...imageLikes);
    }

    if (!images.length && Array.isArray(payload.imageURLs) && payload.imageURLs.length) {
      const imageLikes = payload.imageURLs.filter((url) => isImageLikeUrl(url));
      images.push(...imageLikes);
    }

    if (!images.length && Array.isArray(payload.photos) && payload.photos.length) {
      for (const media of payload.photos) {
        const mediaUrl = pickFirstNonEmpty([media && media.url, media && media.media_url]);
        if (mediaUrl) {
          images.push(mediaUrl);
        }
      }
    }

    if (!images.length && videoThumbnail) {
      images.push(videoThumbnail);
    }

    return [...new Set(images.map((url) => String(url || "").trim()).filter(Boolean))].slice(0, 4);
  }

  async function fetchTweetFromVx(tweetId) {
    const payload = await fetchRawTweetPayload(tweetId);

    const retweetedPayload = pickVxRetweetedPayload(payload);
    const contentPayload = retweetedPayload || payload;
    const quotePayload = pickVxQuotePayload(contentPayload) || pickVxQuotePayload(payload);
    const replyParentPayload = await resolveReplyParentPayload(contentPayload, payload);

    const retweeterName = pickVxName(payload, "X User");
    const retweeterHandle = pickVxHandle(payload, "@x");
    const retweeterProfileImageUrl = pickVxProfileImage(payload);

    let isRetweet =
      Boolean(retweetedPayload) ||
      Boolean(
        payload.retweetURL ||
        payload.retweetUrl ||
        payload.retweetID ||
        payload.retweetId ||
        payload.retweetUser ||
        payload.retweet_user ||
        payload.retweeted_tweet_id
      );

    let tweetText = pickVxText(contentPayload) || pickVxText(payload);
    const retweetTextMatch = tweetText.match(/^RT\s+@([A-Za-z0-9_]{1,15}):\s*([\s\S]*)$/);
    if (retweetTextMatch) {
      isRetweet = true;
      tweetText = retweetTextMatch[2] || tweetText;
    }

    const imageUrlsFromContent = pickVxImages(contentPayload);
    const imageUrlsFromPayload = pickVxImages(payload);
    const replyCountRaw = pickVxCount(contentPayload, ["replies", "reply_count", "replyCount"]) ||
      pickVxCount(payload, ["replies", "reply_count", "replyCount"]);
    const retweetCountRaw = pickVxCount(contentPayload, ["retweets", "retweet_count", "retweetCount"]) ||
      pickVxCount(payload, ["retweets", "retweet_count", "retweetCount"]);
    const likeCountRaw = pickVxCount(contentPayload, ["likes", "favorite_count", "favoriteCount", "favourites"]) ||
      pickVxCount(payload, ["likes", "favorite_count", "favoriteCount", "favourites"]);
    const bookmarkCountRaw = pickVxCount(contentPayload, ["bookmarks", "bookmark_count", "bookmarkCount"]) ||
      pickVxCount(payload, ["bookmarks", "bookmark_count", "bookmarkCount"]);
    const sourceUrl = pickVxTweetUrl(contentPayload) || pickFirstNonEmpty([
      payload.retweetURL,
      payload.retweetUrl,
      pickVxTweetUrl(payload),
    ]) || `https://x.com/i/status/${tweetId}`;

    return {
      sourceUrl,
      authorName: pickVxName(contentPayload, retweeterName),
      authorHandle: pickVxHandle(contentPayload, retweeterHandle),
      retweetByName: isRetweet ? retweeterName : "",
      retweetByHandle: isRetweet ? retweeterHandle : "",
      retweetByProfileImageUrl: isRetweet ? retweeterProfileImageUrl : "",
      tweetDate: formatDateLabel(payload.created_at || payload.createdAt || payload.date),
      tweetText,
      profileImageUrl: pickVxProfileImage(contentPayload) || retweeterProfileImageUrl,
      imageUrls: imageUrlsFromContent.length ? imageUrlsFromContent : imageUrlsFromPayload,
      replyCount: formatCountLabel(replyCountRaw),
      retweetCount: formatCountLabel(retweetCountRaw),
      likeCount: formatCountLabel(likeCountRaw),
      bookmarkCount: formatCountLabel(bookmarkCountRaw),
      quote: normalizeQuoteMeta(quotePayload),
      replyParent: normalizeReplyParentMeta(replyParentPayload),
    };
  }

  function formatOembedError(error) {
    if (error && typeof error === "object" && "status" in error) {
      const status = Number(error.status);
      if (status === 404) {
        return "oEmbed에서 트윗을 찾지 못했습니다.";
      }

      if (Number.isFinite(status)) {
        return `oEmbed 오류 (${status})`;
      }
    }

    return "oEmbed 네트워크 오류";
  }

  function applyStateToInputs() {
    elements.authorName.value = state.authorName;
    elements.authorHandle.value = state.authorHandle;
    elements.tweetDate.value = state.tweetDate;
    elements.tweetText.value = state.tweetText;
    elements.replyCount.value = state.replyCount;
    elements.retweetCount.value = state.retweetCount;
    elements.likeCount.value = state.likeCount;
    elements.bookmarkCount.value = state.bookmarkCount;
    elements.mediaLayout.value = state.mediaLayout;
    elements.showQuoteToggle.checked = Boolean(state.showQuote);
    elements.showQuoteMediaToggle.checked = Boolean(state.showQuoteMedia);
  }

  function renderPreview() {
    const trimmedName = state.authorName.trim() || "X User";
    const trimmedHandle = state.authorHandle.trim() || "@x";
    const handleWithPrefix = trimmedHandle.startsWith("@") ? trimmedHandle : `@${trimmedHandle}`;
    const retweetByName = state.retweetByName.trim();
    const retweetByHandle = normalizeHandle(state.retweetByHandle, "");

    elements.previewName.textContent = trimmedName;
    elements.previewHandle.textContent = handleWithPrefix;
    if (retweetByName || retweetByHandle) {
      const label = retweetByName || retweetByHandle;
      elements.previewRetweetText.textContent = `${label} 리트윗`;
      if (state.retweetByProfileImageSrc) {
        elements.previewRetweetAvatar.crossOrigin = "anonymous";
        elements.previewRetweetAvatar.referrerPolicy = "no-referrer";
        elements.previewRetweetAvatar.src = state.retweetByProfileImageSrc;
        elements.previewRetweetAvatar.classList.remove("hidden");
      } else {
        elements.previewRetweetAvatar.removeAttribute("src");
        elements.previewRetweetAvatar.classList.add("hidden");
      }
      elements.previewRetweet.classList.remove("hidden");
    } else {
      elements.previewRetweetText.textContent = "";
      elements.previewRetweetAvatar.removeAttribute("src");
      elements.previewRetweetAvatar.classList.add("hidden");
      elements.previewRetweet.classList.add("hidden");
    }
    elements.previewDate.textContent = state.tweetDate.trim() || currentDateTimeLabel();
    const rawText = String(state.tweetText || "").replace(/\r\n/g, "\n");
    elements.previewText.textContent = /\S/.test(rawText) ? rawText : "(본문 없음)";
    elements.previewReplyCount.textContent = state.replyCount.trim() || "0";
    elements.previewRetweetCount.textContent = state.retweetCount.trim() || "0";
    elements.previewLikeCount.textContent = state.likeCount.trim() || "0";
    elements.previewBookmarkCount.textContent = state.bookmarkCount.trim() || "0";
    const initial = trimmedName.charAt(0).toUpperCase();
    elements.previewAvatarInitial.textContent = initial || "X";
    if (state.profileImageSrc) {
      elements.previewAvatarImage.crossOrigin = "anonymous";
      elements.previewAvatarImage.referrerPolicy = "no-referrer";
      elements.previewAvatarImage.src = state.profileImageSrc;
      elements.previewAvatarImage.classList.remove("hidden");
      elements.previewAvatarInitial.classList.add("hidden");
    } else {
      elements.previewAvatarImage.removeAttribute("src");
      elements.previewAvatarImage.classList.add("hidden");
      elements.previewAvatarInitial.classList.remove("hidden");
    }

    if (
      elements.previewReplyParent &&
      elements.previewReplyParentAvatar &&
      elements.previewReplyParentName &&
      elements.previewReplyParentHandle &&
      elements.previewReplyParentText &&
      elements.previewReplyParentMedia
    ) {
      const parentName = state.replyParentAuthorName.trim();
      const parentHandle = normalizeHandle(state.replyParentAuthorHandle, "");
      const parentAvatarSrc = String(state.replyParentAuthorProfileImageSrc || "").trim();
      const parentText = String(state.replyParentText || "").replace(/\r\n/g, "\n").trim();
      const parentMedia = Array.isArray(state.replyParentDataUrls) ? state.replyParentDataUrls.filter(Boolean).slice(0, 4) : [];
      const parentVisible = Boolean(parentName || parentHandle || parentAvatarSrc || parentText || parentMedia.length);

      elements.previewReplyParentMedia.innerHTML = "";
      if (parentMedia.length) {
        elements.previewReplyParentMedia.dataset.count = String(parentMedia.length);
        elements.previewReplyParentMedia.classList.remove("hidden");
        parentMedia.forEach((src, index) => {
          const image = document.createElement("img");
          image.className = "quote-image";
          image.alt = `원본 트윗 이미지 ${index + 1}`;
          image.loading = "lazy";
          image.referrerPolicy = "no-referrer";
          image.crossOrigin = "anonymous";
          image.src = src;
          elements.previewReplyParentMedia.appendChild(image);
        });
      } else {
        elements.previewReplyParentMedia.classList.add("hidden");
        elements.previewReplyParentMedia.removeAttribute("data-count");
      }

      if (parentVisible) {
        if (parentAvatarSrc) {
          elements.previewReplyParentAvatar.crossOrigin = "anonymous";
          elements.previewReplyParentAvatar.referrerPolicy = "no-referrer";
          elements.previewReplyParentAvatar.src = parentAvatarSrc;
          elements.previewReplyParentAvatar.classList.remove("hidden");
        } else {
          elements.previewReplyParentAvatar.removeAttribute("src");
          elements.previewReplyParentAvatar.classList.add("hidden");
        }

        elements.previewReplyParentName.textContent = parentName || "원본";
        elements.previewReplyParentHandle.textContent = parentHandle || "";
        elements.previewReplyParentText.textContent = parentText || "(본문 없음)";
        elements.previewReplyParent.classList.remove("hidden");
      } else {
        elements.previewReplyParentAvatar.removeAttribute("src");
        elements.previewReplyParentAvatar.classList.add("hidden");
        elements.previewReplyParentName.textContent = "";
        elements.previewReplyParentHandle.textContent = "";
        elements.previewReplyParentText.textContent = "";
        elements.previewReplyParent.classList.add("hidden");
      }
    }

    elements.previewMedia.innerHTML = "";
    const mediaItems = Array.isArray(state.imageDataUrls) ? state.imageDataUrls.filter(Boolean).slice(0, 4) : [];
    if (mediaItems.length) {
      elements.previewMedia.dataset.count = String(mediaItems.length);
      elements.previewMedia.dataset.layout = mediaItems.length >= 2 ? state.mediaLayout : "single";
      elements.previewMedia.classList.remove("hidden");

      mediaItems.forEach((src, index) => {
        const image = document.createElement("img");
        image.className = "tweet-image";
        image.alt = `트윗 첨부 이미지 ${index + 1}`;
        image.loading = index === 0 ? "eager" : "lazy";
        image.referrerPolicy = "no-referrer";
        image.crossOrigin = "anonymous";
        image.src = src;
        elements.previewMedia.appendChild(image);
      });
    } else {
      elements.previewMedia.classList.add("hidden");
      elements.previewMedia.removeAttribute("data-count");
      elements.previewMedia.removeAttribute("data-layout");
    }

    if (
      elements.previewQuote &&
      elements.previewQuoteAvatar &&
      elements.previewQuoteName &&
      elements.previewQuoteHandle &&
      elements.previewQuoteText &&
      elements.previewQuoteMedia
    ) {
      const quoteName = state.quoteAuthorName.trim();
      const quoteHandle = normalizeHandle(state.quoteAuthorHandle, "");
      const quoteAuthorProfileImageSrc = String(state.quoteAuthorProfileImageSrc || "").trim();
      const quoteText = String(state.quoteText || "").replace(/\r\n/g, "\n").trim();
      const quoteMedia = Array.isArray(state.quoteDataUrls) ? state.quoteDataUrls.filter(Boolean).slice(0, 4) : [];
      const showQuote = Boolean(state.showQuote);
      const showQuoteMedia = Boolean(state.showQuoteMedia);
      const hasQuoteText = Boolean(quoteName || quoteHandle || quoteText);
      const hasQuoteMedia = Boolean(quoteMedia.length);
      const quoteVisible = showQuote && (hasQuoteText || quoteAuthorProfileImageSrc || (showQuoteMedia && hasQuoteMedia));

      elements.previewQuoteMedia.innerHTML = "";
      if (showQuoteMedia && quoteMedia.length) {
        elements.previewQuoteMedia.dataset.count = String(quoteMedia.length);
        elements.previewQuoteMedia.classList.remove("hidden");
        quoteMedia.forEach((src, index) => {
          const image = document.createElement("img");
          image.className = "quote-image";
          image.alt = `인용 트윗 이미지 ${index + 1}`;
          image.loading = "lazy";
          image.referrerPolicy = "no-referrer";
          image.crossOrigin = "anonymous";
          image.src = src;
          elements.previewQuoteMedia.appendChild(image);
        });
      } else {
        elements.previewQuoteMedia.classList.add("hidden");
        elements.previewQuoteMedia.removeAttribute("data-count");
      }

      if (quoteVisible) {
        if (quoteAuthorProfileImageSrc) {
          elements.previewQuoteAvatar.crossOrigin = "anonymous";
          elements.previewQuoteAvatar.referrerPolicy = "no-referrer";
          elements.previewQuoteAvatar.src = quoteAuthorProfileImageSrc;
          elements.previewQuoteAvatar.classList.remove("hidden");
        } else {
          elements.previewQuoteAvatar.removeAttribute("src");
          elements.previewQuoteAvatar.classList.add("hidden");
        }
        elements.previewQuoteName.textContent = quoteName || "원문";
        elements.previewQuoteHandle.textContent = quoteHandle || "";
        elements.previewQuoteText.textContent = quoteText || "(본문 없음)";
        elements.previewQuote.classList.remove("hidden");
      } else {
        elements.previewQuoteAvatar.removeAttribute("src");
        elements.previewQuoteAvatar.classList.add("hidden");
        elements.previewQuoteName.textContent = "";
        elements.previewQuoteHandle.textContent = "";
        elements.previewQuoteText.textContent = "";
        elements.previewQuote.classList.add("hidden");
      }
    }

    if (state.sourceUrl) {
      try {
        const host = new URL(state.sourceUrl).host;
        elements.previewSource.textContent = host.replace(/^www\./i, "");
      } catch (error) {
        elements.previewSource.textContent = "x.com";
      }
    } else {
      elements.previewSource.textContent = "x.com";
    }
  }

  function syncFromEditors() {
    state.authorName = elements.authorName.value;
    state.authorHandle = elements.authorHandle.value;
    state.tweetDate = elements.tweetDate.value;
    state.tweetText = elements.tweetText.value;
    state.replyCount = elements.replyCount.value;
    state.retweetCount = elements.retweetCount.value;
    state.likeCount = elements.likeCount.value;
    state.bookmarkCount = elements.bookmarkCount.value;
    state.mediaLayout = elements.mediaLayout.value === "vertical" ? "vertical" : "grid";
    state.showQuote = Boolean(elements.showQuoteToggle.checked);
    state.showQuoteMedia = Boolean(elements.showQuoteMediaToggle.checked);
    renderPreview();
  }

  async function onFetchClick() {
    try {
      elements.fetchBtn.disabled = true;
      setStatus("트윗 정보를 가져오는 중...");

      const normalized = normalizeUrl(elements.tweetUrl.value);
      let imageUrls = [];
      let profileImageUrl = "";
      let retweetProfileImageUrl = "";
      let quoteMeta = null;
      let replyParentMeta = null;
      let usedFallback = false;

      try {
        const result = await fetchTweetFromOembed(normalized);
        const payload = result.payload;
        const parsed = parseOembedHtml(payload.html);
        let vxText = "";

        state.sourceUrl = payload.url || result.usedUrl || normalized.canonicalUrl;
        state.authorName = (payload.author_name || "").trim() || "X User";
        state.authorHandle = parseHandle(payload.author_url || "", payload.author_name || "x");
        state.retweetByName = "";
        state.retweetByHandle = "";
        state.retweetByProfileImageSrc = "";
        state.replyParentAuthorName = "";
        state.replyParentAuthorHandle = "";
        state.replyParentAuthorProfileImageSrc = "";
        state.replyParentText = "";
        state.replyParentDataUrls = [];
        state.quoteAuthorName = "";
        state.quoteAuthorHandle = "";
        state.quoteAuthorProfileImageSrc = "";
        state.quoteText = "";
        state.quoteDataUrls = [];
        state.replyCount = "0";
        state.retweetCount = "0";
        state.likeCount = "0";
        state.bookmarkCount = "0";
        state.tweetDate = formatDateLabel(payload.date || parsed.dateLabel);
        state.tweetText = parsed.text || "본문을 가져오지 못했습니다. 직접 입력해 주세요.";
        imageUrls = payload.thumbnail_url ? [payload.thumbnail_url] : [];

        try {
          const vxMeta = await fetchTweetFromVx(normalized.tweetId);
          vxText = vxMeta.tweetText || "";
          if (vxText) {
            state.tweetText = vxText;
          }
          if (vxMeta.profileImageUrl) {
            profileImageUrl = vxMeta.profileImageUrl;
          }
          if (Array.isArray(vxMeta.imageUrls) && vxMeta.imageUrls.length) {
            imageUrls = vxMeta.imageUrls;
          }
          if (vxMeta.authorName) {
            state.authorName = vxMeta.authorName;
          }
          if (vxMeta.authorHandle) {
            state.authorHandle = vxMeta.authorHandle;
          }
          state.retweetByName = vxMeta.retweetByName || "";
          state.retweetByHandle = vxMeta.retweetByHandle || "";
          retweetProfileImageUrl = vxMeta.retweetByProfileImageUrl || "";
          state.replyCount = vxMeta.replyCount || "0";
          state.retweetCount = vxMeta.retweetCount || "0";
          state.likeCount = vxMeta.likeCount || "0";
          state.bookmarkCount = vxMeta.bookmarkCount || "0";
          if (vxMeta.tweetDate) {
            state.tweetDate = vxMeta.tweetDate;
          }
          if (vxMeta.sourceUrl) {
            state.sourceUrl = vxMeta.sourceUrl;
          }
          quoteMeta = vxMeta.quote || null;
          replyParentMeta = vxMeta.replyParent || null;
        } catch (error) {
          // oEmbed 본문은 이미 가져왔으므로 이미지 보강 실패는 무시한다.
        }
      } catch (oembedError) {
        const fallback = await fetchTweetFromVx(normalized.tweetId);
        usedFallback = true;

        state.sourceUrl = fallback.sourceUrl || normalized.canonicalUrl;
        state.authorName = fallback.authorName;
        state.authorHandle = fallback.authorHandle;
        state.retweetByName = fallback.retweetByName || "";
        state.retweetByHandle = fallback.retweetByHandle || "";
        retweetProfileImageUrl = fallback.retweetByProfileImageUrl || "";
        state.tweetDate = fallback.tweetDate;
        state.tweetText = fallback.tweetText;
        state.replyCount = fallback.replyCount || "0";
        state.retweetCount = fallback.retweetCount || "0";
        state.likeCount = fallback.likeCount || "0";
        state.bookmarkCount = fallback.bookmarkCount || "0";
        profileImageUrl = fallback.profileImageUrl || "";
        imageUrls = Array.isArray(fallback.imageUrls) ? fallback.imageUrls : [];
        quoteMeta = fallback.quote || null;
        replyParentMeta = fallback.replyParent || null;
        setStatus(`${formatOembedError(oembedError)} 보조 경로로 불러왔습니다.`);
      }

      const [
        profileImageSrc,
        retweetByProfileImageSrc,
        quoteAuthorProfileImageSrc,
        replyParentAuthorProfileImageSrc,
        mainImages,
        quoteImages,
        replyParentImages,
      ] = await Promise.all([
        toDisplayImageSrc(profileImageUrl),
        toDisplayImageSrc(retweetProfileImageUrl),
        toDisplayImageSrc(quoteMeta ? quoteMeta.authorProfileImageUrl : ""),
        toDisplayImageSrc(replyParentMeta ? replyParentMeta.authorProfileImageUrl : ""),
        toDisplayImageSrcs(imageUrls),
        toDisplayImageSrcs(quoteMeta && Array.isArray(quoteMeta.imageUrls) ? quoteMeta.imageUrls : []),
        toDisplayImageSrcs(replyParentMeta && Array.isArray(replyParentMeta.imageUrls) ? replyParentMeta.imageUrls : []),
      ]);

      state.profileImageSrc = profileImageSrc;
      state.retweetByProfileImageSrc = retweetByProfileImageSrc;
      state.imageDataUrls = mainImages;
      state.quoteAuthorName = quoteMeta ? (quoteMeta.authorName || "") : "";
      state.quoteAuthorHandle = quoteMeta ? (quoteMeta.authorHandle || "") : "";
      state.quoteAuthorProfileImageSrc = quoteMeta ? quoteAuthorProfileImageSrc : "";
      state.quoteText = quoteMeta ? (quoteMeta.text || "") : "";
      state.quoteDataUrls = quoteImages;
      state.replyParentAuthorName = replyParentMeta ? (replyParentMeta.authorName || "") : "";
      state.replyParentAuthorHandle = replyParentMeta ? (replyParentMeta.authorHandle || "") : "";
      state.replyParentAuthorProfileImageSrc = replyParentMeta ? replyParentAuthorProfileImageSrc : "";
      state.replyParentText = replyParentMeta ? (replyParentMeta.text || "") : "";
      state.replyParentDataUrls = replyParentImages;

      applyStateToInputs();
      renderPreview();
      if (usedFallback) {
        setStatus("불러오기 완료(보조 경로). 필요하면 내용을 수정하고 저장하세요.", "success");
      } else {
        setStatus("불러오기 완료. 필요하면 내용을 수정하고 저장하세요.", "success");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.", "error");
    } finally {
      elements.fetchBtn.disabled = false;
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });
  }

  async function onImageSelected(event) {
    const files = Array.from(event.target.files || []).slice(0, 4);
    if (!files.length) {
      return;
    }

    try {
      const loaded = await Promise.all(files.map(readFileAsDataUrl));
      state.imageDataUrls = loaded.filter(Boolean);
      renderPreview();
      setStatus(`${state.imageDataUrls.length}장 이미지 반영 완료.`, "success");
    } catch (error) {
      setStatus("이미지를 반영하지 못했습니다.", "error");
    }
  }

  function onRemoveImage() {
    state.imageDataUrls = [];
    elements.imageInput.value = "";
    renderPreview();
    setStatus("이미지를 제거했습니다.");
  }

  function downloadBlob(blob, filename) {
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  }

  async function onCapture() {
    if (typeof html2canvas !== "function") {
      setStatus("캡처 라이브러리를 불러오지 못했습니다.", "error");
      return;
    }

    try {
      elements.captureBtn.disabled = true;
      setStatus("고해상도 이미지 생성 중...");

      const elementWidth = elements.captureArea.offsetWidth || 360;
      const deviceScale = window.devicePixelRatio || 1;
      const minExportWidth = 1440;
      const widthScale = minExportWidth / elementWidth;
      const scale = Math.min(Math.max(deviceScale, widthScale, 2), 5);

      const canvas = await html2canvas(elements.captureArea, {
        useCORS: true,
        allowTaint: false,
        scale,
        backgroundColor: null,
        imageTimeout: 15000,
      });

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error("이미지 생성 실패"));
          }
        }, "image/png");
      });

      const filename = `x-capture-${Date.now()}.png`;
      downloadBlob(blob, filename);
      setStatus("PNG 파일을 저장했습니다.", "success");
    } catch (error) {
      setStatus("이미지 저장에 실패했습니다.", "error");
    } finally {
      elements.captureBtn.disabled = false;
    }
  }

  function resetEditors() {
    Object.assign(state, createInitialState());
    elements.tweetUrl.value = "";
    elements.imageInput.value = "";
    applyStateToInputs();
    renderPreview();
    setStatus("입력값을 초기화했습니다.");
  }

  function wireEvents() {
    elements.fetchBtn.addEventListener("click", onFetchClick);
    elements.tweetUrl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onFetchClick();
      }
    });

    elements.authorName.addEventListener("input", syncFromEditors);
    elements.authorHandle.addEventListener("input", syncFromEditors);
    elements.tweetDate.addEventListener("input", syncFromEditors);
    elements.tweetText.addEventListener("input", syncFromEditors);
    elements.replyCount.addEventListener("input", syncFromEditors);
    elements.retweetCount.addEventListener("input", syncFromEditors);
    elements.likeCount.addEventListener("input", syncFromEditors);
    elements.bookmarkCount.addEventListener("input", syncFromEditors);
    elements.mediaLayout.addEventListener("change", syncFromEditors);
    elements.showQuoteToggle.addEventListener("change", syncFromEditors);
    elements.showQuoteMediaToggle.addEventListener("change", syncFromEditors);
    elements.previewAvatarImage.addEventListener("error", () => {
      state.profileImageSrc = "";
      renderPreview();
    });
    elements.previewRetweetAvatar.addEventListener("error", () => {
      state.retweetByProfileImageSrc = "";
      renderPreview();
    });
    elements.previewQuoteAvatar.addEventListener("error", () => {
      state.quoteAuthorProfileImageSrc = "";
      renderPreview();
    });
    elements.previewReplyParentAvatar.addEventListener("error", () => {
      state.replyParentAuthorProfileImageSrc = "";
      renderPreview();
    });
    elements.imageInput.addEventListener("change", onImageSelected);
    elements.removeImageBtn.addEventListener("click", onRemoveImage);
    elements.captureBtn.addEventListener("click", onCapture);
    elements.resetBtn.addEventListener("click", resetEditors);
  }

  wireEvents();
  applyStateToInputs();
  renderPreview();
})();
