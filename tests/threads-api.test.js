import assert from "node:assert/strict";
import test from "node:test";

import {
  extractThreadsImageUrls,
  fetchThreadsPost,
} from "../src/services/threads-api.js";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

test("extractThreadsImageUrls uses carousel images and video thumbnails", () => {
  assert.deepEqual(
    extractThreadsImageUrls({
      children: {
        data: [
          { media_type: "IMAGE", media_url: "https://cdn/a.jpg" },
          { media_type: "VIDEO", thumbnail_url: "https://cdn/b.jpg" },
        ],
      },
    }),
    ["https://cdn/a.jpg", "https://cdn/b.jpg"],
  );
});

test("fetchThreadsPost finds paginated posts and orders reply parents", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (resource) => {
    const url = String(resource);
    if (url.includes("/profile_posts") && !url.includes("after=next")) {
      return jsonResponse({
        data: [],
        paging: {
          next: "https://graph.threads.net/profile_posts?username=sample&after=next&access_token=must-not-be-forwarded",
        },
      });
    }
    if (url.includes("after=next")) {
      assert.doesNotMatch(url, /must-not-be-forwarded/);
      assert.match(url, /access_token=token/);
      return jsonResponse({
        data: [
          {
            id: "child",
            username: "sample",
            shortcode: "TARGET",
            text: "child text",
            replied_to: { id: "parent" },
          },
        ],
      });
    }
    if (url.includes("/child")) {
      return jsonResponse({
        id: "child",
        username: "sample",
        shortcode: "TARGET",
        text: "child text",
        replied_to: { id: "parent" },
      });
    }
    if (url.includes("/parent")) {
      return jsonResponse({
        id: "parent",
        username: "original",
        text: "parent text",
        replied_to: { id: "root" },
      });
    }
    if (url.includes("/root")) {
      return jsonResponse({
        id: "root",
        username: "root-user",
        text: "root text",
      });
    }
    return jsonResponse({}, 404);
  };

  const result = await fetchThreadsPost(
    { username: "sample", shortcode: "TARGET" },
    { accessToken: "token", timeoutMs: 0 },
  );

  assert.equal(result.post.text, "child text");
  assert.deepEqual(
    result.replyParents.map((item) => item.text),
    ["root text", "parent text"],
  );
});

test("fetchThreadsPost gives a useful permission error", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () =>
    jsonResponse(
      { error: { code: 10, message: "Application does not have permission" } },
      403,
    );

  await assert.rejects(
    () =>
      fetchThreadsPost(
        { username: "sample", shortcode: "TARGET" },
        { accessToken: "token", timeoutMs: 0 },
      ),
    /threads_profile_discovery/,
  );
});
