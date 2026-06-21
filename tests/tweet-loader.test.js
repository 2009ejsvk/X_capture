import assert from "node:assert/strict";
import test from "node:test";

import { loadTweetFromUrl } from "../src/app/tweet-loader.js";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

// parseOembedHtml relies on the browser DOMParser; stub it so the oEmbed
// branch can run under Node. An empty document means the tweet text comes
// from the vx enrichment step, matching real usage where vx text wins.
function withDomParserStub(t) {
  const originalDomParser = globalThis.DOMParser;
  globalThis.DOMParser = class {
    parseFromString() {
      return { querySelector: () => null, querySelectorAll: () => [] };
    }
  };
  t.after(() => {
    globalThis.DOMParser = originalDomParser;
  });
}

test("loadTweetFromUrl merges oEmbed author info with vx enrichment", async (t) => {
  const originalFetch = globalThis.fetch;
  const tweetId = "1111111111";
  const photoUrl = "https://pbs.twimg.com/media/AAAA.jpg";

  withDomParserStub(t);
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (resource) => {
    const url = String(resource);

    if (url.includes("publish.twitter.com/oembed")) {
      return jsonResponse({
        html: "<blockquote></blockquote>",
        author_name: "Oembed Author",
        author_url: "https://twitter.com/oembed_handle",
        url: `https://x.com/oembed_handle/status/${tweetId}`,
        thumbnail_url: "",
      });
    }

    if (url.includes("api.fxtwitter.com")) {
      return jsonResponse({
        tweet: {
          tweetID: tweetId,
          user_name: "Vx Author",
          user_screen_name: "vx_handle",
          text: "enriched body https://t.co/x",
          likes: 1200,
          replies: 5,
          mediaURLs: [photoUrl],
          media_extended: [{ type: "image", url: photoUrl }],
        },
      });
    }

    return jsonResponse({}, 404);
  };

  const result = await loadTweetFromUrl(
    `https://x.com/oembed_handle/status/${tweetId}`,
    { timeoutMs: 0 },
  );

  assert.equal(result.usedFallback, false);
  // vx values win over oEmbed when present
  assert.equal(result.patch.authorName, "Vx Author");
  assert.equal(result.patch.authorHandle, "@vx_handle");
  assert.equal(result.patch.tweetText, "enriched body");
  assert.equal(result.patch.likeCount, "1.2천");
  assert.deepEqual(result.patch.imageDataUrls, [
    { src: photoUrl, visible: true },
  ]);
});

test("loadTweetFromUrl falls back to vx when oEmbed fails", async (t) => {
  const originalFetch = globalThis.fetch;
  const tweetId = "2222222222";

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (resource) => {
    const url = String(resource);

    if (url.includes("publish.twitter.com/oembed")) {
      return jsonResponse({}, 404);
    }

    if (url.includes("api.fxtwitter.com")) {
      return jsonResponse({
        tweet: {
          tweetID: tweetId,
          user_name: "Fallback Author",
          user_screen_name: "fallback",
          text: "fallback body",
          url: `https://x.com/fallback/status/${tweetId}`,
          quote: {
            user_name: "Quoted",
            user_screen_name: "quoted",
            text: "quoted body",
          },
        },
      });
    }

    return jsonResponse({}, 404);
  };

  const result = await loadTweetFromUrl(
    `https://x.com/fallback/status/${tweetId}`,
    { timeoutMs: 0 },
  );

  assert.equal(result.usedFallback, true);
  assert.equal(result.patch.authorName, "Fallback Author");
  assert.equal(result.patch.authorHandle, "@fallback");
  assert.equal(result.patch.tweetText, "fallback body");
  assert.equal(result.patch.quoteAuthorHandle, "@quoted");
  assert.equal(result.patch.quoteText, "quoted body");
});

test("loadTweetFromUrl rejects unsupported URLs before any fetch", async (t) => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => {
    fetchCalls += 1;
    return jsonResponse({}, 404);
  };

  await assert.rejects(
    () => loadTweetFromUrl("https://example.com/not/a/tweet", { timeoutMs: 0 }),
    /x\.com 또는 twitter\.com/,
  );
  assert.equal(fetchCalls, 0);
});
