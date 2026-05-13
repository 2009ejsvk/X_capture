import { fetchWithTimeout } from "./services/http.js";

const imageSourceCache = new Map();

export function normalizeMediaItems(items) {
  const seen = new Set();

  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (typeof item === "string") {
        const src = item.trim();
        return src ? { src, visible: true } : null;
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const src = String(item.src || item.url || "").trim();
      if (!src) {
        return null;
      }

      return {
        src,
        visible: item.visible !== false,
      };
    })
    .filter((item) => {
      if (!item || seen.has(item.src)) {
        return false;
      }
      seen.add(item.src);
      return true;
    })
    .slice(0, 4);
}

export function getVisibleMediaSrcs(items) {
  return normalizeMediaItems(items)
    .filter((item) => item.visible)
    .map((item) => item.src);
}

async function dataUrlFromRemoteImage(imageUrl, options = {}) {
  if (!imageUrl) {
    return "";
  }

  try {
    const response = await fetchWithTimeout(imageUrl, {
      signal: options.signal,
      timeoutMs: options.timeoutMs || 10000,
    });
    if (!response.ok) {
      return "";
    }

    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("이미지 변환 실패"));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    return "";
  }
}

export function clearImageSourceCache() {
  imageSourceCache.clear();
}

export async function toDisplayImageSrc(imageUrl, options = {}) {
  const normalizedUrl = String(imageUrl || "").trim();
  if (!normalizedUrl) {
    return "";
  }

  if (!options.signal && imageSourceCache.has(normalizedUrl)) {
    return imageSourceCache.get(normalizedUrl);
  }

  const loader = dataUrlFromRemoteImage(normalizedUrl, options).then(
    (dataUrl) => {
      return dataUrl || normalizedUrl;
    },
  );

  if (!options.signal) {
    imageSourceCache.set(normalizedUrl, loader);
  }

  return loader;
}

export async function toDisplayImageSrcs(imageUrls, options = {}) {
  const uniqueUrls = normalizeMediaItems(imageUrls)
    .map((item) => item.src)
    .slice(0, 4);

  if (!uniqueUrls.length) {
    return [];
  }

  const converted = await Promise.all(
    uniqueUrls.map((url) => toDisplayImageSrc(url, options)),
  );
  return normalizeMediaItems(converted.filter(Boolean));
}
