(function () {
  const elements = {
    tweetUrl: document.getElementById("tweetUrl"),
    clearUrlBtn: document.getElementById("clearUrlBtn"),
    fetchBtn: document.getElementById("fetchBtn"),
    statusText: document.getElementById("statusText"),
    authorName: document.getElementById("authorName"),
    authorHandle: document.getElementById("authorHandle"),
    tweetDate: document.getElementById("tweetDate"),
    tweetText: document.getElementById("tweetText"),
    translationText: document.getElementById("translationText"),
    replyCount: document.getElementById("replyCount"),
    retweetCount: document.getElementById("retweetCount"),
    likeCount: document.getElementById("likeCount"),
    bookmarkCount: document.getElementById("bookmarkCount"),
    imageInput: document.getElementById("imageInput"),
    mediaLayout: document.getElementById("mediaLayout"),
    showReplyToggle: document.getElementById("showReplyToggle"),
    showReplyMediaToggle: document.getElementById("showReplyMediaToggle"),
    replyEditorList: document.getElementById("replyEditorList"),
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
    previewReplyList: document.getElementById("previewReplyList"),
    previewQuote: document.getElementById("previewQuote"),
    previewQuoteAvatar: document.getElementById("previewQuoteAvatar"),
    previewQuoteName: document.getElementById("previewQuoteName"),
    previewQuoteHandle: document.getElementById("previewQuoteHandle"),
    previewQuoteText: document.getElementById("previewQuoteText"),
    previewQuoteMedia: document.getElementById("previewQuoteMedia"),
    previewDate: document.getElementById("previewDate"),
    previewText: document.getElementById("previewText"),
    previewTranslation: document.getElementById("previewTranslation"),
    previewTranslationText: document.getElementById("previewTranslationText"),
    previewMedia: document.getElementById("previewMedia"),
    previewReplyCount: document.getElementById("previewReplyCount"),
    previewRetweetCount: document.getElementById("previewRetweetCount"),
    previewLikeCount: document.getElementById("previewLikeCount"),
    previewBookmarkCount: document.getElementById("previewBookmarkCount"),
    previewSource: document.getElementById("previewSource"),
    previewOriginalUrl: document.getElementById("previewOriginalUrl"),
    showOriginalUrlToggle: document.getElementById("showOriginalUrlToggle"),
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

  const tweetActionIconPaths = {
    reply:
      "M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z",
    retweet:
      "M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z",
    like:
      "M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z",
    bookmark:
      "M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z",
  };

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

  function extractTweetMetrics(payload) {
    return {
      tweetDate: formatDateLabel(payload && (payload.created_at || payload.createdAt || payload.date)),
      replyCount: formatCountLabel(pickVxCount(payload, ["replies", "reply_count", "replyCount"])),
      retweetCount: formatCountLabel(pickVxCount(payload, ["retweets", "retweet_count", "retweetCount"])),
      likeCount: formatCountLabel(pickVxCount(payload, ["likes", "favorite_count", "favoriteCount", "favourites"])),
      bookmarkCount: formatCountLabel(pickVxCount(payload, ["bookmarks", "bookmark_count", "bookmarkCount"])),
    };
  }

  function flagEmojiToCode(flagEmoji) {
    const codePoints = Array.from(String(flagEmoji || ""), (char) => char.codePointAt(0));
    if (codePoints.length !== 2) {
      return "";
    }

    const base = 0x1F1E6;
    const letters = codePoints.map((point) => {
      if (!Number.isFinite(point) || point < base || point > 0x1F1FF) {
        return "";
      }
      return String.fromCharCode(65 + (point - base));
    });

    if (letters.some((letter) => !letter)) {
      return "";
    }

    return letters.join("");
  }

  function toDisplayText(value) {
    if (value === null || value === undefined || value === false) {
      return "";
    }
    return String(value).replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, (match) => {
      const code = flagEmojiToCode(match);
      return code ? `[${code}]` : match;
    });
  }

  function createInitialState() {
    return {
      sourceUrl: "",
      authorName: "X User",
      authorHandle: "@x",
      replyParents: [],
      quoteAuthorName: "",
      quoteAuthorHandle: "",
      quoteAuthorProfileImageSrc: "",
      quoteText: "",
      quoteDataUrls: [],
      replyCount: "0",
      retweetCount: "0",
      likeCount: "0",
      bookmarkCount: "0",
      showReply: true,
      showReplyMedia: true,
      showQuote: true,
      showQuoteMedia: true,
      showOriginalUrl: true,
      tweetDate: currentDateTimeLabel(),
      tweetText: "캡처할 트윗 본문이 여기에 표시됩니다.",
      translationText: "",
      profileImageSrc: "",
      mediaLayout: "vertical",
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
      if (value == null || typeof value === "boolean") {
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

  function pickVxArticleTitle(payload) {
    return pickFirstNonEmpty([
      payload && payload.article && payload.article.title,
      payload && payload.article_title,
      payload && payload.card && payload.card.title,
      payload && payload.twitter_card && typeof payload.twitter_card === "object" && payload.twitter_card.title,
    ]);
  }

  function pickVxText(payload) {
    const text = pickFirstNonEmpty([
      payload && payload.full_text,
      payload && payload.text,
      payload && payload.tweet_text,
      payload && payload.content && payload.content.text,
      payload && payload.raw_text && payload.raw_text.text,
      payload && payload.rawText && payload.rawText.text,
      payload && payload.note_tweet && payload.note_tweet.text,
      payload && payload.noteTweet && payload.noteTweet.text,
    ]).replace(/\r\n/g, "\n");

    const articleTitle = pickVxArticleTitle(payload);
    if (!text) {
      return articleTitle ? articleTitle.replace(/\r\n/g, "\n") : "";
    }

    const trimmed = text.trim();
    const isSingleUrl = /^https?:\/\/\S+$/i.test(trimmed);
    const isArticleOrShortUrl = /^https?:\/\/(?:www\.)?x\.com\/i\/article\/\d+/i.test(trimmed) ||
      /^https?:\/\/t\.co\/[A-Za-z0-9]+$/i.test(trimmed);
    if (articleTitle && isSingleUrl && isArticleOrShortUrl) {
      return `${articleTitle}\n${trimmed}`;
    }

    return text;
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

  function extractTweetId(value) {
    const matched = String(value || "").match(/\d{5,}/);
    return matched ? matched[0] : "";
  }

  function pickPayloadTweetId(payload) {
    return pickFirstNonEmpty([
      payload && payload.tweetID,
      payload && payload.tweetId,
      payload && payload.id,
      payload && payload.status_id,
      payload && payload.statusId,
      payload && payload.conversationID,
      extractTweetId(pickVxTweetUrl(payload)),
    ]);
  }

  function scoreTweetPayloadRichness(payload) {
    if (!payload || typeof payload !== "object") {
      return -1;
    }

    let score = 0;
    const imageCount = pickVxImages(payload).length;
    score += imageCount * 100;

    if (payload.media && Array.isArray(payload.media.all) && payload.media.all.length) {
      score += 60;
    }

    if (Array.isArray(payload.media_extended) && payload.media_extended.length) {
      score += 45;
    }

    if (Array.isArray(payload.mediaURLs) && payload.mediaURLs.length) {
      score += 35;
    }

    if (Array.isArray(payload.imageURLs) && payload.imageURLs.length) {
      score += 30;
    }

    if (pickVxQuotePayload(payload)) {
      score += 20;
    }

    if (pickVxRetweetedPayload(payload)) {
      score += 20;
    }

    if (pickReplyParentReference(payload)) {
      score += 15;
    }

    if (pickVxText(payload)) {
      score += 5;
    }

    if (pickVxProfileImage(payload)) {
      score += 5;
    }

    return score;
  }

  function pickReplyContextHandle(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }

    const replyingTo = payload.replying_to || payload.replyingTo;
    const replyTarget = payload.reply && typeof payload.reply === "object" ? payload.reply : null;
    const repliedUser = replyTarget && replyTarget.user && typeof replyTarget.user === "object"
      ? replyTarget.user
      : null;
    const fromReplyingToArray = Array.isArray(replyingTo) ? replyingTo[0] : replyingTo;

    const rawHandle = pickFirstNonEmpty([
      payload.replying_to_screen_name,
      payload.replyingToScreenName,
      payload.in_reply_to_screen_name,
      payload.inReplyToScreenName,
      payload.replying_to_username,
      payload.replyingToUsername,
      payload.in_reply_to_username,
      payload.inReplyToUsername,
      fromReplyingToArray && fromReplyingToArray.screen_name,
      fromReplyingToArray && fromReplyingToArray.username,
      typeof fromReplyingToArray === "string" ? fromReplyingToArray : "",
      replyTarget && replyTarget.screen_name,
      replyTarget && replyTarget.username,
      repliedUser && repliedUser.screen_name,
      repliedUser && repliedUser.username,
    ]);

    return normalizeHandle(rawHandle, "");
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

    const candidates = [];
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
          candidates.push(candidate);
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (!candidates.length) {
      throw lastError || new Error("보조 API에서 트윗을 찾지 못했습니다.");
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    return [...candidates].sort((left, right) =>
      scoreTweetPayloadRichness(right) - scoreTweetPayloadRichness(left))[0];
  }

  async function resolveReplyParentPayloads(contentPayload, fallbackPayload, maxDepth) {
    const references = [pickReplyParentReference(contentPayload), pickReplyParentReference(fallbackPayload)]
      .filter(Boolean);
    if (!references.length) {
      return [];
    }

    const depthLimit = Number.isFinite(maxDepth) ? Math.max(1, Number(maxDepth)) : 5;
    const triedFetchIds = new Set();

    for (const startReference of references) {
      const payloads = [];
      const seenPayloadIds = new Set();
      let currentReference = startReference;
      let depth = 0;

      while (currentReference && depth < depthLimit) {
        let currentPayload = null;
        if (currentReference.payload && typeof currentReference.payload === "object") {
          currentPayload = currentReference.payload;
        } else if (currentReference.id) {
          const id = extractTweetId(currentReference.id);
          if (!id || triedFetchIds.has(id)) {
            break;
          }

          triedFetchIds.add(id);
          try {
            currentPayload = await fetchRawTweetPayload(id);
          } catch (error) {
            break;
          }
        }

        if (!currentPayload) {
          break;
        }

        const payloadId = extractTweetId(pickPayloadTweetId(currentPayload));
        if (payloadId && seenPayloadIds.has(payloadId)) {
          break;
        }
        if (payloadId) {
          seenPayloadIds.add(payloadId);
        }

        payloads.push(currentPayload);
        currentReference = pickReplyParentReference(currentPayload);
        depth += 1;
      }

      if (payloads.length) {
        return payloads;
      }
    }

    return [];
  }

  function resolveReplyContextMeta(contentPayload, fallbackPayload) {
    const directHandle = pickReplyContextHandle(contentPayload) || pickReplyContextHandle(fallbackPayload);
    if (directHandle) {
      return {
        text: "",
        translationText: "",
        authorName: "",
        authorHandle: directHandle,
        authorProfileImageUrl: "",
        sourceUrl: "",
        imageUrls: [],
        tweetDate: "",
        replyCount: "0",
        retweetCount: "0",
        likeCount: "0",
        bookmarkCount: "0",
      };
    }

    const references = [pickReplyParentReference(contentPayload), pickReplyParentReference(fallbackPayload)]
      .filter(Boolean);

    for (const reference of references) {
      if (!reference.payload) {
        continue;
      }

      const authorHandle = pickReplyContextHandle(reference.payload) || pickVxHandle(reference.payload, "");
      const authorName = pickVxName(reference.payload, "");
      if (authorHandle || authorName) {
        return {
          text: "",
          translationText: "",
          authorName,
          authorHandle: normalizeHandle(authorHandle, ""),
          authorProfileImageUrl: "",
          sourceUrl: "",
          imageUrls: [],
          tweetDate: "",
          replyCount: "0",
          retweetCount: "0",
          likeCount: "0",
          bookmarkCount: "0",
        };
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
    const metrics = extractTweetMetrics(payload);

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
      tweetDate: metrics.tweetDate,
      replyCount: metrics.replyCount,
      retweetCount: metrics.retweetCount,
      likeCount: metrics.likeCount,
      bookmarkCount: metrics.bookmarkCount,
    };
  }

  function normalizeReplyParentMeta(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const normalized = normalizeQuoteMeta(payload);
    if (normalized) {
      return {
        ...normalized,
        translationText: "",
      };
    }

    const authorName = pickVxName(payload, "");
    const authorHandle = pickReplyContextHandle(payload) || pickVxHandle(payload, "");
    if (!authorName && !authorHandle) {
      return null;
    }

    return {
      text: "",
      translationText: "",
      authorName,
      authorHandle: normalizeHandle(authorHandle, ""),
      authorProfileImageUrl: "",
      sourceUrl: "",
      imageUrls: [],
      tweetDate: "",
      replyCount: "0",
      retweetCount: "0",
      likeCount: "0",
      bookmarkCount: "0",
    };
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

  function isXInternalUrl(rawUrl) {
    const value = String(rawUrl || "").trim();
    if (!value) {
      return false;
    }

    try {
      const parsed = new URL(value);
      const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
      const isXHost = host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com";
      if (!isXHost) {
        return false;
      }
      const path = parsed.pathname;
      return (
        /\/status\/\d+/i.test(path) ||
        /\/i\/article\/\d+/i.test(path) ||
        /\/photo\/\d+$/i.test(path) ||
        /\/video\/\d+$/i.test(path)
      );
    } catch (error) {
      return false;
    }
  }

  function stripAllLinks(rawText) {
    return String(rawText || "")
      .replace(/https?:\/\/[^\s]+/gi, "")
      .replace(/\bpic\.twitter\.com\/[^\s]+/gi, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function sanitizeFetchedTweetText(rawText) {
    const normalized = String(rawText || "").replace(/\r\n/g, "\n").trim();
    if (!normalized) {
      return "";
    }

    const withoutLinks = stripAllLinks(normalized);
    if (!withoutLinks) {
      return "";
    }

    // If only a single URL remains, consider it empty
    if (/^https?:\/\/\S+$/i.test(withoutLinks)) {
      return "";
    }

    return withoutLinks;
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
    const replyParentPayloads = await resolveReplyParentPayloads(contentPayload, payload, 5);
    const replyContextMeta = resolveReplyContextMeta(contentPayload, payload);

    const retweeterName = pickVxName(payload, "X User");
    const retweeterHandle = pickVxHandle(payload, "@x");
    const retweeterProfileImageUrl = pickVxProfileImage(payload);

    let tweetText = pickVxText(contentPayload) || pickVxText(payload);
    const retweetTextMatch = tweetText.match(/^RT\s+@([A-Za-z0-9_]{1,15}):\s*([\s\S]*)$/);
    if (retweetTextMatch) {
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

    const replyParents = [];
    const seenReplyKeys = new Set();
    replyParentPayloads
      .map(normalizeReplyParentMeta)
      .filter(Boolean)
      .forEach((meta) => {
        const key = [
          normalizeHandle(meta.authorHandle, ""),
          String(meta.authorName || "").trim(),
          String(meta.text || "").trim(),
          String(meta.sourceUrl || "").trim(),
        ].join("|");
        if (seenReplyKeys.has(key)) {
          return;
        }
        seenReplyKeys.add(key);
        replyParents.push(meta);
      });

    if (!replyParents.length && replyContextMeta) {
      replyParents.push(replyContextMeta);
    }

    return {
      sourceUrl,
      authorName: pickVxName(contentPayload, retweeterName),
      authorHandle: pickVxHandle(contentPayload, retweeterHandle),
      tweetDate: formatDateLabel(payload.created_at || payload.createdAt || payload.date),
      tweetText,
      profileImageUrl: pickVxProfileImage(contentPayload) || retweeterProfileImageUrl,
      imageUrls: imageUrlsFromContent.length ? imageUrlsFromContent : imageUrlsFromPayload,
      replyCount: formatCountLabel(replyCountRaw),
      retweetCount: formatCountLabel(retweetCountRaw),
      likeCount: formatCountLabel(likeCountRaw),
      bookmarkCount: formatCountLabel(bookmarkCountRaw),
      quote: normalizeQuoteMeta(quotePayload),
      replyParents,
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

  function getReplyParentsInDisplayOrder() {
    if (!Array.isArray(state.replyParents) || !state.replyParents.length) {
      return [];
    }

    const ordered = [];
    for (let index = state.replyParents.length - 1; index >= 0; index -= 1) {
      ordered.push({
        item: state.replyParents[index],
        stateIndex: index,
      });
    }
    return ordered;
  }

  function renderReplyEditors() {
    if (!elements.replyEditorList) {
      return;
    }

    const orderedReplies = getReplyParentsInDisplayOrder();
    elements.replyEditorList.innerHTML = "";

    if (!orderedReplies.length) {
      elements.replyEditorList.classList.add("hidden");
      return;
    }

    orderedReplies.forEach(({ item, stateIndex }, orderIndex) => {
      const authorName = String(item && item.authorName || "").trim();
      const authorHandle = normalizeHandle(item && item.authorHandle, "");
      const titleText = [authorName, authorHandle].filter(Boolean).join(" ") || `답글 ${orderIndex + 1}`;

      const editorItem = document.createElement("section");
      editorItem.className = "reply-editor-item";

      const title = document.createElement("p");
      title.className = "reply-editor-title";
      title.textContent = toDisplayText(titleText);
      editorItem.appendChild(title);

      const bodyField = document.createElement("div");
      bodyField.className = "reply-editor-fields";
      const bodyInputId = `replyBodyInput-${stateIndex}`;
      const bodyLabel = document.createElement("label");
      bodyLabel.className = "reply-editor-label";
      bodyLabel.htmlFor = bodyInputId;
      bodyLabel.textContent = "본문";
      const bodyTextarea = document.createElement("textarea");
      bodyTextarea.className = "reply-editor-textarea";
      bodyTextarea.id = bodyInputId;
      bodyTextarea.rows = 3;
      bodyTextarea.value = String(item && item.text || "");
      bodyTextarea.placeholder = "답글 본문을 입력하세요.";
      bodyTextarea.addEventListener("input", (event) => {
        if (!Array.isArray(state.replyParents) || !state.replyParents[stateIndex]) {
          return;
        }
        state.replyParents[stateIndex].text = event.target.value;
        renderPreview();
      });
      bodyField.appendChild(bodyLabel);
      bodyField.appendChild(bodyTextarea);
      editorItem.appendChild(bodyField);

      const translationField = document.createElement("div");
      translationField.className = "reply-editor-fields";
      const translationInputId = `replyTranslationInput-${stateIndex}`;
      const translationLabel = document.createElement("label");
      translationLabel.className = "reply-editor-label";
      translationLabel.htmlFor = translationInputId;
      translationLabel.textContent = "번역";
      const translationTextarea = document.createElement("textarea");
      translationTextarea.className = "reply-editor-textarea";
      translationTextarea.id = translationInputId;
      translationTextarea.rows = 3;
      translationTextarea.value = String(item && item.translationText || "");
      translationTextarea.placeholder = "답글 번역을 입력하세요.";
      translationTextarea.addEventListener("input", (event) => {
        if (!Array.isArray(state.replyParents) || !state.replyParents[stateIndex]) {
          return;
        }
        state.replyParents[stateIndex].translationText = event.target.value;
        renderPreview();
      });
      translationField.appendChild(translationLabel);
      translationField.appendChild(translationTextarea);
      editorItem.appendChild(translationField);

      elements.replyEditorList.appendChild(editorItem);
    });

    elements.replyEditorList.classList.remove("hidden");
  }

  function applyStateToInputs() {
    elements.authorName.value = toDisplayText(state.authorName);
    elements.authorHandle.value = toDisplayText(state.authorHandle);
    elements.tweetDate.value = state.tweetDate;
    elements.tweetText.value = toDisplayText(state.tweetText);
    elements.translationText.value = toDisplayText(state.translationText);
    elements.replyCount.value = state.replyCount;
    elements.retweetCount.value = state.retweetCount;
    elements.likeCount.value = state.likeCount;
    elements.bookmarkCount.value = state.bookmarkCount;
    elements.mediaLayout.value = state.mediaLayout;
    elements.showReplyToggle.checked = Boolean(state.showReply);
    elements.showReplyMediaToggle.checked = Boolean(state.showReplyMedia);
    elements.showQuoteToggle.checked = Boolean(state.showQuote);
    elements.showQuoteMediaToggle.checked = Boolean(state.showQuoteMedia);
    elements.showOriginalUrlToggle.checked = Boolean(state.showOriginalUrl);
    renderReplyEditors();
  }

  function applyImageSource(imageElement, source) {
    const nextSource = String(source || "").trim();
    if (!nextSource) {
      imageElement.removeAttribute("src");
      return false;
    }

    const currentSource = String(imageElement.getAttribute("src") || "").trim();
    if (currentSource !== nextSource) {
      // Clear previous bitmap first to avoid stale frame capture while switching.
      imageElement.removeAttribute("src");
      imageElement.src = nextSource;
    }

    return true;
  }

  function resolveSourceMeta(sourceUrl) {
    const normalizedSourceUrl = String(sourceUrl || "").trim();
    let sourceHost = "x.com";
    let sourceHref = "";

    if (normalizedSourceUrl) {
      try {
        const parsedUrl = new URL(normalizedSourceUrl);
        sourceHost = parsedUrl.host.replace(/^www\./i, "") || "x.com";
        sourceHref = parsedUrl.href;
      } catch (error) {
        sourceHost = "x.com";
      }
    }

    return { sourceHost, sourceHref };
  }

  function createTweetActionItem(iconPath, value) {
    const actionItem = document.createElement("div");
    actionItem.className = "tweet-action-item";

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("class", "tweet-action-icon");

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", iconPath);
    group.appendChild(path);
    icon.appendChild(group);

    const text = document.createElement("span");
    text.textContent = String(value || "0").trim() || "0";

    actionItem.appendChild(icon);
    actionItem.appendChild(text);
    return actionItem;
  }

  function populateTweetMedia(container, mediaItems, altPrefix, layout) {
    container.innerHTML = "";
    const normalizedMedia = Array.isArray(mediaItems) ? mediaItems.filter(Boolean).slice(0, 4) : [];

    if (!normalizedMedia.length) {
      container.classList.add("hidden");
      container.removeAttribute("data-count");
      container.removeAttribute("data-layout");
      return false;
    }

    container.dataset.count = String(normalizedMedia.length);
    container.dataset.layout = normalizedMedia.length >= 2 ? layout : "single";
    container.classList.remove("hidden");

    normalizedMedia.forEach((src, index) => {
      const image = document.createElement("img");
      image.className = "tweet-image";
      image.alt = `${altPrefix} ${index + 1}`;
      image.loading = index === 0 ? "eager" : "lazy";
      image.referrerPolicy = "no-referrer";
      image.crossOrigin = "anonymous";
      image.src = src;
      container.appendChild(image);
    });

    return true;
  }

  function createReplyTweetCard(item, options) {
    const authorName = String(item && item.authorName || "").trim();
    const authorHandle = normalizeHandle(item && item.authorHandle, "");
    const text = String(item && item.text || "").replace(/\r\n/g, "\n").trim();
    const translation = String(item && item.translationText || "").replace(/\r\n/g, "\n").trim();
    const avatarSrc = String(item && item.authorProfileImageSrc || "").trim();
    const media = Array.isArray(item && item.dataUrls) ? item.dataUrls.filter(Boolean).slice(0, 4) : [];
    const tweetDate = String(item && item.tweetDate || "").trim() || "날짜";
    const replyCount = String(item && item.replyCount || "").trim() || "0";
    const retweetCount = String(item && item.retweetCount || "").trim() || "0";
    const likeCount = String(item && item.likeCount || "").trim() || "0";
    const bookmarkCount = String(item && item.bookmarkCount || "").trim() || "0";
    const { sourceHost, sourceHref } = resolveSourceMeta(item && item.sourceUrl);
    const cardLabel = authorName || authorHandle || "답글";
    const displayName = authorName || "답글";
    const initialSeed = authorName || authorHandle.replace(/^@/, "") || "X";

    const article = document.createElement("article");
    article.className = "tweet-card";

    const head = document.createElement("header");
    head.className = "tweet-head";

    const avatar = document.createElement("div");
    avatar.className = "avatar";

    const avatarImage = document.createElement("img");
    avatarImage.className = "avatar-image hidden";
    avatarImage.alt = `${toDisplayText(cardLabel)} 프로필 사진`;
    avatarImage.loading = "lazy";
    avatarImage.referrerPolicy = "no-referrer";
    avatarImage.crossOrigin = "anonymous";

    const avatarInitial = document.createElement("span");
    avatarInitial.textContent = initialSeed.charAt(0).toUpperCase() || "X";
    if (avatarSrc) {
      avatarInitial.classList.add("hidden");
    }

    avatarImage.addEventListener("error", () => {
      avatarImage.removeAttribute("src");
      avatarImage.classList.add("hidden");
      avatarInitial.classList.remove("hidden");
    });
    if (avatarSrc) {
      avatarImage.src = avatarSrc;
      avatarImage.classList.remove("hidden");
    }

    avatar.appendChild(avatarImage);
    avatar.appendChild(avatarInitial);

    const meta = document.createElement("div");
    meta.className = "author-meta";

    const nameNode = document.createElement("p");
    nameNode.className = "name";
    nameNode.textContent = toDisplayText(displayName);

    const handleNode = document.createElement("p");
    handleNode.className = "handle";
    handleNode.textContent = toDisplayText(authorHandle || "");
    if (!authorHandle) {
      handleNode.classList.add("hidden");
    }

    meta.appendChild(nameNode);
    meta.appendChild(handleNode);

    const platformMark = document.createElement("span");
    platformMark.className = "platform-mark";
    platformMark.textContent = "𝕏";

    head.appendChild(avatar);
    head.appendChild(meta);
    head.appendChild(platformMark);
    article.appendChild(head);

    const textNode = document.createElement("p");
    textNode.className = "tweet-text";
    textNode.textContent = /\S/.test(text) ? toDisplayText(text) : "";
    if (!/\S/.test(text)) {
      textNode.classList.add("hidden");
    }
    article.appendChild(textNode);

    const translationBox = document.createElement("section");
    translationBox.className = "tweet-translation";
    translationBox.setAttribute("aria-label", "답글 번역");
    const translationTextNode = document.createElement("p");
    translationTextNode.className = "tweet-translation-text";
    if (translation) {
      translationTextNode.textContent = toDisplayText(translation);
    } else {
      translationBox.classList.add("hidden");
    }
    translationBox.appendChild(translationTextNode);
    article.appendChild(translationBox);

    const mediaBox = document.createElement("div");
    mediaBox.className = "tweet-media hidden";
    mediaBox.setAttribute("aria-label", "답글 첨부 이미지 목록");
    if (options.showReplyMedia) {
      populateTweetMedia(mediaBox, media, "답글 이미지", options.mediaLayout);
    }
    article.appendChild(mediaBox);

    const actions = document.createElement("div");
    actions.className = "tweet-actions";
    actions.setAttribute("aria-label", "답글 반응 수치");
    actions.appendChild(createTweetActionItem(tweetActionIconPaths.reply, replyCount));
    actions.appendChild(createTweetActionItem(tweetActionIconPaths.retweet, retweetCount));
    actions.appendChild(createTweetActionItem(tweetActionIconPaths.like, likeCount));
    actions.appendChild(createTweetActionItem(tweetActionIconPaths.bookmark, bookmarkCount));
    article.appendChild(actions);

    const footer = document.createElement("footer");
    footer.className = "tweet-foot";

    const footMeta = document.createElement("div");
    footMeta.className = "tweet-foot-meta";
    const dateNode = document.createElement("span");
    dateNode.textContent = tweetDate;
    const dotNode = document.createElement("span");
    dotNode.textContent = "·";
    const sourceNode = document.createElement("span");
    sourceNode.textContent = sourceHost;
    footMeta.appendChild(dateNode);
    footMeta.appendChild(dotNode);
    footMeta.appendChild(sourceNode);
    footer.appendChild(footMeta);

    const originalUrl = document.createElement("a");
    originalUrl.className = "tweet-original-url hidden";
    originalUrl.target = "_blank";
    originalUrl.rel = "noopener noreferrer";
    if (options.showOriginalUrl && sourceHref) {
      originalUrl.textContent = sourceHref;
      originalUrl.href = sourceHref;
      originalUrl.classList.remove("hidden");
    }
    footer.appendChild(originalUrl);

    article.appendChild(footer);
    return article;
  }

  function renderPreview() {
    const trimmedName = state.authorName.trim() || "X User";
    const trimmedHandle = state.authorHandle.trim() || "@x";
    const handleWithPrefix = trimmedHandle.startsWith("@") ? trimmedHandle : `@${trimmedHandle}`;

    elements.previewName.textContent = toDisplayText(trimmedName);
    elements.previewHandle.textContent = toDisplayText(handleWithPrefix);
    elements.previewDate.textContent = state.tweetDate.trim() || currentDateTimeLabel();
    const rawText = String(state.tweetText || "").replace(/\r\n/g, "\n");
    elements.previewText.textContent = /\S/.test(rawText) ? toDisplayText(rawText) : "";
    if (elements.previewTranslation && elements.previewTranslationText) {
      const rawTranslation = String(state.translationText || "").replace(/\r\n/g, "\n");
      if (/\S/.test(rawTranslation)) {
        elements.previewTranslationText.textContent = toDisplayText(rawTranslation);
        elements.previewTranslation.classList.remove("hidden");
      } else {
        elements.previewTranslationText.textContent = "";
        elements.previewTranslation.classList.add("hidden");
      }
    }
    elements.previewReplyCount.textContent = state.replyCount.trim() || "0";
    elements.previewRetweetCount.textContent = state.retweetCount.trim() || "0";
    elements.previewLikeCount.textContent = state.likeCount.trim() || "0";
    elements.previewBookmarkCount.textContent = state.bookmarkCount.trim() || "0";
    const initial = trimmedName.charAt(0).toUpperCase();
    elements.previewAvatarInitial.textContent = initial || "X";
    if (state.profileImageSrc) {
      elements.previewAvatarImage.crossOrigin = "anonymous";
      elements.previewAvatarImage.referrerPolicy = "no-referrer";
      applyImageSource(elements.previewAvatarImage, state.profileImageSrc);
      elements.previewAvatarImage.classList.remove("hidden");
      elements.previewAvatarInitial.classList.add("hidden");
    } else {
      elements.previewAvatarImage.removeAttribute("src");
      elements.previewAvatarImage.classList.add("hidden");
      elements.previewAvatarInitial.classList.remove("hidden");
    }

    if (elements.previewReplyList) {
      const showReply = Boolean(state.showReply);
      const showReplyMedia = Boolean(state.showReplyMedia);
      const replyItems = getReplyParentsInDisplayOrder();

      elements.previewReplyList.innerHTML = "";
      if (showReply && replyItems.length) {
        replyItems.forEach(({ item }) => {
          const authorName = String(item && item.authorName || "").trim();
          const authorHandle = normalizeHandle(item && item.authorHandle, "");
          const text = String(item && item.text || "").replace(/\r\n/g, "\n").trim();
          const translation = String(item && item.translationText || "").replace(/\r\n/g, "\n").trim();
          const media = Array.isArray(item && item.dataUrls) ? item.dataUrls.filter(Boolean).slice(0, 4) : [];
          const hasMedia = showReplyMedia && media.length > 0;
          if (!authorName && !authorHandle && !text && !translation && !hasMedia) {
            return;
          }

          elements.previewReplyList.appendChild(createReplyTweetCard(item, {
            showReplyMedia,
            showOriginalUrl: Boolean(state.showOriginalUrl),
            mediaLayout: state.mediaLayout,
          }));
        });
      }

      if (elements.previewReplyList.childElementCount) {
        elements.previewReplyList.classList.remove("hidden");
      } else {
        elements.previewReplyList.classList.add("hidden");
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
          applyImageSource(elements.previewQuoteAvatar, quoteAuthorProfileImageSrc);
          elements.previewQuoteAvatar.classList.remove("hidden");
        } else {
          elements.previewQuoteAvatar.removeAttribute("src");
          elements.previewQuoteAvatar.classList.add("hidden");
        }
        elements.previewQuoteName.textContent = toDisplayText(quoteName || "원문");
        elements.previewQuoteHandle.textContent = toDisplayText(quoteHandle || "");
        elements.previewQuoteText.textContent = toDisplayText(quoteText || "");
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

    const { sourceHost, sourceHref } = resolveSourceMeta(state.sourceUrl);

    elements.previewSource.textContent = sourceHost;
    if (elements.previewOriginalUrl) {
      if (sourceHref && state.showOriginalUrl) {
        elements.previewOriginalUrl.textContent = sourceHref;
        elements.previewOriginalUrl.href = sourceHref;
        elements.previewOriginalUrl.classList.remove("hidden");
      } else {
        elements.previewOriginalUrl.textContent = "";
        elements.previewOriginalUrl.removeAttribute("href");
        elements.previewOriginalUrl.classList.add("hidden");
      }
    }
  }

  function syncFromEditors() {
    state.authorName = elements.authorName.value;
    state.authorHandle = elements.authorHandle.value;
    state.tweetDate = elements.tweetDate.value;
    state.tweetText = elements.tweetText.value;
    state.translationText = elements.translationText.value;
    state.replyCount = elements.replyCount.value;
    state.retweetCount = elements.retweetCount.value;
    state.likeCount = elements.likeCount.value;
    state.bookmarkCount = elements.bookmarkCount.value;
    state.mediaLayout = elements.mediaLayout.value === "vertical" ? "vertical" : "grid";
    state.showReply = Boolean(elements.showReplyToggle.checked);
    state.showReplyMedia = Boolean(elements.showReplyMediaToggle.checked);
    state.showQuote = Boolean(elements.showQuoteToggle.checked);
    state.showQuoteMedia = Boolean(elements.showQuoteMediaToggle.checked);
    state.showOriginalUrl = Boolean(elements.showOriginalUrlToggle.checked);
    renderPreview();
  }

  async function onFetchClick() {
    try {
      elements.fetchBtn.disabled = true;
      setStatus("트윗 정보를 가져오는 중...");

      const normalized = normalizeUrl(elements.tweetUrl.value);
      let imageUrls = [];
      let profileImageUrl = "";
      let quoteMeta = null;
      let replyParentMetas = [];
      let usedFallback = false;
      state.translationText = "";

      try {
        const result = await fetchTweetFromOembed(normalized);
        const payload = result.payload;
        const parsed = parseOembedHtml(payload.html);
        let vxText = "";

        state.sourceUrl = payload.url || result.usedUrl || normalized.canonicalUrl;
        state.authorName = (payload.author_name || "").trim() || "X User";
        state.authorHandle = parseHandle(payload.author_url || "", payload.author_name || "x");
        state.replyParents = [];
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
        state.tweetText = sanitizeFetchedTweetText(parsed.text);
        imageUrls = payload.thumbnail_url ? [payload.thumbnail_url] : [];

        try {
          const vxMeta = await fetchTweetFromVx(normalized.tweetId);
          vxText = sanitizeFetchedTweetText(vxMeta.tweetText || "");
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
          replyParentMetas = Array.isArray(vxMeta.replyParents) ? vxMeta.replyParents : [];
        } catch (error) {
          // oEmbed 본문은 이미 가져왔으므로 이미지 보강 실패는 무시한다.
        }
      } catch (oembedError) {
        const fallback = await fetchTweetFromVx(normalized.tweetId);
        usedFallback = true;

        state.sourceUrl = fallback.sourceUrl || normalized.canonicalUrl;
        state.authorName = fallback.authorName;
        state.authorHandle = fallback.authorHandle;
        state.tweetDate = fallback.tweetDate;
        state.tweetText = sanitizeFetchedTweetText(fallback.tweetText || "");
        state.replyCount = fallback.replyCount || "0";
        state.retweetCount = fallback.retweetCount || "0";
        state.likeCount = fallback.likeCount || "0";
        state.bookmarkCount = fallback.bookmarkCount || "0";
        profileImageUrl = fallback.profileImageUrl || "";
        imageUrls = Array.isArray(fallback.imageUrls) ? fallback.imageUrls : [];
        quoteMeta = fallback.quote || null;
        replyParentMetas = Array.isArray(fallback.replyParents) ? fallback.replyParents : [];
        setStatus(`${formatOembedError(oembedError)} 보조 경로로 불러왔습니다.`);
      }

      const [
        profileImageSrc,
        quoteAuthorProfileImageSrc,
        mainImages,
        quoteImages,
      ] = await Promise.all([
        toDisplayImageSrc(profileImageUrl),
        toDisplayImageSrc(quoteMeta ? quoteMeta.authorProfileImageUrl : ""),
        toDisplayImageSrcs(imageUrls),
        toDisplayImageSrcs(quoteMeta && Array.isArray(quoteMeta.imageUrls) ? quoteMeta.imageUrls : []),
      ]);

      const replyParents = await Promise.all(
        (Array.isArray(replyParentMetas) ? replyParentMetas : []).slice(0, 6).map(async (meta) => {
          const normalizedMeta = meta && typeof meta === "object" ? meta : {};
          const [authorProfileImageSrc, dataUrls] = await Promise.all([
            toDisplayImageSrc(normalizedMeta.authorProfileImageUrl || ""),
            toDisplayImageSrcs(Array.isArray(normalizedMeta.imageUrls) ? normalizedMeta.imageUrls : []),
          ]);

          return {
            authorName: String(normalizedMeta.authorName || "").trim(),
            authorHandle: normalizeHandle(normalizedMeta.authorHandle, ""),
            text: String(normalizedMeta.text || "").replace(/\r\n/g, "\n").trim(),
            translationText: String(normalizedMeta.translationText || "").replace(/\r\n/g, "\n").trim(),
            sourceUrl: String(normalizedMeta.sourceUrl || "").trim(),
            tweetDate: String(normalizedMeta.tweetDate || "").trim(),
            replyCount: String(normalizedMeta.replyCount || "").trim() || "0",
            retweetCount: String(normalizedMeta.retweetCount || "").trim() || "0",
            likeCount: String(normalizedMeta.likeCount || "").trim() || "0",
            bookmarkCount: String(normalizedMeta.bookmarkCount || "").trim() || "0",
            authorProfileImageSrc,
            dataUrls,
          };
        })
      );

      state.profileImageSrc = profileImageSrc;
      state.imageDataUrls = mainImages;
      state.quoteAuthorName = quoteMeta ? (quoteMeta.authorName || "") : "";
      state.quoteAuthorHandle = quoteMeta ? (quoteMeta.authorHandle || "") : "";
      state.quoteAuthorProfileImageSrc = quoteMeta ? quoteAuthorProfileImageSrc : "";
      state.quoteText = quoteMeta ? (quoteMeta.text || "") : "";
      state.quoteDataUrls = quoteImages;
      state.replyParents = replyParents.filter((item) => {
        return Boolean(
          String(item.authorHandle || "").trim() ||
          String(item.authorName || "").trim() ||
          String(item.text || "").trim() ||
          String(item.translationText || "").trim() ||
          (Array.isArray(item.dataUrls) && item.dataUrls.length)
        );
      });
      applyStateToInputs();
      renderPreview();
      if (usedFallback) {
        setStatus("불러오기 완료(보조 경로). 필요하면 내용을 수정하고 저장하세요.", "success");
      } else {
        setStatus("불러오기 완료. 필요하면 내용을 수정하고 저장하세요.", "success");
      }
      await onCapture();
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

  function waitForNextFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  function waitForImageReady(image, timeoutMs) {
    if (!image || !(image instanceof HTMLImageElement)) {
      return Promise.resolve();
    }

    const source = String(image.getAttribute("src") || "").trim();
    if (!source || image.classList.contains("hidden")) {
      return Promise.resolve();
    }

    if (image.complete && image.naturalWidth > 0) {
      if (typeof image.decode === "function") {
        return image.decode().catch(() => { });
      }
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let settled = false;
      let timerId = 0;
      const cleanup = () => {
        image.removeEventListener("load", onSettled);
        image.removeEventListener("error", onSettled);
        if (timerId) {
          clearTimeout(timerId);
          timerId = 0;
        }
      };
      const onSettled = () => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve();
      };

      image.addEventListener("load", onSettled, { once: true });
      image.addEventListener("error", onSettled, { once: true });
      timerId = window.setTimeout(onSettled, timeoutMs);
    });
  }

  async function waitForCaptureImages() {
    if (!elements.captureArea) {
      return;
    }

    // Let DOM updates settle before checking image states.
    await waitForNextFrame();
    await waitForNextFrame();

    const images = Array.from(elements.captureArea.querySelectorAll("img"))
      .filter((image) => {
        if (!(image instanceof HTMLImageElement)) {
          return false;
        }
        return Boolean(String(image.getAttribute("src") || "").trim()) && !image.classList.contains("hidden");
      });

    if (!images.length) {
      return;
    }

    await Promise.all(images.map((image) => waitForImageReady(image, 6000)));
    await waitForNextFrame();
  }

  async function onCapture() {
    if (typeof html2canvas !== "function") {
      setStatus("캡처 라이브러리를 불러오지 못했습니다.", "error");
      return;
    }

    try {
      elements.captureBtn.disabled = true;
      setStatus("고해상도 이미지 생성 중...");
      await waitForCaptureImages();

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

  function onClearTweetUrl() {
    elements.tweetUrl.value = "";
    elements.tweetUrl.focus();
    setStatus("트윗 URL 입력값을 지웠습니다.");
  }

  function wireEvents() {
    elements.fetchBtn.addEventListener("click", onFetchClick);
    elements.clearUrlBtn.addEventListener("click", onClearTweetUrl);
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
    elements.translationText.addEventListener("input", syncFromEditors);
    elements.replyCount.addEventListener("input", syncFromEditors);
    elements.retweetCount.addEventListener("input", syncFromEditors);
    elements.likeCount.addEventListener("input", syncFromEditors);
    elements.bookmarkCount.addEventListener("input", syncFromEditors);
    elements.mediaLayout.addEventListener("change", syncFromEditors);
    elements.showReplyToggle.addEventListener("change", syncFromEditors);
    elements.showReplyMediaToggle.addEventListener("change", syncFromEditors);
    elements.showQuoteToggle.addEventListener("change", syncFromEditors);
    elements.showQuoteMediaToggle.addEventListener("change", syncFromEditors);
    elements.showOriginalUrlToggle.addEventListener("change", syncFromEditors);
    elements.previewAvatarImage.addEventListener("error", () => {
      state.profileImageSrc = "";
      renderPreview();
    });
    elements.previewQuoteAvatar.addEventListener("error", () => {
      state.quoteAuthorProfileImageSrc = "";
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


