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
          text: "@photo @another answer https://t.co/main",
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
          text: "@replying https://t.co/9wd70Zbe8j",
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

  assert.equal(result.tweetText, "answer https://t.co/main");
  assert.equal(result.quote.text, "quoted https://t.co/quote");
  assert.equal(result.replyParents.length, 1);
  assert.equal(result.replyParents[0].text, "");
  assert.deepEqual(result.replyParents[0].imageUrls, [
    { src: photoUrl, visible: true },
  ]);
});

test("fetchTweetFromVx removes FxTwitter media facets but keeps the attached image", async (t) => {
  const originalFetch = globalThis.fetch;
  const tweetId = "2083770343177740438";
  const mediaLink = "https://t.co/fSSNTuXl2r";
  const photoUrl = "https://pbs.twimg.com/media/HOsJqxCagAAVQ30.jpg?name=orig";
  const cleanText = "보통 명절 2~3주 전을 대목 시작으로 잡고 명절을 준비함.";

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (resource) => {
    if (String(resource).includes("api.fxtwitter.com")) {
      return jsonResponse({
        tweet: {
          tweetID: tweetId,
          user_name: "User",
          user_screen_name: "user",
          text: cleanText,
          raw_text: {
            text: `${cleanText} ${mediaLink}`,
            facets: [
              {
                type: "media",
                original: mediaLink,
                replacement: `https://x.com/user/status/${tweetId}/photo/1`,
              },
            ],
          },
          media: { all: [{ type: "photo", url: photoUrl }] },
        },
      });
    }

    return jsonResponse({
      tweet: {
        tweetID: tweetId,
        user_name: "User",
        user_screen_name: "user",
        text: cleanText,
        mediaURLs: [photoUrl],
        media_extended: [{ type: "image", url: photoUrl }],
      },
    });
  };

  const result = await fetchTweetFromVx(tweetId, { timeoutMs: 0 });

  assert.equal(result.tweetText, cleanText);
  assert.deepEqual(result.imageUrls, [photoUrl]);
});

