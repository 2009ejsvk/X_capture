import { fetchWithTimeout } from "./http.js";

export function parseOembedHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");
  const blockquote = doc.querySelector("blockquote.twitter-tweet");
  const textNode = blockquote ? blockquote.querySelector("p") : null;
  const text = textNode
    ? extractTextPreserveSpaces(textNode).replace(/\r\n/g, "\n")
    : "";

  const linkNodes = blockquote ? [...blockquote.querySelectorAll("a")] : [];
  const dateNode = linkNodes.length ? linkNodes[linkNodes.length - 1] : null;
  const dateLabel = dateNode ? dateNode.textContent.trim() : "";

  return { text, dateLabel };
}

function extractTextPreserveSpaces(node) {
  if (!node) {
    return "";
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue || "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  if (node.tagName === "BR") {
    return "\n";
  }

  let output = "";
  node.childNodes.forEach((child) => {
    output += extractTextPreserveSpaces(child);
  });
  return output;
}

async function fetchOembed(url, options = {}) {
  const endpoint = `https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=${encodeURIComponent(url)}`;
  const response = await fetchWithTimeout(endpoint, {
    signal: options.signal,
    timeoutMs: options.timeoutMs || 10000,
  });
  if (!response.ok) {
    const error = new Error(`oEmbed 오류 (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function fetchTweetFromOembed(info, options = {}) {
  const urls = [info.preferredUrl, info.canonicalUrl, info.twitterCanonicalUrl];
  let lastError = null;

  for (const url of urls) {
    try {
      const payload = await fetchOembed(url, options);
      return { payload, usedUrl: url };
    } catch (error) {
      if (options.signal && options.signal.aborted) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError || new Error("oEmbed 호출에 실패했습니다.");
}

export function formatOembedError(error) {
  if (error && typeof error === "object" && "status" in error) {
    const status = Number(error.status);
    if (status === 404) {
      return "oEmbed에서 트윗을 찾지 못했습니다.";
    }

    if (Number.isFinite(status)) {
      return `oEmbed 오류 (${status})`;
    }
  }

  return "oEmbed 네트워크 오류";
}
