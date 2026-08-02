const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const TRAILING_PUNCTUATION = /[),.!?:;]+$/;

export function tokenizeTextLinks(value) {
  const text = String(value || "");
  const tokens = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index || 0;
    if (index > cursor) {
      tokens.push({ type: "text", value: text.slice(cursor, index) });
    }

    const rawUrl = match[0];
    const trailing = rawUrl.match(TRAILING_PUNCTUATION)?.[0] || "";
    const url = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;
    tokens.push({ type: "link", value: url });
    if (trailing) {
      tokens.push({ type: "text", value: trailing });
    }
    cursor = index + rawUrl.length;
  }

  if (cursor < text.length) {
    tokens.push({ type: "text", value: text.slice(cursor) });
  }

  return tokens;
}

export function renderTextWithLinks(element, value) {
  element.replaceChildren();
  tokenizeTextLinks(value).forEach((token) => {
    if (token.type === "link") {
      const link = document.createElement("span");
      link.className = "tweet-link";
      link.textContent = token.value;
      element.appendChild(link);
      return;
    }

    element.appendChild(document.createTextNode(token.value));
  });
}
