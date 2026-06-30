import { getVisibleMediaSrcs } from "../media.js";
import {
  normalizeHandle,
  toDisplayText,
} from "../utils.js?v=flag-emoji-20260630";
import { createTweetActionItem } from "./action-item.js";
import { populateTweetMedia } from "./media.js";
import { resolveSourceMeta } from "./source-meta.js";
import { tweetActionIconPaths } from "./tweet-action-icons.js";

export function createReplyTweetCard(item, options) {
  const authorName = String((item && item.authorName) || "").trim();
  const authorHandle = normalizeHandle(item && item.authorHandle, "");
  const text = String((item && item.text) || "")
    .replace(/\r\n/g, "\n")
    .trim();
  const translation = String((item && item.translationText) || "")
    .replace(/\r\n/g, "\n")
    .trim();
  const avatarSrc = String((item && item.authorProfileImageSrc) || "").trim();
  const media = getVisibleMediaSrcs(item && item.dataUrls);
  const tweetDate = String((item && item.tweetDate) || "").trim() || "날짜";
  const replyCount = String((item && item.replyCount) || "").trim() || "0";
  const retweetCount = String((item && item.retweetCount) || "").trim() || "0";
  const likeCount = String((item && item.likeCount) || "").trim() || "0";
  const bookmarkCount =
    String((item && item.bookmarkCount) || "").trim() || "0";
  const { sourceHost } = resolveSourceMeta(item && item.sourceUrl);
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
  actions.appendChild(
    createTweetActionItem(tweetActionIconPaths.reply, replyCount),
  );
  actions.appendChild(
    createTweetActionItem(tweetActionIconPaths.retweet, retweetCount),
  );
  actions.appendChild(
    createTweetActionItem(tweetActionIconPaths.like, likeCount),
  );
  actions.appendChild(
    createTweetActionItem(tweetActionIconPaths.bookmark, bookmarkCount),
  );
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

  article.appendChild(footer);
  return article;
}
