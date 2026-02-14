const FXTWITTER_API_BASE = (process.env.FXTWITTER_API_BASE || "https://api.fxtwitter.com").replace(/\/+$/, "");
const OEMBED_API = "https://publish.twitter.com/oembed";
const TWEET_ID_PATTERN = /^\d{8,25}$/;
const MAX_REPLY_CHAIN_DEPTH = Number(process.env.REPLY_CHAIN_MAX_DEPTH || 8);

function parseTweetInput(input) {
  if (typeof input !== "string" || input.trim() === "") {
    throw new Error("A tweet URL is required.");
  }

  const raw = input.trim();
  if (TWEET_ID_PATTERN.test(raw)) {
    return {
      id: raw,
      screenName: null,
      originalUrl: `https://x.com/i/status/${raw}`
    };
  }

  let normalizedInput = raw;
  if (!/^https?:\/\//i.test(normalizedInput)) {
    normalizedInput = `https://${normalizedInput}`;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(normalizedInput);
  } catch {
    throw new Error("The tweet URL is invalid.");
  }

  const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
  const acceptedHosts = new Set([
    "x.com",
    "twitter.com",
    "mobile.twitter.com",
    "m.twitter.com",
    "fxtwitter.com",
    "fixupx.com",
    "vxtwitter.com"
  ]);
  if (!acceptedHosts.has(host)) {
    throw new Error("Only x.com / twitter.com tweet URLs are supported.");
  }

  const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
  const statusIndex = pathParts.findIndex((part) => part.toLowerCase() === "status");
  if (statusIndex === -1 || !pathParts[statusIndex + 1]) {
    throw new Error("Could not find tweet id in the URL.");
  }

  const idCandidate = pathParts[statusIndex + 1].replace(/[^\d].*$/, "");
  if (!TWEET_ID_PATTERN.test(idCandidate)) {
    throw new Error("Could not parse a valid tweet id.");
  }

  const screenNameCandidate = pathParts[statusIndex - 1] || null;
  const screenName =
    screenNameCandidate && /^[a-zA-Z0-9_]{1,15}$/.test(screenNameCandidate)
      ? screenNameCandidate
      : null;

  return {
    id: idCandidate,
    screenName,
    originalUrl: parsedUrl.toString()
  };
}

async function fetchTweetModel(input) {
  const parsed = parseTweetInput(input);
  const fxResponse = await fetchFxTweet(parsed);
  if (fxResponse) {
    return await normalizeFxTweet(fxResponse, parsed);
  }

  const oembedResponse = await fetchOEmbedTweet(parsed.originalUrl);
  return normalizeOEmbedTweet(oembedResponse, parsed);
}

