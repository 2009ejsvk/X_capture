import assert from "node:assert/strict";
import test from "node:test";

import { loadThreadsFromUrl } from "../src/app/threads-loader.js";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

test("loadThreadsFromUrl maps proxy meta into the render patch", async (t) => {
  const originalFetch = globalThis.fetch;
  const postUrl = "https://www.threads.com/@jane/post/ABC123";
  const imageUrl = "https://cdn.example/post.jpg";

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (resource) => {
    const url = String(resource);
    if (url.includes("/threads?url=")) {
      return jsonResponse({
        platform: "threads",
        sourceUrl: postUrl,
        authorName: "Jane Doe",
        authorHandle: "@jane",
        text: "Hello Threads",
        imageUrls: [imageUrl],
        profileImageUrl: "https://cdn.example/jane.jpg",
        tweetDate: "2024-12-10 08:27",
        replyCount: "0",
        retweetCount: "3",
        likeCount: "25",
        bookmarkCount: "2",
      });
    }
    // image fetches fall back to the original URL (no FileReader in Node)
    return jsonResponse({}, 404);
  };

  const result = await loadThreadsFromUrl(postUrl, { timeoutMs: 0 });

  assert.equal(result.usedFallback, false);
  assert.equal(result.patch.platform, "threads");
  assert.equal(result.patch.authorName, "Jane Doe");
  assert.equal(result.patch.authorHandle, "@jane");
  assert.equal(result.patch.tweetText, "Hello Threads");
  assert.equal(result.patch.likeCount, "25");
  assert.equal(result.patch.retweetCount, "3");
  assert.deepEqual(result.patch.imageDataUrls, [
    { src: imageUrl, visible: true },
  ]);
  // Threads import clears quote/reply context
  assert.deepEqual(result.patch.replyParents, []);
});

test("loadThreadsFromUrl surfaces proxy errors", async (t) => {
  const originalFetch = globalThis.fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    jsonResponse({ error: "공개 Threads 게시물만 불러올 수 있습니다." }, 422);

  await assert.rejects(
    () =>
      loadThreadsFromUrl("https://www.threads.com/@jane/post/ABC123", {
        timeoutMs: 0,
      }),
    /공개 Threads/,
  );
});
