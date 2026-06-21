import assert from "node:assert/strict";
import test from "node:test";

import {
  detectPlatform,
  formatCountLabel,
  normalizeUrl,
  parseThreadsUrl,
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

test("detectPlatform distinguishes threads from x", () => {
  assert.equal(
    detectPlatform("https://www.threads.com/@user/post/ABC123"),
    "threads",
  );
  assert.equal(
    detectPlatform("https://threads.net/@user/post/ABC123"),
    "threads",
  );
  assert.equal(detectPlatform("https://x.com/user/status/123"), "x");
  assert.equal(detectPlatform("not a url"), "x");
});

test("parseThreadsUrl extracts code and canonicalizes", () => {
  const result = parseThreadsUrl(
    "https://www.threads.com/@jane/post/DDYEM_foiI1",
  );
  assert.equal(result.code, "DDYEM_foiI1");
  assert.equal(result.username, "@jane");
  assert.equal(
    result.canonicalUrl,
    "https://www.threads.com/@jane/post/DDYEM_foiI1",
  );

  const noUser = parseThreadsUrl("https://www.threads.com/t/DDYEM_foiI1");
  assert.equal(noUser.code, "DDYEM_foiI1");
  assert.equal(noUser.canonicalUrl, "https://www.threads.com/t/DDYEM_foiI1");
});

test("parseThreadsUrl rejects non-threads and malformed URLs", () => {
  assert.throws(
    () => parseThreadsUrl("https://x.com/user/status/123"),
    /threads\.com/,
  );
  assert.throws(
    () => parseThreadsUrl("https://www.threads.com/@jane"),
    /게시물 URL/,
  );
});