async function fetchFxTweet(parsed) {
  const paths = [];
  if (parsed.screenName) {
    paths.push(`${encodeURIComponent(parsed.screenName)}/status/${parsed.id}`);
  }
  paths.push(`status/${parsed.id}`);
  paths.push(`i/status/${parsed.id}`);

  for (const path of paths) {
    const endpoint = `${FXTWITTER_API_BASE}/${path}`;
    try {
      const response = await fetch(endpoint, {
        headers: {
          "accept": "application/json",
          "user-agent": "tweet-recomposer/0.1"
        }
      });
      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      if (payload?.code === 200 && payload?.tweet) {
        return payload;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchOEmbedTweet(url) {
  const endpoint = `${OEMBED_API}?url=${encodeURIComponent(url)}&omit_script=true&dnt=true&theme=light`;
  const response = await fetch(endpoint, {
    headers: {
      "accept": "application/json",
      "user-agent": "tweet-recomposer/0.1"
    }
  });

  if (!response.ok) {
    throw new Error("Could not fetch tweet data from fxtwitter or oEmbed.");
  }

  return response.json();
}

async function normalizeFxTweet(payload, parsed) {
  const tweet = payload.tweet;
  const primaryText = pickPrimaryText(tweet);
  const author = tweet.author || {};
  const media = tweet.media || {};
  const photos = extractPhotoList(media);
  const videos = extractVideoList(media, tweet.video);
  const article = normalizeArticle(tweet.article);
  const sharedTweet = normalizeEmbeddedTweet(extractSharedTweet(tweet));
  const replyChain = await extractReplyChain(tweet);

  return {
    id: String(tweet.id || parsed.id),
    url: tweet.url || parsed.originalUrl,
    text: primaryText,
    createdAt: normalizeDate(tweet.created_timestamp, tweet.created_at),
    source: tweet.source || null,
    provider: tweet.provider || "fxtwitter",
    author: {
      name: author.name || "Unknown",
      screenName: author.screen_name || parsed.screenName || null,
      avatarUrl: author.avatar_url || null
    },
    stats: {
      replies: normalizeNumber(tweet.replies),
      retweets: normalizeNumber(tweet.retweets),
      likes: normalizeNumber(tweet.likes),
      bookmarks: normalizeNumber(tweet.bookmarks),
      views: normalizeNumber(tweet.views)
    },
    photos,
    videos,
    article,
    sharedTweet,
    replyChain
  };
}

function normalizeOEmbedTweet(oembed, parsed) {
  const authorUrl = typeof oembed.author_url === "string" ? oembed.author_url : "";
  const authorScreenName = authorUrl.split("/").filter(Boolean).pop() || parsed.screenName || null;
  return {
    id: parsed.id,
    url: oembed.url || parsed.originalUrl,
    text: extractTextFromOEmbedHtml(oembed.html || ""),
    createdAt: null,
    source: null,
    provider: "oembed",
    author: {
      name: oembed.author_name || "Unknown",
      screenName: authorScreenName,
      avatarUrl: null
    },
    stats: {
      replies: null,
      retweets: null,
      likes: null,
      bookmarks: null,
      views: null
    },
    photos: [],
    videos: [],
    article: null,
    sharedTweet: null,
    replyChain: []
  };
}

function extractPhotoList(media) {
  const result = [];
  const pushPhoto = (item) => {
    if (!item) {
      return;
    }
    const url = item.url || item.media_url || item.media_url_https || item.image_url || null;
    if (!url) {
      return;
    }
    result.push({
      url,
      width: normalizeNumber(item.width),
      height: normalizeNumber(item.height)
    });
  };

  if (Array.isArray(media.photos)) {
    media.photos.forEach(pushPhoto);
  }
  if (Array.isArray(media.all)) {
    media.all.filter((item) => item?.type === "photo").forEach(pushPhoto);
  }

  return dedupeByUrl(result);
}

function extractVideoList(media, topLevelVideo = null) {
  const result = [];
  const pushVideo = (item) => {
    if (!item) {
      return;
    }
    const url = pickVideoUrl(item);
    if (!url) {
      return;
    }
    const thumbnailUrl =
      item.thumbnail_url || item.preview_image_url || item.thumbnail || item.poster || null;
    const type = String(item.type || "").toLowerCase();
    result.push({
      url,
      thumbnailUrl,
      isGif: item.is_gif === true || type === "gif" || /\.gif(\?|$)/i.test(url),
      mimeType: pickVideoMimeType(item, url)
    });
  };

  if (Array.isArray(media.videos)) {
    media.videos.forEach(pushVideo);
  }
  if (Array.isArray(media.all)) {
    media.all.filter((item) => item?.type === "video" || item?.type === "gif").forEach(pushVideo);
  }
  if (topLevelVideo && typeof topLevelVideo === "object") {
    pushVideo(topLevelVideo);
  }

  return dedupeByUrl(result);
}

function pickVideoUrl(item) {
  const candidates = [
    item.url,
    item.video_url,
    item.videoUrl,
    item.video_url_hd,
    item.video_url_sd,
    item.sd_url,
    item.hd_url,
    item.playback_url,
    item.playbackUrl,
    item.download_url,
    item.downloadUrl
  ];

  if (Array.isArray(item.variants)) {
    const ranked = item.variants
      .filter((variant) => variant && typeof variant.url === "string" && variant.url.trim() !== "")
      .sort((a, b) => {
        const aBitrate = normalizeNumber(a.bitrate) || 0;
        const bBitrate = normalizeNumber(b.bitrate) || 0;
        return bBitrate - aBitrate;
      });
    for (const variant of ranked) {
      candidates.push(variant.url);
    }
  }

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate.trim();
    }
  }
  return null;
}

function pickVideoMimeType(item, url) {
  if (typeof item.content_type === "string" && item.content_type.trim() !== "") {
    return item.content_type.trim();
  }
  if (typeof item.mime_type === "string" && item.mime_type.trim() !== "") {
    return item.mime_type.trim();
  }
  if (/\.gif(\?|$)/i.test(url)) {
    return "image/gif";
  }
  if (/\.m3u8(\?|$)/i.test(url)) {
    return "application/vnd.apple.mpegurl";
  }
  if (/\.webm(\?|$)/i.test(url)) {
    return "video/webm";
  }
  return "video/mp4";
}

function normalizeArticle(article) {
  if (!article || typeof article !== "object") {
    return null;
  }
  const coverImage =
    article.cover_media?.media_info?.original_img_url ||
    article.cover_media?.media_info?.url ||
    article.cover_media?.url ||
    null;
  if (!article.title && !article.preview_text && !coverImage) {
    return null;
  }
  return {
    title: article.title || "",
    previewText: article.preview_text || "",
    coverImage
  };
}

function normalizeEmbeddedTweet(sharedSource) {
  if (!sharedSource || typeof sharedSource !== "object" || !sharedSource.tweet) {
    return null;
  }

  const tweet = sharedSource.tweet;
  const media = tweet.media || {};
  return {
    type: sharedSource.type,
    id: tweet.id ? String(tweet.id) : null,
    text: pickPrimaryText(tweet),
    author: {
      name: tweet.author?.name || "Unknown",
      screenName: tweet.author?.screen_name || null,
      avatarUrl: tweet.author?.avatar_url || null
    },
    createdAt: normalizeDate(tweet.created_timestamp, tweet.created_at),
    source: tweet.source || null,
    photos: extractPhotoList(media),
    videos: extractVideoList(media, tweet.video),
    article: normalizeArticle(tweet.article)
  };
}

function extractSharedTweet(tweet) {
  if (!tweet || typeof tweet !== "object") {
    return null;
  }

  const retweetCandidates = [
    tweet.retweeted_tweet,
    tweet.retweeted_status,
    tweet.retweet,
    tweet.repost
  ];
  const retweetMatch = retweetCandidates.find(
    (candidate) => candidate && typeof candidate === "object"
  );
  if (retweetMatch) {
    return {
      type: "retweet",
      tweet: retweetMatch
    };
  }

  if (tweet.quote && typeof tweet.quote === "object") {
    return {
      type: "quote",
      tweet: tweet.quote
    };
  }

  return null;
}

async function extractReplyChain(tweet) {
  if (!tweet || typeof tweet !== "object") {
    return [];
  }

  const chain = [];
  const visited = new Set();
  if (tweet.id !== undefined && tweet.id !== null) {
    visited.add(String(tweet.id));
  }

  let current = tweet;
  for (let depth = 0; depth < MAX_REPLY_CHAIN_DEPTH; depth += 1) {
    const embeddedParent = pickEmbeddedParentTweet(current);
    if (embeddedParent) {
      const marker = makeTweetMarker(embeddedParent);
      if (visited.has(marker)) {
        break;
      }
      visited.add(marker);
      chain.push(normalizeContextTweet(embeddedParent));
      current = embeddedParent;
      continue;
    }

    const parentId = pickParentStatusId(current);
    if (!parentId || visited.has(parentId)) {
      break;
    }

    const fetchedParent = await fetchFxTweetById(parentId);
    if (!fetchedParent?.tweet) {
      break;
    }
    const parentTweet = fetchedParent.tweet;
    const marker = makeTweetMarker(parentTweet);
    if (visited.has(marker)) {
      break;
    }
    visited.add(marker);
    chain.push(normalizeContextTweet(parentTweet));
    current = parentTweet;
  }

  return chain.reverse();
}

async function fetchFxTweetById(tweetId) {
  const id = normalizeTweetId(tweetId);
  if (!id) {
    return null;
  }
  return fetchFxTweet({
    id,
    screenName: null,
    originalUrl: `https://x.com/i/status/${id}`
  });
}

function pickParentStatusId(tweet) {
  if (!tweet || typeof tweet !== "object") {
    return null;
  }

  const directCandidates = [
    tweet.in_reply_to_status_id,
    tweet.in_reply_to_status_id_str,
    tweet.replying_to_status_id,
    tweet.reply_to_status_id,
    tweet.parent_tweet_id,
    tweet.parent_status_id
  ];
  for (const candidate of directCandidates) {
    const id = normalizeTweetId(candidate);
    if (id) {
      return id;
    }
  }

  const nestedCandidates = [
    tweet.replying_to_status,
    tweet.in_reply_to_status,
    tweet.parent_tweet,
    tweet.parent_status,
    tweet.replying_to
  ];
  for (const candidate of nestedCandidates) {
    const id = resolveParentIdCandidate(candidate);
    if (id) {
      return id;
    }
  }

  return null;
}

function resolveParentIdCandidate(candidate) {
  if (!candidate) {
    return null;
  }

  const directId = normalizeTweetId(candidate);
  if (directId) {
    return directId;
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const resolved = resolveParentIdCandidate(item);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  if (typeof candidate !== "object") {
    return null;
  }

  const explicitFields = [
    "status_id",
    "statusId",
    "tweet_id",
    "tweetId",
    "in_reply_to_status_id",
    "replying_to_status_id",
    "parent_status_id",
    "parent_tweet_id"
  ];
  for (const field of explicitFields) {
    const id = normalizeTweetId(candidate[field]);
    if (id) {
      return id;
    }
  }

  if (typeof candidate.url === "string") {
    const urlMatch = candidate.url.match(/status\/(\d{8,25})/i);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
  }

  if (candidate.tweet && typeof candidate.tweet === "object") {
    const nested = resolveParentIdCandidate(candidate.tweet);
    if (nested) {
      return nested;
    }
  }

  if (looksLikeTweetObject(candidate)) {
    const id = normalizeTweetId(candidate.id);
    if (id) {
      return id;
    }
  }

  return null;
}

function normalizeTweetId(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const text = String(Math.trunc(value));
    return TWEET_ID_PATTERN.test(text) ? text : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return TWEET_ID_PATTERN.test(trimmed) ? trimmed : null;
  }
  return null;
}

function pickEmbeddedParentTweet(tweet) {
  const candidates = [
    tweet.replying_to_status,
    tweet.in_reply_to_status,
    tweet.parent_tweet,
    tweet.parent_status
  ];

  for (const candidate of candidates) {
    const resolved = resolveTweetCandidate(candidate);
    if (resolved) {
      return resolved;
    }
  }
  return null;
}

function resolveTweetCandidate(candidate) {
  if (!candidate) {
    return null;
  }
  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const resolved = resolveTweetCandidate(item);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }
  if (typeof candidate !== "object") {
    return null;
  }
  if (candidate.tweet && typeof candidate.tweet === "object") {
    return resolveTweetCandidate(candidate.tweet);
  }
  if (looksLikeTweetObject(candidate)) {
    return candidate;
  }
  return null;
}

function looksLikeTweetObject(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }
  if (
    candidate.author &&
    (candidate.text !== undefined ||
      candidate.raw_text ||
      candidate.media ||
      candidate.created_at ||
      candidate.created_timestamp)
  ) {
    return true;
  }
  return false;
}

