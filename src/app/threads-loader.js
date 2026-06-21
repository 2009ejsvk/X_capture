import {
  normalizeMediaItems,
  toDisplayImageSrc,
  toDisplayImageSrcs,
} from "../media.js";
import { normalizeHandle } from "../utils.js";
import { fetchThreadsPost } from "../services/threads.js";

export async function loadThreadsFromUrl(postUrl, options = {}) {
  const meta = await fetchThreadsPost(postUrl, options);

  const [profileImageSrc, mainImages] = await Promise.all([
    toDisplayImageSrc(meta.profileImageUrl || "", options),
    toDisplayImageSrcs(
      Array.isArray(meta.imageUrls) ? meta.imageUrls : [],
      options,
    ),
  ]);

  const patch = {
    platform: "threads",
    sourceUrl: meta.sourceUrl || postUrl,
    authorName: (meta.authorName || "").trim() || "Threads User",
    authorHandle: normalizeHandle(meta.authorHandle, "@threads"),
    tweetDate: meta.tweetDate || "",
    tweetText: meta.text || "",
    translationText: "",
    replyCount: meta.replyCount || "0",
    retweetCount: meta.retweetCount || "0",
    likeCount: meta.likeCount || "0",
    bookmarkCount: meta.bookmarkCount || "0",
    profileImageSrc,
    imageDataUrls: normalizeMediaItems(mainImages),
    mediaLayout: "vertical",
    // Threads import does not surface quote/reply context.
    replyParents: [],
    quoteAuthorName: "",
    quoteAuthorHandle: "",
    quoteAuthorProfileImageSrc: "",
    quoteText: "",
    quoteDataUrls: [],
  };

  return { patch, usedFallback: false };
}
