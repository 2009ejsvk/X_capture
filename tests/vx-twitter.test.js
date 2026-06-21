import assert from "node:assert/strict";
import test from "node:test";

import { fetchTweetFromVx } from "../src/services/vx-twitter.js";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

test("fetchTweetFromVx keeps media-only reply images without leaking t.co text", async (t) => {
  const originalFetch = globalThis.fetch;
  const mainTweetId = "1234567890";
  const photoTweetId = "2054821876980130148";
  const photoUrl = "https://pbs.twimg.com/media/HIQxmnTbkAAIAKD.jpg";

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (resource) => {
    const id = String(resource).match(/\/status\/(\d+)/)?.[1] || "";

    if (id === mainTweetId) {
      return jsonResponse({
        tweet: {
          id: mainTweetId,
          user_name: "Replying User",
          user_screen_name: "replying",
          text: "answer https://t.co/main",
          url: `https://x.com/replying/status/${mainTweetId}`,
          replying_to_status_id: photoTweetId,
          quote: {
            user_name: "Quoted User",
            user_screen_name: "quoted",
            text: "quoted https://t.co/quote",
            mediaURLs: [photoUrl],
          },
        },
      });
    }

    if (id === photoTweetId) {
      return jsonResponse({
        tweet: {
          tweetID: photoTweetId,
          user_name: "Photo User",
          user_screen_name: "photo",
          text: "https://t.co/9wd70Zbe8j",
          url: `https://x.com/photo/status/${photoTweetId}`,
          mediaURLs: [photoUrl],
          media_extended: [
            {
              type: "image",
              url: photoUrl,
              thumbnail_url: photoUrl,
            },
          ],
        },
      });
    }

    return jsonResponse({}, 404);
  };

  const result = await fetchTweetFromVx(mainTweetId, { timeoutMs: 0 });

  assert.equal(result.tweetText, "answer");
  assert.equal(result.quote.text, "quoted");
  assert.equal(result.replyParents.length, 1);
  assert.equal(result.replyParents[0].text, "");
  assert.deepEqual(result.replyParents[0].imageUrls, [
    { src: photoUrl, visible: true },
  ]);
});

test("fetchTweetFromVx strips a leading RT @handle: retweet prefix", async (t) => {
  const originalFetch = globalThis.fetch;
  const tweetId = "3333333333";

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    jsonResponse({
      tweet: {
        tweetID: tweetId,
        user_name: "Retweeter",
        user_screen_name: "retweeter",
        text: "RT @original: actual content here",
      },
    });

  const result = await fetchTweetFromVx(tweetId, { timeoutMs: 0 });

  assert.equal(result.tweetText, "actual content here");
});

test("fetchTweetFromVx prefers the richer endpoint payload", async (t) => {
  const originalFetch = globalThis.fetch;
  const tweetId = "4444444444";
  const photoUrl = "https://pbs.twimg.com/media/RICH.jpg";

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (resource) => {
    const url = String(resource);

    // fxtwitter returns a thin payload (no media)
    if (url.includes("api.fxtwitter.com")) {
      return jsonResponse({
        tweet: {
          tweetID: tweetId,
          user_name: "Thin",
          user_screen_name: "thin",
          text: "thin body",
        },
      });
    }

    // vxtwitter returns a media-rich payload and should win the richness sort
    if (url.includes("api.vxtwitter.com")) {
      return jsonResponse({
        tweet: {
          tweetID: tweetId,
          user_name: "Rich",
          user_screen_name: "rich",
          text: "rich body",
          mediaURLs: [photoUrl],
          media_extended: [{ type: "image", url: photoUrl }],
        },
      });
    }

    return jsonResponse({}, 404);
  };

  const result = await fetchTweetFromVx(tweetId, { timeoutMs: 0 });

  assert.equal(result.authorHandle, "@rich");
  assert.equal(result.tweetText, "rich body");
  assert.deepEqual(result.imageUrls, [photoUrl]);
});
