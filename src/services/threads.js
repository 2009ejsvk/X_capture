import { fetchWithTimeout } from "./http.js";

const DEFAULT_PROXY_URL = "http://localhost:5174/threads";

function resolveProxyUrl(options) {
  if (options && options.proxyUrl) {
    return options.proxyUrl;
  }
  if (typeof window !== "undefined" && window.__THREADS_PROXY_URL__) {
    return window.__THREADS_PROXY_URL__;
  }
  return DEFAULT_PROXY_URL;
}

export async function fetchThreadsPost(postUrl, options = {}) {
  const base = resolveProxyUrl(options);
  const endpoint = `${base}?url=${encodeURIComponent(postUrl)}`;

  let response;
  try {
    response = await fetchWithTimeout(endpoint, {
      signal: options.signal,
      timeoutMs: options.timeoutMs || 12000,
    });
  } catch (error) {
    if (options.signal && options.signal.aborted) {
      throw error;
    }
    throw new Error(
      "Threads 프록시에 연결하지 못했습니다. `node scripts/threads-proxy.mjs`가 실행 중인지 확인하세요.",
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && payload.error
        ? payload.error
        : `Threads 프록시 오류 (${response.status})`;
    throw new Error(message);
  }

  if (!payload || typeof payload !== "object" || payload.error) {
    throw new Error(
      (payload && payload.error) || "Threads 응답을 해석하지 못했습니다.",
    );
  }

  return payload;
}
