import { fetchWithTimeout } from "./http.js";
import {
  formatCountLabel,
  normalizeHandle,
} from "../utils.js?v=threads-api-20260802";

const API_HOST = "https://graph.threads.net";
const LIST_FIELDS = [
  "id",
  "media_product_type",
  "media_type",
  "media_url",
  "gif_url",
  "permalink",
  "username",
  "text",
  "timestamp",
  "shortcode",
  "thumbnail_url",
  "children",
  "is_quote_post",
  "quoted_post",
  "reposted_post",
  "has_replies",
  "alt_text",
  "link_attachment_url",
  "is_verified",
  "profile_picture_url",
].join(",");
const DETAIL_FIELDS = [
  LIST_FIELDS,
  "is_reply",
  "is_reply_owned_by_me",
  "root_post",
  "replied_to",
].join(",");

function threadsApiError(payload, status) {
  const apiMessage = String(payload?.error?.message || "").trim();
  const code = Number(payload?.error?.code);

  if (code === 190 || status === 401) {
    return new Error(
      "Threads API 토큰이 만료되었거나 올바르지 않습니다. 새 토큰을 입력해 주세요.",
    );
  }

  if (code === 10 || code === 200) {
    return new Error(
      "Threads 공개 프로필 조회 권한이 없습니다. Meta 앱의 threads_profile_discovery 권한을 확인해 주세요.",
    );
  }

  return new Error(
    apiMessage
      ? `Threads API 오류: ${apiMessage}`
      : `Threads API 오류 (${status})`,
  );
}

async function fetchThreadsJson(resource, accessToken, options = {}) {
  const requestUrl = new URL(resource);
  if (requestUrl.origin !== API_HOST) {
    throw new Error("허용되지 않은 Threads API 주소입니다.");
  }
  requestUrl.searchParams.set("access_token", accessToken);

  const response = await fetchWithTimeout(requestUrl.toString(), {
    signal: options.signal,
    timeoutMs: options.timeoutMs || 15000,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw threadsApiError(payload, response.status);
  }
  return payload;
}

function safeNextPageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.origin !== API_HOST) {
      return "";
    }
    url.searchParams.delete("access_token");
    return url.toString();
  } catch (error) {
    return "";
  }
}

async function findPostByShortcode(info, accessToken, options = {}) {
  const firstUrl = new URL(`${API_HOST}/profile_posts`);
  firstUrl.searchParams.set("username", info.username);
  firstUrl.searchParams.set("fields", LIST_FIELDS);
  firstUrl.searchParams.set("limit", "100");

  let nextUrl = firstUrl.toString();
  const maxPages = Math.max(1, Number(options.maxPages) || 8);

  for (let page = 0; page < maxPages && nextUrl; page += 1) {
    const payload = await fetchThreadsJson(nextUrl, accessToken, options);
    const post = (Array.isArray(payload.data) ? payload.data : []).find(
      (item) => String(item?.shortcode || "") === info.shortcode,
    );
    if (post) {
      return post;
    }
    nextUrl = safeNextPageUrl(payload?.paging?.next);
  }

  throw new Error(
    "해당 Threads 글을 공개 프로필 목록에서 찾지 못했습니다. 오래된 글·답글·비공개 계정은 API에서 조회되지 않을 수 있습니다.",
  );
}

async function fetchPostDetails(postId, accessToken, options = {}) {
  const url = new URL(`${API_HOST}/${encodeURIComponent(postId)}`);
  url.searchParams.set("fields", DETAIL_FIELDS);
  return fetchThreadsJson(url.toString(), accessToken, options);
}

function childrenOf(post) {
  if (Array.isArray(post?.children?.data)) {
    return post.children.data;
  }
  if (Array.isArray(post?.children)) {
    return post.children;
  }
  return [];
}

export function extractThreadsImageUrls(post) {
  const children = childrenOf(post);
  if (children.length) {
    return children.flatMap(extractThreadsImageUrls).slice(0, 4);
  }

  const mediaType = String(post?.media_type || "").toUpperCase();
  const imageUrl =
    mediaType === "VIDEO"
      ? post?.thumbnail_url
      : post?.media_url || post?.thumbnail_url;
  return imageUrl ? [String(imageUrl)] : [];
}

function withLinkAttachment(text, linkAttachmentUrl) {
  const body = String(text || "").trim();
  const link = String(linkAttachmentUrl || "").trim();
  if (!link || body.includes(link)) {
    return body;
  }
  return body ? `${body}\n${link}` : link;
}

function toPostMeta(post) {
  const username = String(post?.username || "").trim();
  return {
    authorName: username || "Threads User",
    authorHandle: normalizeHandle(username, "@threads"),
    authorProfileImageUrl: String(post?.profile_picture_url || ""),
    text: withLinkAttachment(post?.text, post?.link_attachment_url),
    sourceUrl: String(post?.permalink || ""),
    tweetDate: String(post?.timestamp || ""),
    replyCount: formatCountLabel(post?.reply_count),
    retweetCount: formatCountLabel(post?.repost_count),
    likeCount: formatCountLabel(post?.like_count),
    bookmarkCount: "0",
    imageUrls: extractThreadsImageUrls(post),
  };
}

async function expandReferencedPost(reference, accessToken, options) {
  if (!reference) {
    return null;
  }
  if (
    typeof reference === "object" &&
    (reference.text || reference.media_url)
  ) {
    return reference;
  }
  const id =
    typeof reference === "object"
      ? String(reference.id || "")
      : String(reference);
  if (!id) {
    return typeof reference === "object" ? reference : null;
  }
  try {
    return await fetchPostDetails(id, accessToken, options);
  } catch (error) {
    return typeof reference === "object" ? reference : null;
  }
}

async function collectReplyParents(post, accessToken, options = {}) {
  const parents = [];
  const seen = new Set([String(post?.id || "")]);
  let reference = post?.replied_to;

  while (reference && parents.length < 6) {
    const parent = await expandReferencedPost(reference, accessToken, options);
    const parentId = String(parent?.id || "");
    if (!parent || (parentId && seen.has(parentId))) {
      break;
    }
    if (parentId) {
      seen.add(parentId);
    }
    parents.push(toPostMeta(parent));
    reference = parent.replied_to;
  }

  return parents.reverse();
}

export async function fetchThreadsPost(info, options = {}) {
  const accessToken = String(options.accessToken || "").trim();
  if (!accessToken) {
    throw new Error(
      "Threads 링크를 불러오려면 아래 ‘Threads API 설정’에 사용자 액세스 토큰을 입력해 주세요.",
    );
  }

  const listedPost = await findPostByShortcode(info, accessToken, options);
  let post = listedPost;
  try {
    post = await fetchPostDetails(listedPost.id, accessToken, options);
  } catch (error) {
    // The list response is enough for a capture even if detail permission is narrower.
  }

  const quotedReference = post.quoted_post || post.reposted_post;
  const [quotedPost, replyParents] = await Promise.all([
    expandReferencedPost(quotedReference, accessToken, options),
    collectReplyParents(post, accessToken, options),
  ]);

  return {
    post: toPostMeta(post),
    quote: quotedPost ? toPostMeta(quotedPost) : null,
    replyParents,
  };
}