test("fetchTweetFromVx removes only a media URL when an article link is also present", async (t) => {
  const originalFetch = globalThis.fetch;
  const tweetId = "6666666666";
  const articleLink = "https://t.co/article";
  const mediaLink = "https://t.co/media";
  const photoUrl = "https://pbs.twimg.com/media/MIXED.jpg";

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    jsonResponse({
      tweet: {
        tweetID: tweetId,
        user_name: "Mixed Links",
        user_screen_name: "mixed",
        text: `article ${articleLink} ${mediaLink}`,
        entities: {
          urls: [
            {
              url: articleLink,
              expanded_url: "https://example.com/article",
            },
          ],
        },
        raw_text: {
          text: `article ${articleLink} ${mediaLink}`,
          facets: [{ type: "media", original: mediaLink }],
        },
        mediaURLs: [photoUrl],
        media_extended: [{ type: "image", url: photoUrl }],
      },
    });

  const result = await fetchTweetFromVx(tweetId, { timeoutMs: 0 });

  assert.equal(result.tweetText, "article https://example.com/article");
  assert.deepEqual(result.imageUrls, [photoUrl]);
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

test("fetchTweetFromVx keeps the longest text and expands known links", async (t) => {
  const originalFetch = globalThis.fetch;
  const tweetId = "5555555555";
  const photoUrl = "https://pbs.twimg.com/media/LONG.jpg";

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (resource) => {
    const url = String(resource);
    if (url.includes("api.fxtwitter.com")) {
      return jsonResponse({
        tweet: {
          tweetID: tweetId,
          user_name: "Full Text",
          user_screen_name: "full_text",
          full_text: "long complete body https://t.co/article",
          entities: {
            urls: [
              {
                url: "https://t.co/article",
                expanded_url: "https://example.com/full-article",
              },
            ],
          },
        },
      });
    }

    return jsonResponse({
      tweet: {
        tweetID: tweetId,
        user_name: "Media Rich",
        user_screen_name: "media_rich",
        text: "short",
        mediaURLs: [photoUrl],
        media_extended: [{ type: "image", url: photoUrl }],
      },
    });
  };

  const result = await fetchTweetFromVx(tweetId, { timeoutMs: 0 });

  assert.equal(
    result.tweetText,
    "long complete body https://example.com/full-article",
  );
  assert.deepEqual(result.imageUrls, [photoUrl]);
});

test("fetchTweetFromVx backfills bookmark count when the richer payload omits it", async (t) => {
  const originalFetch = globalThis.fetch;
  const tweetId = "5555555555";
  const photoUrl = "https://pbs.twimg.com/media/BM.jpg";

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (resource) => {
    const url = String(resource);

    // fxtwitter exposes bookmarks but scores lower on media richness
    if (url.includes("api.fxtwitter.com")) {
      return jsonResponse({
        tweet: {
          tweetID: tweetId,
          user_name: "User",
          user_screen_name: "user",
          text: "hello",
          likes: 100,
          bookmarks: 6439,
          media: { all: [{ type: "photo", url: photoUrl }] },
        },
      });
    }

    // vxtwitter wins richness (media_extended + mediaURLs) but has no bookmarks
    if (url.includes("api.vxtwitter.com")) {
      return jsonResponse({
        tweet: {
          tweetID: tweetId,
          user_name: "User",
          user_screen_name: "user",
          text: "hello",
          likes: 100,
          media_extended: [
            { type: "image", url: photoUrl, thumbnail_url: photoUrl },
          ],
          mediaURLs: [photoUrl],
        },
      });
    }

    return jsonResponse({}, 404);
  };

  const result = await fetchTweetFromVx(tweetId, { timeoutMs: 0 });

  assert.equal(result.bookmarkCount, "6.4천");
});

test("fetchTweetFromVx keeps the largest engagement counts across endpoints", async (t) => {
  const originalFetch = globalThis.fetch;
  const tweetId = "7777777777";
  const photoUrl = "https://pbs.twimg.com/media/COUNTS.jpg";

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (resource) => {
    const url = String(resource);

    if (url.includes("api.fxtwitter.com")) {
      return jsonResponse({
        tweet: {
          tweetID: tweetId,
          user_name: "Fresh Counts",
          user_screen_name: "fresh_counts",
          text: "hello",
          replies: 40,
          retweets: 1500,
          likes: 2400,
        },
      });
    }

    return jsonResponse({
      tweet: {
        tweetID: tweetId,
        user_name: "Rich Media",
        user_screen_name: "rich_media",
        text: "hello",
        replies: 4,
        retweets: 150,
        likes: 240,
        media_extended: [
          { type: "image", url: photoUrl, thumbnail_url: photoUrl },
        ],
        mediaURLs: [photoUrl],
      },
    });
  };

  const result = await fetchTweetFromVx(tweetId, { timeoutMs: 0 });

  assert.equal(result.replyCount, "40");
  assert.equal(result.retweetCount, "1.5천");
  assert.equal(result.likeCount, "2.4천");
  assert.deepEqual(result.imageUrls, [photoUrl]);
});

test("fetchTweetFromVx keeps the largest count across nested metric shapes", async (t) => {
  const originalFetch = globalThis.fetch;
  const tweetId = "8888888888";

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (resource) => {
    if (String(resource).includes("api.fxtwitter.com")) {
      return jsonResponse({
        tweet: {
          tweetID: tweetId,
          user_name: "Nested Metrics",
          user_screen_name: "nested_metrics",
          text: "hello",
          retweets: 150,
          metrics: { retweet_count: 1500 },
        },
      });
    }

    return jsonResponse({}, 404);
  };

  const result = await fetchTweetFromVx(tweetId, { timeoutMs: 0 });

  assert.equal(result.retweetCount, "1.5천");
});

test("fetchTweetFromVx decodes HTML entities in text and author name", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    jsonResponse({
      tweet: {
        id: "555555555",
        user_name: "Ben &amp; Co",
        user_screen_name: "benco",
        text: "map: a -&gt; b, and a &lt; b &amp;&amp; c",
        url: "https://x.com/benco/status/555555555",
      },
    });

  const result = await fetchTweetFromVx("555555555");
  assert.equal(result.tweetText, "map: a -> b, and a < b && c");
  assert.equal(result.authorName, "Ben & Co");
});

test("fetchTweetFromVx prefers the original post time for a retweet", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    jsonResponse({
      tweet: {
        id: "666666666",
        user_name: "Retweeter",
        user_screen_name: "retweeter",
        created_at: "Wed Aug 13 10:00:00 +0000 2025",
        text: "RT @original: hello",
        url: "https://x.com/retweeter/status/666666666",
        retweeted_status: {
          id: "111111111",
          user_name: "Original",
          user_screen_name: "original",
          created_at: "Mon Aug 04 09:30:00 +0000 2025",
          text: "hello",
          url: "https://x.com/original/status/111111111",
        },
      },
    });

  const result = await fetchTweetFromVx("666666666");
  assert.match(result.tweetDate, /^2025-08-04/);
  assert.equal(result.authorName, "Original");
});
