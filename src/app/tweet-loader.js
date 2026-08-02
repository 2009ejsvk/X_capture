import {
  createReplyParentState,
  hasRenderableReply,
} from "../domain/tweet-model.js?v=reply-thread-v2-20260802";
import {
  normalizeMediaItems,
  toDisplayImageSrc,
  toDisplayImageSrcs,
} from "../media.js";
import {
  formatDateLabel,
  normalizeHandle,
  normalizeUrl,
  parseHandle,
  sanitizeFetchedTweetText,
} from "../utils.js?v=threads-api-20260802";
import { fetchThreadsPost } from "../services/threads-api.js?v=threads-api-20260802";
import {
  fetchTweetFromOembed,
  fetchTweetFromVx,
  formatOembedError,
  parseOembedHtml,
} from "../twitter-api.js?v=reply-thread-v2-20260802";

async function normalizeReplyParents(replyParentMetas, options = {}) {
  return await Promise.all(
    (Array.isArray(replyParentMetas) ? replyParentMetas : [])
      .slice(0, 6)
      .map(async (meta) => {
        const normalizedMeta = meta && typeof meta === "object" ? meta : {};
        const [authorProfileImageSrc, dataUrls] = await Promise.all([
          toDisplayImageSrc(
            normalizedMeta.authorProfileImageUrl || "",
            options,
          ),
          toDisplayImageSrcs(
            Array.isArray(normalizedMeta.imageUrls)
              ? normalizedMeta.imageUrls
              : [],
            options,
          ),
        ]);

        return createReplyParentState({
          ...normalizedMeta,
          authorHandle: normalizeHandle(normalizedMeta.authorHandle, ""),
          authorProfileImageSrc,
          dataUrls,
        });
      }),
  );
}

export async function loadTweetFromUrl(tweetUrl, options = {}) {
  const normalized = normalizeUrl(tweetUrl);
  if (normalized.platform === "threads") {
    return loadThreadsFromUrl(normalized, options);
  }
  let imageUrls = [];
  let profileImageUrl = "";
  let quoteMeta = null;
  let replyParentMetas = [];
  let usedFallback = false;
  let fallbackStatusMessage = "";

  const patch = {
    translationText: "",
  };

  try {
    const result = await fetchTweetFromOembed(normalized, options);
    const payload = result.payload;
    const parsed = parseOembedHtml(payload.html);
    let vxText = "";

    Object.assign(patch, {
      sourceUrl: payload.url || result.usedUrl || normalized.canonicalUrl,
      authorName: (payload.author_name || "").trim() || "X User",
      authorHandle: parseHandle(
        payload.author_url || "",
        payload.author_name || "x",
      ),
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
      tweetDate: formatDateLabel(payload.date || parsed.dateLabel),
      tweetText: sanitizeFetchedTweetText(parsed.text),
    });
    imageUrls = payload.thumbnail_url ? [payload.thumbnail_url] : [];

    try {
      const vxMeta = await fetchTweetFromVx(normalized.tweetId, options);
      vxText = sanitizeFetchedTweetText(vxMeta.tweetText || "");
      if (vxText) {
        patch.tweetText = vxText;
      }
      if (vxMeta.profileImageUrl) {
        profileImageUrl = vxMeta.profileImageUrl;
      }
      if (Array.isArray(vxMeta.imageUrls) && vxMeta.imageUrls.length) {
        imageUrls = vxMeta.imageUrls;
      }
      if (vxMeta.authorName) {
        patch.authorName = vxMeta.authorName;
      }
      if (vxMeta.authorHandle) {
        patch.authorHandle = vxMeta.authorHandle;
      }
      patch.replyCount = vxMeta.replyCount || "0";
      patch.retweetCount = vxMeta.retweetCount || "0";
      patch.likeCount = vxMeta.likeCount || "0";
      patch.bookmarkCount = vxMeta.bookmarkCount || "0";
      if (vxMeta.tweetDate) {
        patch.tweetDate = vxMeta.tweetDate;
      }
      if (vxMeta.sourceUrl) {
        patch.sourceUrl = vxMeta.sourceUrl;
      }
      quoteMeta = vxMeta.quote || null;
      replyParentMetas = Array.isArray(vxMeta.replyParents)
        ? vxMeta.replyParents
        : [];
    } catch (error) {
      if (options.signal && options.signal.aborted) {
        throw error;
      }
    }
  } catch (oembedError) {
    if (options.signal && options.signal.aborted) {
      throw oembedError;
    }

    const fallback = await fetchTweetFromVx(normalized.tweetId, options);
    usedFallback = true;

    Object.assign(patch, {
      sourceUrl: fallback.sourceUrl || normalized.canonicalUrl,
      authorName: fallback.authorName,
      authorHandle: fallback.authorHandle,
      tweetDate: fallback.tweetDate,
      tweetText: sanitizeFetchedTweetText(fallback.tweetText || ""),
      replyCount: fallback.replyCount || "0",
      retweetCount: fallback.retweetCount || "0",
      likeCount: fallback.likeCount || "0",
      bookmarkCount: fallback.bookmarkCount || "0",
    });
    profileImageUrl = fallback.profileImageUrl || "";
    imageUrls = Array.isArray(fallback.imageUrls) ? fallback.imageUrls : [];
    quoteMeta = fallback.quote || null;
    replyParentMetas = Array.isArray(fallback.replyParents)
      ? fallback.replyParents
      : [];
    fallbackStatusMessage = `${formatOembedError(oembedError)} 보조 경로로 불러왔습니다.`;
  }

  const [profileImageSrc, quoteAuthorProfileImageSrc, mainImages, quoteImages] =
    await Promise.all([
      toDisplayImageSrc(profileImageUrl, options),
      toDisplayImageSrc(
        quoteMeta ? quoteMeta.authorProfileImageUrl : "",
        options,
      ),
      toDisplayImageSrcs(imageUrls, options),
      toDisplayImageSrcs(
        quoteMeta && Array.isArray(quoteMeta.imageUrls)
          ? quoteMeta.imageUrls
          : [],
        options,
      ),
    ]);

  const replyParents = await normalizeReplyParents(replyParentMetas, options);

  Object.assign(patch, {
    profileImageSrc,
    imageDataUrls: normalizeMediaItems(mainImages),
    quoteAuthorName: quoteMeta ? quoteMeta.authorName || "" : "",
    quoteAuthorHandle: quoteMeta ? quoteMeta.authorHandle || "" : "",
    quoteAuthorProfileImageSrc: quoteMeta ? quoteAuthorProfileImageSrc : "",
    quoteText: quoteMeta ? quoteMeta.text || "" : "",
    quoteDataUrls: normalizeMediaItems(quoteImages),
    replyParents: replyParents.filter(hasRenderableReply),
  });

  return {
    patch,
    usedFallback,
    fallbackStatusMessage,
  };
}

