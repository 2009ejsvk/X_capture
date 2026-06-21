import assert from "node:assert/strict";
import test from "node:test";

import { parseThreadsHtml } from "../src/services/threads-parse.js";

test("parseThreadsHtml extracts author, text, counts and media from inline JSON", () => {
  const node = {
    caption: { text: "We just launched new features in the Threads API." },
    like_count: 25,
    repost_count: 3,
    quote_count: 2,
    reply_count: 4,
    taken_at: 1733786829,
    code: "DDYELWPojdS",
    user: {
      username: "pmestevez",
      full_name: "Pablo Estevez",
      profile_pic_url: "https://cdn.example/pp.jpg",
    },
    carousel_media: [
      {
        image_versions2: {
          candidates: [
            { url: "https://cdn.example/a.jpg", width: 1080 },
            { url: "https://cdn.example/a-small.jpg", width: 320 },
          ],
        },
      },
      {
        image_versions2: {
          candidates: [{ url: "https://cdn.example/b.jpg", width: 1080 }],
        },
      },
    ],
  };

  const html = `<!doctype html><html><head>
    <meta property="og:title" content="Pablo Estevez (&#064;pmestevez) on Threads">
    <meta property="og:description" content="ignored when JSON present">
    <meta property="og:image" content="https://cdn.example/og.jpg">
    <meta property="og:url" content="https://www.threads.com/@pmestevez/post/DDYEM_foiI1">
  </head><body>
    <script type="application/json">{"unrelated":true}</script>
    <script type="application/json" data-sjs>${JSON.stringify({ deep: { nested: node } })}</script>
  </body></html>`;

  const result = parseThreadsHtml(html);

  assert.equal(result.authorName, "Pablo Estevez");
  assert.equal(result.authorHandle, "@pmestevez");
  assert.equal(
    result.text,
    "We just launched new features in the Threads API.",
  );
  assert.equal(result.likeCount, "25");
  assert.equal(result.retweetCount, "3");
  assert.equal(result.bookmarkCount, "2");
  assert.equal(result.replyCount, "4");
  assert.equal(result.profileImageUrl, "https://cdn.example/pp.jpg");
  // largest candidate per carousel entry, capped and deduped
  assert.deepEqual(result.imageUrls, [
    "https://cdn.example/a.jpg",
    "https://cdn.example/b.jpg",
  ]);
  assert.equal(
    result.sourceUrl,
    "https://www.threads.com/@pmestevez/post/DDYEM_foiI1",
  );
});

test("parseThreadsHtml falls back to Open Graph tags when no inline JSON", () => {
  const html = `<html><head>
    <meta property="og:title" content="Jane Doe (&#064;jane) on Threads">
    <meta property="og:description" content="Hello from Open Graph">
    <meta property="og:image" content="https://cdn.example/jane.jpg">
  </head><body></body></html>`;

  const result = parseThreadsHtml(html);

  assert.equal(result.authorName, "Jane Doe");
  assert.equal(result.authorHandle, "@jane");
  assert.equal(result.text, "Hello from Open Graph");
  assert.equal(result.profileImageUrl, "https://cdn.example/jane.jpg");
  assert.equal(result.likeCount, "0");
  assert.deepEqual(result.imageUrls, []);
});
