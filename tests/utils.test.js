import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeHtmlEntities,
  formatCountLabel,
  normalizeUrl,
  sanitizeFetchedTweetText,
  stripLeadingReplyMentions,
  toDisplayText,
} from "../src/utils.js";

test("normalizeUrl extracts and canonicalizes status URLs", () => {
  const result = normalizeUrl(
    "https://x.com/example/status/1234567890/photo/1",
  );

  assert.equal(result.tweetId, "1234567890");
  assert.equal(result.preferredUrl, "https://x.com/example/status/1234567890");
  assert.equal(result.canonicalUrl, "https://x.com/i/status/1234567890");
});

test("normalizeUrl rejects unsupported hosts", () => {
  assert.throws(
    () => normalizeUrl("https://example.com/example/status/1234567890"),
    /x\.com 또는 twitter\.com/,
  );
});

test("sanitizeFetchedTweetText preserves links and strips media noise", () => {
  assert.equal(
    sanitizeFetchedTweetText("hello https://t.co/abc\npic.twitter.com/xyz"),
    "hello https://t.co/abc",
  );
  assert.equal(
    sanitizeFetchedTweetText("hello https://t.co/abc\npic.twitter.com/xyz", {
      stripShortLinks: true,
    }),
    "hello https://t.co/abc",
  );
  assert.equal(
    sanitizeFetchedTweetText("https://t.co/media", {
      stripShortLinks: true,
    }),
    "",
  );
  assert.equal(
    sanitizeFetchedTweetText("https://x.com/example/status/1"),
    "https://x.com/example/status/1",
  );
});

test("formatCountLabel compacts large numbers", () => {
  assert.equal(formatCountLabel("999"), "999");
  assert.equal(formatCountLabel("1,200"), "1.2천");
});

test("stripLeadingReplyMentions removes only reply targets at the start", () => {
  assert.equal(
    stripLeadingReplyMentions("@0mislice @thatdayin1992 🥺 moronic take"),
    "🥺 moronic take",
  );
  assert.equal(
    stripLeadingReplyMentions("@thatdayin1992\nShiiiiiiid"),
    "Shiiiiiiid",
  );
  assert.equal(
    stripLeadingReplyMentions("mention later @0mislice"),
    "mention later @0mislice",
  );
});

test("toDisplayText preserves flag emoji", () => {
  assert.equal(toDisplayText("Korea 🇰🇷 Japan 🇯🇵"), "Korea 🇰🇷 Japan 🇯🇵");
});

test("decodeHtmlEntities restores escaped characters exactly once", () => {
  assert.equal(decodeHtmlEntities("a -&gt; b"), "a -> b");
  assert.equal(decodeHtmlEntities("Tom &amp; Jerry"), "Tom & Jerry");
  assert.equal(decodeHtmlEntities("&lt;3"), "<3");
  assert.equal(decodeHtmlEntities("it&#39;s"), "it's");
  assert.equal(decodeHtmlEntities("&#x1F600;"), "\u{1F600}");
  // 이중 디코딩 금지: 사용자가 실제로 "&lt;" 문자열을 쓴 경우
  assert.equal(decodeHtmlEntities("&amp;lt;"), "&lt;");
  assert.equal(decodeHtmlEntities("&unknown; stays"), "&unknown; stays");
});

test("sanitizeFetchedTweetText decodes entities from the raw API text", () => {
  assert.equal(
    sanitizeFetchedTweetText("if (a &lt; b) return a -&gt; b &amp; c;"),
    "if (a < b) return a -> b & c;",
  );
});