async function loadThreadsFromUrl(normalized, options = {}) {
  const result = await fetchThreadsPost(normalized, {
    ...options,
    accessToken: options.threadsAccessToken,
  });
  const post = result.post;
  const quote = result.quote;

  const [profileImageSrc, mainImages, quoteProfileImageSrc, quoteImages] =
    await Promise.all([
      toDisplayImageSrc(post.authorProfileImageUrl, options),
      toDisplayImageSrcs(post.imageUrls, options),
      toDisplayImageSrc(quote?.authorProfileImageUrl || "", options),
      toDisplayImageSrcs(quote?.imageUrls || [], options),
    ]);
  const replyParents = await normalizeReplyParents(
    result.replyParents,
    options,
  );

  return {
    patch: {
      sourceUrl: post.sourceUrl || normalized.canonicalUrl,
      authorName: post.authorName,
      authorHandle: post.authorHandle,
      profileImageSrc,
      tweetDate: formatDateLabel(post.tweetDate),
      tweetText: post.text,
      translationText: "",
      replyCount: post.replyCount || "0",
      retweetCount: post.retweetCount || "0",
      likeCount: post.likeCount || "0",
      bookmarkCount: "0",
      imageDataUrls: normalizeMediaItems(mainImages),
      quoteAuthorName: quote?.authorName || "",
      quoteAuthorHandle: quote?.authorHandle || "",
      quoteAuthorProfileImageSrc: quoteProfileImageSrc,
      quoteText: quote?.text || "",
      quoteDataUrls: normalizeMediaItems(quoteImages),
      replyParents: replyParents.filter(hasRenderableReply),
    },
    usedFallback: false,
    statusMessage:
      "Threads 글을 불러왔습니다. 공개 반응 수는 API에서 제공되지 않을 수 있어 직접 수정할 수 있습니다.",
  };
}
