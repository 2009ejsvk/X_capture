import assert from "node:assert/strict";
import test from "node:test";

import { planPageCuts } from "../src/capture/pages.js";

test("a short capture stays one page", () => {
  assert.deepEqual(planPageCuts({ totalHeight: 500, maxHeight: 800 }), [
    { y: 0, height: 500 },
  ]);
});

test("pages cover the whole height without gaps or overlap", () => {
  const pages = planPageCuts({
    totalHeight: 3000,
    maxHeight: 800,
    blockers: [],
    preferred: [700, 1500, 2300],
  });
  assert.equal(pages[0].y, 0);
  pages.forEach((page, index) => {
    assert.ok(page.height > 0 && page.height <= 800);
    if (index > 0) {
      const previous = pages[index - 1];
      assert.equal(page.y, previous.y + previous.height);
    }
  });
  const last = pages[pages.length - 1];
  assert.equal(last.y + last.height, 3000);
});

test("cuts never go through an image or a text line", () => {
  // 300px 이미지가 10px 간격으로 이어진다. 경계만 자를 수 있다.
  const blockers = Array.from({ length: 10 }, (_, index) => [
    index * 310,
    index * 310 + 300,
  ]);
  const pages = planPageCuts({
    totalHeight: 3100,
    maxHeight: 800,
    blockers,
  });
  pages.slice(1).forEach(({ y }) => {
    const crossing = blockers.some(([top, bottom]) => y > top && y < bottom);
    assert.ok(!crossing, `cut at ${y} crosses an image`);
  });
});

test("cuts prefer element boundaries over line gaps", () => {
  const lines = Array.from({ length: 40 }, (_, index) => [
    index * 25,
    index * 25 + 22,
  ]);
  const pages = planPageCuts({
    totalHeight: 1000,
    maxHeight: 800,
    blockers: lines,
    preferred: [525],
  });
  assert.equal(pages[0].height, 525);
});

test("a block taller than a page is cut at the page limit", () => {
  const pages = planPageCuts({
    totalHeight: 2000,
    maxHeight: 800,
    blockers: [[0, 2000]],
  });
  assert.equal(pages[0].height, 800);
});
