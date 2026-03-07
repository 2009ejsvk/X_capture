import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = __dirname;
const port = Number(process.env.PORT || 5173);
const allowedStaticPaths = new Set([
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/threads-app.js",
  "/mode-switch.js",
]);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-type": "text/plain; charset=utf-8",
  });
  response.end(message);
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const parsed = Number.parseInt(code, 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
    })
    .replace(/&#(\d+);/g, (_, code) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
    })
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeHandle(rawHandle) {
  const value = normalizeWhitespace(rawHandle).replace(/^@+/, "");
  return value ? `@${value}` : "";
}

function parseTitleMeta(title) {
  const decoded = normalizeWhitespace(decodeHtmlEntities(title));
  const matched = decoded.match(/^(?:Threads의\s*)?(.*?)\s*\((?:@|＠)?([^)]+)\).*$/i);
  if (!matched) {
    return {
      authorHandle: "",
      authorName: "",
      decodedTitle: decoded,
    };
  }

  return {
    authorHandle: normalizeHandle(matched[2]),
    authorName: normalizeWhitespace(matched[1]),
    decodedTitle: decoded,
  };
}

function extractMetaMap(html) {
  const metaMap = new Map();
  const metaPattern = /<meta\s+([^>]+?)\/?>/gi;
  const attrPattern = /([a-zA-Z:-]+)\s*=\s*"([^"]*)"/g;
  let metaMatch;

  while ((metaMatch = metaPattern.exec(html)) !== null) {
    const attributes = metaMatch[1];
    const attributeMap = new Map();
    let attrMatch;

    while ((attrMatch = attrPattern.exec(attributes)) !== null) {
      attributeMap.set(attrMatch[1].toLowerCase(), attrMatch[2]);
    }

    const key = attributeMap.get("property") || attributeMap.get("name");
    const content = attributeMap.get("content");
    if (key && typeof content === "string") {
      metaMap.set(key.toLowerCase(), content);
    }
  }

  return metaMap;
}

function extractCanonicalUrl(html) {
  const matched = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
  return matched ? decodeHtmlEntities(matched[1]) : "";
}

function decodeJsonStringLiteral(value) {
  const raw = String(value || "");
  if (!raw) {
    return "";
  }

  try {
    return JSON.parse(`"${raw}"`);
  } catch (error) {
    return raw
      .replace(/\\\//g, "/")
      .replace(/\\u0025/gi, "%")
      .replace(/\\u0026/gi, "&");
  }
}

function getAssetSignature(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || "").trim());
    return `${parsed.origin}${parsed.pathname}`.toLowerCase();
  } catch (error) {
    return "";
  }
}

function extractShortcodeFromUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || "").trim());
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments[0] === "t" && segments[1]) {
      return segments[1];
    }

    const postIndex = segments.findIndex((segment) => segment.toLowerCase() === "post");
    return postIndex >= 0 && segments[postIndex + 1] ? segments[postIndex + 1] : "";
  } catch (error) {
    return "";
  }
}

function formatTimestampLabel(timestampSeconds) {
  const timestamp = Number(timestampSeconds);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "";
  }

  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function extractCandidateImageUrls(segment) {
  const candidateBlocks = [...String(segment || "").matchAll(/"image_versions2":\{"candidates":\[(.*?)\]\}/g)];
  if (!candidateBlocks.length) {
    return [];
  }

  const seen = new Set();
  const urls = [];

  candidateBlocks.forEach((blockMatch) => {
    const block = blockMatch[1];
    const urlMatches = [...block.matchAll(/"url":"((?:\\.|[^"])*)"/g)];
    urlMatches.forEach((urlMatch) => {
      const decodedUrl = decodeJsonStringLiteral(urlMatch[1]);
      const signature = getAssetSignature(decodedUrl) || decodedUrl;
      if (!decodedUrl || seen.has(signature)) {
        return;
      }
      seen.add(signature);
      urls.push(decodedUrl);
    });
  });

  return urls.slice(0, 4);
}

