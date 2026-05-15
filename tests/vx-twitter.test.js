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
