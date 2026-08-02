import {
  currentDateTimeLabel,
  normalizeHandle,
  stripLeadingReplyMentions,
} from "../utils.js?v=reply-thread-v2-20260802";
import { normalizeMediaItems } from "../media.js";
import { createDefaultCaptureSettings } from "./capture-settings.js?v=font-legibility-20260802";

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
    quoteTextMode: "full",
    quoteMediaLayout: "vertical",
    tweetDate: currentDateTimeLabel(),
    tweetText: "캡처할 트윗 본문이 여기에 표시됩니다.",
    translationText: "",
    profileImageSrc: "",
    mediaLayout: "vertical",
    imageDataUrls: [],
    ...createDefaultCaptureSettings(),
  };
}

export function createReplyParentState(meta = {}) {
  return {
    visible: meta.visible !== false,
    authorName: String(meta.authorName || "").trim(),
    authorHandle: normalizeHandle(meta.authorHandle, ""),
    text: stripLeadingReplyMentions(
      String(meta.text || "").replace(/\r\n/g, "\n"),
    ).trim(),
    translationText: String(meta.translationText || "")
      .replace(/\r\n/g, "\n")
      .trim(),
    sourceUrl: String(meta.sourceUrl || "").trim(),
    tweetDate: String(meta.tweetDate || "").trim(),
    replyCount: String(meta.replyCount || "").trim() || "0",
    retweetCount: String(meta.retweetCount || "").trim() || "0",
    likeCount: String(meta.likeCount || "").trim() || "0",
    bookmarkCount: String(meta.bookmarkCount || "").trim() || "0",
    mediaLayout: meta.mediaLayout === "grid" ? "grid" : "vertical",
    authorProfileImageSrc: String(meta.authorProfileImageSrc || "").trim(),
    dataUrls: normalizeMediaItems(meta.dataUrls),
  };
}

export function hasRenderableReply(item) {
  return Boolean(
    String(item.text || "").trim() ||
    String(item.translationText || "").trim() ||
    normalizeMediaItems(item.dataUrls).length,
  );
}

export function normalizeQuoteTextMode(value) {
  return value === "preview" ? "preview" : "full";
}

export function formatQuoteText(text, mode, maxLength = 160) {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (normalizeQuoteTextMode(mode) === "full") {
    return normalized;
  }

  const characters = Array.from(normalized);
  const limit = Math.max(1, Number(maxLength) || 160);
  if (characters.length <= limit) {
    return normalized;
  }

  return `${characters.slice(0, limit).join("").trimEnd()}…`;
}
