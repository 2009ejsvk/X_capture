import {
  extractTweetId,
  formatCountLabel,
  formatDateLabel,
  normalizeHandle,
  pickFirstNonEmpty,
} from "../utils.js";
import { normalizeMediaItems } from "../media.js";
import { fetchWithTimeout } from "./http.js";

function extractTweetMetrics(payload) {
  return {
    tweetDate: formatDateLabel(
      payload && (payload.created_at || payload.createdAt || payload.date),
    ),
    replyCount: formatCountLabel(
      pickVxCount(payload, ["replies", "reply_count", "replyCount"]),
    ),
    retweetCount: formatCountLabel(
      pickVxCount(payload, ["retweets", "retweet_count", "retweetCount"]),
    ),
    likeCount: formatCountLabel(
      pickVxCount(payload, [
        "likes",
        "favorite_count",
        "favoriteCount",
        "favourites",
      ]),
    ),
    bookmarkCount: formatCountLabel(
      pickVxCount(payload, ["bookmarks", "bookmark_count", "bookmarkCount"]),
    ),
  };
}

function pickVxCount(payload, variants) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const metrics =
    payload.metrics && typeof payload.metrics === "object"
      ? payload.metrics
      : null;
  const publicMetrics =
    payload.public_metrics && typeof payload.public_metrics === "object"
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
  const fallback =
    typeof fallbackHandle === "undefined" ? "@x" : fallbackHandle;
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
    payload &&
      payload.twitter_card &&
      typeof payload.twitter_card === "object" &&
      payload.twitter_card.title,
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
  const isArticleOrShortUrl =
    /^https?:\/\/(?:www\.)?x\.com\/i\/article\/\d+/i.test(trimmed) ||
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

  if (
    payload.media &&
    Array.isArray(payload.media.all) &&
    payload.media.all.length
  ) {
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
  const replyTarget =
    payload.reply && typeof payload.reply === "object" ? payload.reply : null;
  const repliedUser =
    replyTarget && replyTarget.user && typeof replyTarget.user === "object"
      ? replyTarget.user
      : null;
  const fromReplyingToArray = Array.isArray(replyingTo)
    ? replyingTo[0]
    : replyingTo;

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

async function fetchRawTweetPayload(tweetId, options = {}) {
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
      const response = await fetchWithTimeout(endpoint, {
        headers: { Accept: "application/json" },
        signal: options.signal,
        timeoutMs: options.timeoutMs || 10000,
      });

      if (!response.ok) {
        lastError = new Error(`보조 API 오류 (${response.status})`);
        continue;
      }

      const body = await response.json();
      const candidate =
        body && typeof body === "object" && body.tweet ? body.tweet : body;
      if (
        candidate &&
        typeof candidate === "object" &&
        (candidate.tweetID || candidate.id)
      ) {
        candidates.push(candidate);
      }
    } catch (error) {
      if (options.signal && options.signal.aborted) {
        throw error;
      }
      lastError = error;
    }
  }

  if (!candidates.length) {
    throw lastError || new Error("보조 API에서 트윗을 찾지 못했습니다.");
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  return [...candidates].sort(
    (left, right) =>
      scoreTweetPayloadRichness(right) - scoreTweetPayloadRichness(left),
  )[0];
}

