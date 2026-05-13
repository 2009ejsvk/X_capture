import assert from "node:assert/strict";
import test from "node:test";

import { getVisibleMediaSrcs, normalizeMediaItems } from "../src/media.js";

test("normalizeMediaItems deduplicates and preserves visibility", () => {
  const result = normalizeMediaItems([
    "https://example.com/a.jpg",
    { src: "https://example.com/a.jpg", visible: false },
    { url: "https://example.com/b.jpg", visible: false },
    "",
    null,
  ]);

  assert.deepEqual(result, [
    { src: "https://example.com/a.jpg", visible: true },
    { src: "https://example.com/b.jpg", visible: false },
  ]);
});

test("getVisibleMediaSrcs returns visible sources only", () => {
  const result = getVisibleMediaSrcs([
    { src: "a", visible: true },
    { src: "b", visible: false },
    { src: "c" },
  ]);

  assert.deepEqual(result, ["a", "c"]);
});
