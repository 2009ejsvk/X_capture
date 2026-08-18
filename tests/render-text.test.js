import assert from "node:assert/strict";
import test from "node:test";

import { tokenizeTextLinks } from "../src/render/text.js";

test("tokenizeTextLinks separates links without swallowing punctuation", () => {
  assert.deepEqual(
    tokenizeTextLinks("공식 링크 https://example.com/docs, 확인"),
    [
      { type: "text", value: "공식 링크 " },
      { type: "link", value: "https://example.com/docs" },
      { type: "text", value: "," },
      { type: "text", value: " 확인" },
    ],
  );
});

test("tokenizeTextLinks trims quotes and brackets stuck to a link", () => {
  assert.deepEqual(tokenizeTextLinks('보기 "https://example.com/a"'), [
    { type: "text", value: '보기 "' },
    { type: "link", value: "https://example.com/a" },
    { type: "text", value: '"' },
  ]);

  assert.deepEqual(tokenizeTextLinks("[https://example.com/b]"), [
    { type: "text", value: "[" },
    { type: "link", value: "https://example.com/b" },
    { type: "text", value: "]" },
  ]);
});