async function resolveReplyParentPayloads(
  contentPayload,
  fallbackPayload,
  maxDepth,
  options = {},
) {
  const references = [
    pickReplyParentReference(contentPayload),
    pickReplyParentReference(fallbackPayload),
  ].filter(Boolean);
  if (!references.length) {
    return [];
  }

  const depthLimit = Number.isFinite(maxDepth)
    ? Math.max(1, Number(maxDepth))
    : 5;
  const triedFetchIds = new Set();

  for (const startReference of references) {
    const payloads = [];
    const seenPayloadIds = new Set();
    let currentReference = startReference;
    let depth = 0;

    while (currentReference && depth < depthLimit) {
      let currentPayload = null;
      if (
        currentReference.payload &&
        typeof currentReference.payload === "object"
      ) {
        currentPayload = currentReference.payload;
      } else if (currentReference.id) {
        const id = extractTweetId(currentReference.id);
        if (!id || triedFetchIds.has(id)) {
          break;
        }

        triedFetchIds.add(id);
        try {
          currentPayload = await fetchRawTweetPayload(id, options);
        } catch (error) {
          if (options.signal && options.signal.aborted) {
            throw error;
          }
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
  const directHandle =
    pickReplyContextHandle(contentPayload) ||
    pickReplyContextHandle(fallbackPayload);
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

  const references = [
    pickReplyParentReference(contentPayload),
    pickReplyParentReference(fallbackPayload),
  ].filter(Boolean);

  for (const reference of references) {
    if (!reference.payload) {
      continue;
    }

    const authorHandle =
      pickReplyContextHandle(reference.payload) ||
      pickVxHandle(reference.payload, "");
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

  if (
    !text &&
    !authorName &&
    !authorHandle &&
    !authorProfileImageUrl &&
    !sourceUrl &&
    !imageUrls.length
  ) {
    return null;
  }

  return {
    text,
    authorName,
    authorHandle,
    authorProfileImageUrl,
    sourceUrl,
    imageUrls: normalizeMediaItems(imageUrls),
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
  const authorHandle =
    pickReplyContextHandle(payload) || pickVxHandle(payload, "");
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

  const mediaEntries =
    payload && payload.media && Array.isArray(payload.media.all)
      ? payload.media.all
      : [];

  if (mediaEntries.length) {
    for (const media of mediaEntries) {
      if (!media) {
        continue;
      }

      const mediaType = String(media.type || "").toLowerCase();
      const mediaUrl = pickFirstNonEmpty([
        media.url,
        media.media_url,
        media.image_url,
      ]);
      const thumbnail = pickFirstNonEmpty([
        media.thumbnail_url,
        media.thumb_url,
      ]);

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

      if (
        !videoThumbnail &&
        (media.type === "video" || media.type === "gif") &&
        media.thumbnail_url
      ) {
        videoThumbnail = media.thumbnail_url;
      }
    }
  }

  if (
    !images.length &&
    Array.isArray(payload.mediaURLs) &&
    payload.mediaURLs.length
  ) {
    const imageLikes = payload.mediaURLs.filter((url) => isImageLikeUrl(url));
    images.push(...imageLikes);
  }

  if (
    !images.length &&
    Array.isArray(payload.imageURLs) &&
    payload.imageURLs.length
  ) {
    const imageLikes = payload.imageURLs.filter((url) => isImageLikeUrl(url));
    images.push(...imageLikes);
  }

  if (
    !images.length &&
    Array.isArray(payload.photos) &&
    payload.photos.length
  ) {
    for (const media of payload.photos) {
      const mediaUrl = pickFirstNonEmpty([
        media && media.url,
        media && media.media_url,
      ]);
      if (mediaUrl) {
        images.push(mediaUrl);
      }
    }
  }

  if (!images.length && videoThumbnail) {
    images.push(videoThumbnail);
  }

  return [
    ...new Set(images.map((url) => String(url || "").trim()).filter(Boolean)),
  ].slice(0, 4);
}

export async function fetchTweetFromVx(tweetId, options = {}) {
  const payload = await fetchRawTweetPayload(tweetId, options);

  const retweetedPayload = pickVxRetweetedPayload(payload);
  const contentPayload = retweetedPayload || payload;
  const quotePayload =
    pickVxQuotePayload(contentPayload) || pickVxQuotePayload(payload);
  const replyParentPayloads = await resolveReplyParentPayloads(
    contentPayload,
    payload,
    5,
    options,
  );
  const replyContextMeta = resolveReplyContextMeta(contentPayload, payload);

  const retweeterName = pickVxName(payload, "X User");
  const retweeterHandle = pickVxHandle(payload, "@x");
  const retweeterProfileImageUrl = pickVxProfileImage(payload);

  let tweetText = pickVxText(contentPayload) || pickVxText(payload);
  const retweetTextMatch = tweetText.match(
    /^RT\s+@([A-Za-z0-9_]{1,15}):\s*([\s\S]*)$/,
  );
  if (retweetTextMatch) {
    tweetText = retweetTextMatch[2] || tweetText;
  }

  const imageUrlsFromContent = pickVxImages(contentPayload);
  const imageUrlsFromPayload = pickVxImages(payload);
  const replyCountRaw =
    pickVxCount(contentPayload, ["replies", "reply_count", "replyCount"]) ||
    pickVxCount(payload, ["replies", "reply_count", "replyCount"]);
  const retweetCountRaw =
    pickVxCount(contentPayload, [
      "retweets",
      "retweet_count",
      "retweetCount",
    ]) || pickVxCount(payload, ["retweets", "retweet_count", "retweetCount"]);
  const likeCountRaw =
    pickVxCount(contentPayload, [
      "likes",
      "favorite_count",
      "favoriteCount",
      "favourites",
    ]) ||
    pickVxCount(payload, [
      "likes",
      "favorite_count",
      "favoriteCount",
      "favourites",
    ]);
  const bookmarkCountRaw =
    pickVxCount(contentPayload, [
      "bookmarks",
      "bookmark_count",
      "bookmarkCount",
    ]) ||
    pickVxCount(payload, ["bookmarks", "bookmark_count", "bookmarkCount"]);
  const sourceUrl =
    pickVxTweetUrl(contentPayload) ||
    pickFirstNonEmpty([
      payload.retweetURL,
      payload.retweetUrl,
      pickVxTweetUrl(payload),
    ]) ||
    `https://x.com/i/status/${tweetId}`;

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
    tweetDate: formatDateLabel(
      payload.created_at || payload.createdAt || payload.date,
    ),
    tweetText,
    profileImageUrl:
      pickVxProfileImage(contentPayload) || retweeterProfileImageUrl,
    imageUrls: imageUrlsFromContent.length
      ? imageUrlsFromContent
      : imageUrlsFromPayload,
    replyCount: formatCountLabel(replyCountRaw),
    retweetCount: formatCountLabel(retweetCountRaw),
    likeCount: formatCountLabel(likeCountRaw),
    bookmarkCount: formatCountLabel(bookmarkCountRaw),
    quote: normalizeQuoteMeta(quotePayload),
    replyParents,
  };
}