function extractThreadStructuredData(html, canonicalUrl) {
  const shortcode = extractShortcodeFromUrl(canonicalUrl);
  const source = String(html || "");
  const fallbackTakenAt = source.match(/"taken_at":(\d{9,})/);

  if (!shortcode) {
    return {
      imageUrls: [],
      takenAt: fallbackTakenAt ? Number(fallbackTakenAt[1]) : 0,
    };
  }

  const escapedShortcode = shortcode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const codePattern = new RegExp(`"code":"${escapedShortcode}"([\\s\\S]{0,20000}?)"taken_at":(\\d{9,})`);
  const codeMatch = source.match(codePattern);

  if (!codeMatch) {
    return {
      imageUrls: [],
      takenAt: fallbackTakenAt ? Number(fallbackTakenAt[1]) : 0,
    };
  }

  return {
    imageUrls: extractCandidateImageUrls(codeMatch[1]),
    takenAt: Number(codeMatch[2]),
  };
}

function extractHandleFromUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const rawSegment = segments.find((segment) => segment.startsWith("@")) || segments[0] || "";
    return normalizeHandle(decodeURIComponent(rawSegment));
  } catch (error) {
    return "";
  }
}

function normalizeThreadUrl(input) {
  const value = String(input || "").trim();
  if (!value) {
    throw new Error("Threads 게시물 링크를 입력해 주세요.");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error("URL 형식이 올바르지 않습니다.");
  }

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "threads.com" && host !== "threads.net") {
    throw new Error("threads.com 또는 threads.net 링크만 지원합니다.");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (!segments.length) {
    throw new Error("Threads 게시물 링크 형식이 아닙니다.");
  }

  if (segments[0] === "t" && segments[1]) {
    return `https://www.threads.com/t/${segments[1]}`;
  }

  const postIndex = segments.findIndex((segment) => segment.toLowerCase() === "post");
  if (postIndex < 1 || !segments[postIndex + 1]) {
    throw new Error("지원하지 않는 Threads 게시물 링크 형식입니다.");
  }

  const handleSegment = segments[postIndex - 1];
  return `https://www.threads.com/${handleSegment}/post/${segments[postIndex + 1]}`;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Threads 페이지를 불러오지 못했습니다. (${response.status})`);
  }

  return response.text();
}

function buildImageProxyUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  return value ? `/api/image?url=${encodeURIComponent(value)}` : "";
}

async function resolveProfileMeta(authorHandle) {
  if (!authorHandle) {
    return {
      avatarUrl: "",
      profileUrl: "",
    };
  }

  const profileUrl = `https://www.threads.com/${authorHandle}`;

  try {
    const html = await fetchHtml(profileUrl);
    const meta = extractMetaMap(html);
    const avatarUrl = decodeHtmlEntities(meta.get("og:image") || meta.get("twitter:image") || "");

    return {
      avatarUrl,
      profileUrl,
    };
  } catch (error) {
    return {
      avatarUrl: "",
      profileUrl: "",
    };
  }
}

