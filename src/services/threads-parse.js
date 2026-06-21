import {
  formatCountLabel,
  formatDateLabel,
  normalizeHandle,
  sanitizeFetchedTweetText,
} from "../utils.js";

// Threads (threads.com / threads.net) serves Open Graph tags and a rich inline
// JSON payload ONLY to crawler user agents (e.g. facebookexternalhit). The
// local proxy fetches with that UA; this module turns the resulting HTML into a
// normalized tweet-like meta object. It performs no network access so it can be
// unit tested with synthetic HTML.

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => {
      const point = Number(code);
      return Number.isFinite(point) ? String.fromCodePoint(point) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const point = parseInt(code, 16);
      return Number.isFinite(point) ? String.fromCodePoint(point) : _;
    })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function extractOgTag(html, property) {
  const pattern = new RegExp(
    `<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const matched = String(html || "").match(pattern);
  return matched ? decodeHtmlEntities(matched[1]) : "";
}

function parseAuthorFromOgTitle(ogTitle) {
  // Format: "Display Name (@handle) on Threads"
  const matched = String(ogTitle || "").match(/^(.*)\(([^)]+)\)\s*on Threads/i);
  if (!matched) {
    return { authorName: String(ogTitle || "").trim(), authorHandle: "" };
  }
  return {
    authorName: matched[1].trim(),
    authorHandle: normalizeHandle(matched[2].trim(), ""),
  };
}

function extractJsonScripts(html) {
  const scripts = [];
  const pattern =
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(String(html || ""))) !== null) {
    try {
      scripts.push(JSON.parse(match[1]));
    } catch (error) {
      // Skip unparseable blocks; Threads ships many unrelated JSON scripts.
    }
  }
  return scripts;
}

function isThreadsPostNode(node) {
  return Boolean(
    node &&
    typeof node === "object" &&
    node.caption &&
    typeof node.caption === "object" &&
    typeof node.caption.text === "string" &&
    ("like_count" in node || "repost_count" in node),
  );
}

function findNode(root, predicate, maxNodes = 200000) {
  const queue = [root];
  let visited = 0;

  while (queue.length && visited < maxNodes) {
    const current = queue.shift();
    visited += 1;

    if (!current || typeof current !== "object") {
      continue;
    }

    if (predicate(current)) {
      return current;
    }

    for (const value of Array.isArray(current)
      ? current
      : Object.values(current)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return null;
}

function pickLargestCandidate(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) {
    return "";
  }
  const sorted = [...candidates]
    .filter((item) => item && typeof item.url === "string")
    .sort((left, right) => (right.width || 0) - (left.width || 0));
  return sorted.length ? sorted[0].url : "";
}

function collectPostImages(node) {
  const urls = [];

  const pushFrom = (entry) => {
    const candidate =
      entry &&
      entry.image_versions2 &&
      Array.isArray(entry.image_versions2.candidates)
        ? pickLargestCandidate(entry.image_versions2.candidates)
        : "";
    if (candidate) {
      urls.push(candidate);
    }
  };

  if (Array.isArray(node.carousel_media) && node.carousel_media.length) {
    node.carousel_media.forEach(pushFrom);
  } else {
    pushFrom(node);
  }

  return [...new Set(urls.filter(Boolean))].slice(0, 4);
}

export function parseThreadsHtml(html, options = {}) {
  const ogTitle = extractOgTag(html, "title");
  const ogDescription = extractOgTag(html, "description");
  const ogImage = extractOgTag(html, "image");
  const ogUrl = extractOgTag(html, "url");

  const { authorName: ogName, authorHandle: ogHandle } =
    parseAuthorFromOgTitle(ogTitle);

  const scripts = extractJsonScripts(html);

  let postNode = null;
  for (const script of scripts) {
    postNode = findNode(script, isThreadsPostNode);
    if (postNode) {
      break;
    }
  }

  // Threads keeps repost/quote counts on a sibling node separate from the
  // media node that carries the caption and like_count.
  let countsNode = postNode && "repost_count" in postNode ? postNode : null;
  if (!countsNode) {
    for (const script of scripts) {
      countsNode = findNode(
        script,
        (node) => "repost_count" in node || "quote_count" in node,
      );
      if (countsNode) {
        break;
      }
    }
  }
  const counts = countsNode || {};

  const user = postNode && postNode.user ? postNode.user : null;
  const authorName =
    (user && (user.full_name || user.username)) || ogName || "Threads User";
  const authorHandle = normalizeHandle(
    (user && user.username) || ogHandle.replace(/^@/, ""),
    ogHandle || "",
  );
  const authorProfileImageUrl =
    (user && user.profile_pic_url) || (postNode ? "" : "");

  const rawText =
    (postNode && postNode.caption && postNode.caption.text) || ogDescription;
  const text = sanitizeFetchedTweetText(rawText);

  const imageUrls = postNode ? collectPostImages(postNode) : [];

  const tweetDate =
    postNode && Number.isFinite(Number(postNode.taken_at))
      ? formatDateLabel(
          new Date(Number(postNode.taken_at) * 1000).toISOString(),
        )
      : formatDateLabel("");

  const sourceUrl =
    ogUrl ||
    (postNode && postNode.code
      ? `https://www.threads.com/t/${postNode.code}`
      : options.sourceUrl || "");

  return {
    sourceUrl,
    authorName,
    authorHandle,
    authorProfileImageUrl,
    text,
    imageUrls,
    profileImageUrl: authorProfileImageUrl || ogImage || "",
    tweetDate,
    replyCount: formatCountLabel(
      (postNode && postNode.reply_count) ?? counts.reply_count ?? "",
    ),
    retweetCount: formatCountLabel(counts.repost_count ?? ""),
    likeCount: formatCountLabel(postNode ? postNode.like_count : ""),
    bookmarkCount: formatCountLabel(counts.quote_count ?? ""),
  };
}
