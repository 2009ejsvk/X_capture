import { currentDateTimeLabel, normalizeHandle } from "../utils.js";
import { normalizeMediaItems } from "../media.js";

export function createInitialState() {
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
    quoteMediaLayout: "vertical",
    tweetDate: currentDateTimeLabel(),
    tweetText: "캡처할 트윗 본문이 여기에 표시됩니다.",
    translationText: "",
    profileImageSrc: "",
    mediaLayout: "vertical",
    imageDataUrls: [],
  };
}

export function createReplyParentState(meta = {}) {
  return {
    authorName: String(meta.authorName || "").trim(),
    authorHandle: normalizeHandle(meta.authorHandle, ""),
    text: String(meta.text || "")
      .replace(/\r\n/g, "\n")
      .trim(),
    translationText: String(meta.translationText || "")
      .replace(/\r\n/g, "\n")
      .trim(),
    sourceUrl: String(meta.sourceUrl || "").trim(),
    tweetDate: String(meta.tweetDate || "").trim(),
    replyCount: String(meta.replyCount || "").trim() || "0",
    retweetCount: String(meta.retweetCount || "").trim() || "0",
    likeCount: String(meta.likeCount || "").trim() || "0",
    bookmarkCount: String(meta.bookmarkCount || "").trim() || "0",
    authorProfileImageSrc: String(meta.authorProfileImageSrc || "").trim(),
    dataUrls: normalizeMediaItems(meta.dataUrls),
  };
}

export function hasRenderableReply(item) {
  return Boolean(
    String(item.authorHandle || "").trim() ||
    String(item.authorName || "").trim() ||
    String(item.text || "").trim() ||
    String(item.translationText || "").trim() ||
    normalizeMediaItems(item.dataUrls).length,
  );
}
