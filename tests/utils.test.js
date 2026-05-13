import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCountLabel,
  normalizeUrl,
  sanitizeFetchedTweetText,
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

test("sanitizeFetchedTweetText strips URL-only noise", () => {
  assert.equal(
    sanitizeFetchedTweetText("hello https://t.co/abc\npic.twitter.com/xyz"),
    "hello",
  );
  assert.equal(sanitizeFetchedTweetText("https://x.com/example/status/1"), "");
});

test("formatCountLabel compacts large numbers", () => {
  assert.equal(formatCountLabel("999"), "999");
  assert.equal(formatCountLabel("1,200"), "1.2천");
});
