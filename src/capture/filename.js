function extractTweetId(sourceUrl) {
  const matched = String(sourceUrl || "").match(/\/status\/(\d{5,})/i);
  return matched ? matched[1] : "";
}

function safeFilenamePart(value, fallback = "") {
  const text = String(value || "")
    .replace(/^@/, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);

  return text || fallback;
}

function datePartFromLabel(tweetDate, timestamp) {
  const matched = String(tweetDate || "").match(
    /\d{4}[-./]\d{1,2}[-./]\d{1,2}/,
  );
  if (matched) {
    return matched[0]
      .split(/\D+/)
      .map((part) => part.padStart(2, "0"))
      .join("");
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export function createCaptureFilename(
  { authorHandle, authorName, tweetDate, sourceUrl } = {},
  extension = "png",
  timestamp = Date.now(),
) {
  const authorPart = safeFilenamePart(authorHandle || authorName, "x-capture");
  const datePart = safeFilenamePart(datePartFromLabel(tweetDate, timestamp));
  const tweetId = safeFilenamePart(extractTweetId(sourceUrl));
  const extensionPart = safeFilenamePart(extension, "png").toLowerCase();
  const parts = [authorPart, datePart, tweetId].filter(Boolean);

  return `${parts.join("-")}.${extensionPart}`;
}
