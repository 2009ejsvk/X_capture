export function formatNumericDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function currentDateTimeLabel() {
  return formatNumericDateTime(new Date());
}

const compactCountFormatter = new Intl.NumberFormat("ko-KR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCountLabel(rawValue) {
  if (rawValue == null) {
    return "0";
  }

  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    if (rawValue < 1000) {
      return Math.round(rawValue).toLocaleString("ko-KR");
    }
    return compactCountFormatter.format(rawValue);
  }

  const text = String(rawValue).trim();
  if (!text) {
    return "0";
  }

  if (/^\d[\d,]*$/.test(text)) {
    const parsed = Number(text.replace(/,/g, ""));
    if (Number.isFinite(parsed)) {
      if (parsed < 1000) {
        return parsed.toLocaleString("ko-KR");
      }
      return compactCountFormatter.format(parsed);
    }
  }

  return text;
}

function flagEmojiToCode(flagEmoji) {
  const codePoints = Array.from(String(flagEmoji || ""), (char) =>
    char.codePointAt(0),
  );
  if (codePoints.length !== 2) {
    return "";
  }

  const base = 0x1f1e6;
  const letters = codePoints.map((point) => {
    if (!Number.isFinite(point) || point < base || point > 0x1f1ff) {
      return "";
    }
    return String.fromCharCode(65 + (point - base));
  });

  if (letters.some((letter) => !letter)) {
    return "";
  }

  return letters.join("");
}

export function toDisplayText(value) {
  if (value === null || value === undefined || value === false) {
    return "";
  }
  return String(value).replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, (match) => {
    const code = flagEmojiToCode(match);
    return code ? `[${code}]` : match;
  });
}

export function parseHandle(authorUrl, fallbackName) {
  try {
    const path = new URL(authorUrl).pathname;
    const segment = path.split("/").filter(Boolean)[0];
    if (segment) {
      return segment.startsWith("@") ? segment : `@${segment}`;
    }
  } catch (error) {
    // Intentionally ignored.
  }

  if (!fallbackName) {
    return "@x";
  }

  const compact = fallbackName.replace(/\s+/g, "");
  return compact.startsWith("@") ? compact : `@${compact}`;
}

export function normalizeHandle(rawHandle, fallbackHandle) {
  const value = String(rawHandle || "").trim();
  if (!value) {
    if (typeof fallbackHandle === "undefined") {
      return "@x";
    }
    return String(fallbackHandle || "").trim();
  }
  return value.startsWith("@") ? value : `@${value}`;
}

export function pickFirstNonEmpty(values) {
  for (const value of values) {
    if (value == null || typeof value === "boolean") {
      continue;
    }
    const text = String(value).trim();
    if (text) {
      return text;
    }
  }
  return "";
}

export function extractTweetId(value) {
  const matched = String(value || "").match(/\d{5,}/);
  return matched ? matched[0] : "";
}

export function normalizeUrl(input) {
  const urlText = (input || "").trim();
  if (!urlText) {
    throw new Error("트윗 URL을 입력해 주세요.");
  }

  let url;
  try {
    url = new URL(urlText);
  } catch (error) {
    throw new Error("URL 형식이 올바르지 않습니다.");
  }

  const host = url.hostname.replace(/^www\./i, "");
  const isXHost =
    host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com";
  if (!isXHost) {
    throw new Error("x.com 또는 twitter.com URL만 지원합니다.");
  }

  const idMatch = url.pathname.match(/\/status\/(\d+)/i);
  if (!idMatch) {
    throw new Error("트윗 상세 URL(/status/숫자) 형식만 지원합니다.");
  }

  const tweetId = idMatch[1];
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const statusIndex = pathSegments.findIndex(
    (segment) => segment.toLowerCase() === "status",
  );
  const beforeStatus =
    statusIndex > 0 ? (pathSegments[statusIndex - 1] || "").toLowerCase() : "";
  const isUserPath =
    beforeStatus && beforeStatus !== "i" && beforeStatus !== "web";

  // /photo/1, /video/1, /i/web/status/... 같은 변형 링크를 정규화한다.
  const preferredUrl = isUserPath
    ? `https://x.com/${pathSegments[statusIndex - 1]}/status/${tweetId}`
    : `https://x.com/i/status/${tweetId}`;

  return {
    tweetId,
    preferredUrl,
    canonicalUrl: `https://x.com/i/status/${tweetId}`,
    twitterCanonicalUrl: `https://twitter.com/i/status/${tweetId}`,
  };
}

export function formatDateLabel(rawDate) {
  if (!rawDate) {
    return currentDateTimeLabel();
  }

  const normalizedRawDate = String(rawDate).trim();
  if (!normalizedRawDate) {
    return currentDateTimeLabel();
  }

  const parsed = new Date(normalizedRawDate);
  if (Number.isNaN(parsed.getTime())) {
    const candidates = [normalizedRawDate];
    const dotParts = normalizedRawDate
      .split("·")
      .map((part) => part.trim())
      .filter(Boolean);

    if (dotParts.length >= 2) {
      const left = dotParts[0];
      const right = dotParts.slice(1).join(" ");
      candidates.push(`${right} ${left}`);
      candidates.push(right);
    }

    for (const candidate of candidates) {
      const reparsed = new Date(candidate);
      if (!Number.isNaN(reparsed.getTime())) {
        return formatNumericDateTime(reparsed);
      }
    }

    return normalizedRawDate;
  }

  return formatNumericDateTime(parsed);
}

function stripAllLinks(rawText) {
  return String(rawText || "")
    .replace(/https?:\/\/[^\s]+/gi, "")
    .replace(/\bpic\.twitter\.com\/[^\s]+/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function sanitizeFetchedTweetText(rawText) {
  const normalized = String(rawText || "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!normalized) {
    return "";
  }

  const withoutLinks = stripAllLinks(normalized);
  if (!withoutLinks) {
    return "";
  }

  // If only a single URL remains, consider it empty
  if (/^https?:\/\/\S+$/i.test(withoutLinks)) {
    return "";
  }

  return withoutLinks;
}