async function fetchThreadPayload(inputUrl) {
  const threadUrl = normalizeThreadUrl(inputUrl);
  const html = await fetchHtml(threadUrl);
  const meta = extractMetaMap(html);
  const canonicalUrl =
    extractCanonicalUrl(html) ||
    decodeHtmlEntities(meta.get("og:url") || "") ||
    threadUrl;
  const titleMeta = meta.get("og:title") || meta.get("twitter:title") || "";
  const descriptionMeta =
    meta.get("og:description") ||
    meta.get("description") ||
    meta.get("twitter:description") ||
    "";
  const imageMeta = meta.get("og:image") || meta.get("twitter:image") || "";

  const { authorName, authorHandle } = parseTitleMeta(titleMeta);
  const fallbackHandle = extractHandleFromUrl(canonicalUrl);
  const normalizedHandle = authorHandle || fallbackHandle || "@threads";
  const normalizedAuthorName =
    authorName ||
    normalizeWhitespace(normalizedHandle.replace(/^@/, "")) ||
    "Threads User";
  const threadText = decodeHtmlEntities(descriptionMeta).trim();
  const heroImageUrl = decodeHtmlEntities(imageMeta).trim();
  const profileMeta = await resolveProfileMeta(normalizedHandle);
  const structuredData = extractThreadStructuredData(html, canonicalUrl);
  const profileImageSignature = getAssetSignature(profileMeta.avatarUrl);
  const heroImageSignature = getAssetSignature(heroImageUrl);
  const fallbackMediaUrl =
    heroImageUrl && heroImageSignature && heroImageSignature !== profileImageSignature ? heroImageUrl : "";
  const resolvedMediaUrls = structuredData.imageUrls.length
    ? structuredData.imageUrls
    : fallbackMediaUrl
      ? [fallbackMediaUrl]
      : [];

  return {
    authorHandle: normalizedHandle,
    authorName: normalizedAuthorName,
    fetchedAt: new Date().toISOString(),
    imageUrls: resolvedMediaUrls.map(buildImageProxyUrl),
    profileImageUrl: profileMeta.avatarUrl ? buildImageProxyUrl(profileMeta.avatarUrl) : "",
    profileUrl: profileMeta.profileUrl,
    sourceUrl: canonicalUrl,
    threadDate: formatTimestampLabel(structuredData.takenAt),
    threadText,
    warnings: [
      "Threads 공개 메타를 기준으로 불러옵니다.",
      "게시 시각과 추가 이미지는 자동 추출이 제한될 수 있어 필요하면 수동으로 보정하세요.",
    ],
  };
}

async function handleThreadApi(requestUrl, response) {
  try {
    const inputUrl = requestUrl.searchParams.get("url");
    const payload = await fetchThreadPayload(inputUrl);
    sendJson(response, 200, payload);
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : "Threads 링크를 처리하지 못했습니다.",
    });
  }
}

async function handleImageProxy(requestUrl, response) {
  const remoteUrl = String(requestUrl.searchParams.get("url") || "").trim();
  if (!remoteUrl) {
    sendJson(response, 400, { error: "이미지 URL이 필요합니다." });
    return;
  }

  let parsed;
  try {
    parsed = new URL(remoteUrl);
  } catch (error) {
    sendJson(response, 400, { error: "이미지 URL 형식이 올바르지 않습니다." });
    return;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    sendJson(response, 400, { error: "http/https 이미지만 프록시할 수 있습니다." });
    return;
  }

  try {
    const upstream = await fetch(parsed, {
      redirect: "follow",
    });

    if (!upstream.ok || !upstream.body) {
      throw new Error(`upstream ${upstream.status}`);
    }

    response.writeHead(200, {
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600",
      "content-type": upstream.headers.get("content-type") || "application/octet-stream",
    });

    Readable.fromWeb(upstream.body).pipe(response);
  } catch (error) {
    sendJson(response, 502, { error: "원격 이미지를 가져오지 못했습니다." });
  }
}

function getFilePathFromRequest(requestPath) {
  const decodedPath = decodeURIComponent(requestPath);
  const relativePath = decodedPath === "/" ? "/index.html" : decodedPath;
  if (!allowedStaticPaths.has(decodedPath) && !allowedStaticPaths.has(relativePath)) {
    return "";
  }
  const absolutePath = path.resolve(publicDir, `.${relativePath}`);

  if (!absolutePath.startsWith(publicDir)) {
    return "";
  }

  return absolutePath;
}

async function handleStatic(requestPath, response) {
  const filePath = getFilePathFromRequest(requestPath);
  if (!filePath) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    await access(filePath);
  } catch (error) {
    sendText(response, 404, "Not Found");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    "access-control-allow-origin": "*",
    "cache-control": extension === ".html" ? "no-store" : "public, max-age=300",
    "content-type": mimeTypes[extension] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

export const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendText(response, 400, "Bad Request");
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    response.end();
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/thread") {
    await handleThreadApi(requestUrl, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/image") {
    await handleImageProxy(requestUrl, response);
    return;
  }

  if (request.method !== "GET") {
    sendText(response, 405, "Method Not Allowed");
    return;
  }

  await handleStatic(requestUrl.pathname, response);
});

server.listen(port, () => {
  console.log(`Capture server running at http://localhost:${port}`);
});
