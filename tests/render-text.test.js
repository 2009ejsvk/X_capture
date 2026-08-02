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