function normalizeContextTweet(tweet) {
  const media = tweet.media || {};
  return {
    id: tweet.id ? String(tweet.id) : null,
    text: pickPrimaryText(tweet),
    author: {
      name: tweet.author?.name || "Unknown",
      screenName: tweet.author?.screen_name || null,
      avatarUrl: tweet.author?.avatar_url || null
    },
    createdAt: normalizeDate(tweet.created_timestamp, tweet.created_at),
    source: tweet.source || null,
    photos: extractPhotoList(media),
    videos: extractVideoList(media, tweet.video),
    article: normalizeArticle(tweet.article)
  };
}

function makeTweetMarker(tweet) {
  if (tweet.id !== undefined && tweet.id !== null) {
    return String(tweet.id);
  }
  return `${tweet.created_timestamp || tweet.created_at || ""}:${String(tweet.text || "").slice(0, 80)}`;
}

function pickPrimaryText(tweet) {
  if (!tweet || typeof tweet !== "object") {
    return "";
  }

  const textValue =
    [tweet.text, tweet.raw_text?.text].find(
      (value) => typeof value === "string" && value.trim() !== ""
    ) || "";
  return cleanupTweetText(textValue, tweet.raw_text?.facets);
}

function cleanupTweetText(text, facets) {
  let output = String(text || "");
  if (Array.isArray(facets)) {
    for (const facet of facets) {
      if (
        facet &&
        facet.type === "media" &&
        typeof facet.original === "string" &&
        facet.original.trim() !== ""
      ) {
        output = output.replace(facet.original, "");
      }
    }
  }

  output = output.replace(/\s*https?:\/\/t\.co\/[a-zA-Z0-9]+\s*$/gi, " ");
  output = output.replace(/[ \t]+\n/g, "\n");
  output = output.replace(/\n{3,}/g, "\n\n");
  return output.trim();
}

function normalizeDate(timestamp, createdAtText) {
  if (typeof timestamp === "number") {
    return new Date(timestamp * 1000).toISOString();
  }
  if (typeof createdAtText === "string" && createdAtText.trim() !== "") {
    const parsed = new Date(createdAtText);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return null;
}

function normalizeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function dedupeByUrl(items, key = "url") {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const marker = item[key];
    if (!marker || seen.has(marker)) {
      continue;
    }
    seen.add(marker);
    output.push(item);
  }
  return output;
}

function extractTextFromOEmbedHtml(html) {
  if (typeof html !== "string" || html.trim() === "") {
    return "";
  }
  const paragraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const rawText = paragraphMatch ? paragraphMatch[1] : html;
  const withoutTags = rawText
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/a>/gi, "")
    .replace(/<a[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "");
  return decodeHtml(withoutTags).trim();
}

function decodeHtml(text) {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

module.exports = {
  parseTweetInput,
  fetchTweetModel
};
