import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialState,
  createReplyParentState,
  hasRenderableReply,
} from "../src/domain/tweet-model.js";

test("createInitialState exposes the expected defaults", () => {
  const state = createInitialState();

  assert.equal(state.authorName, "X User");
  assert.equal(state.authorHandle, "@x");
  assert.equal(state.showReply, true);
  assert.deepEqual(state.imageDataUrls, []);
});

test("createReplyParentState normalizes reply fields", () => {
  const reply = createReplyParentState({
    authorHandle: "handle",
    text: " hello\r\n ",
    dataUrls: ["a", "a", { url: "b", visible: false }],
  });

  assert.equal(reply.authorHandle, "@handle");
  assert.equal(reply.text, "hello");
  assert.deepEqual(reply.dataUrls, [
    { src: "a", visible: true },
    { src: "b", visible: false },
  ]);
});

test("hasRenderableReply detects empty and non-empty replies", () => {
  assert.equal(hasRenderableReply(createReplyParentState()), false);
  assert.equal(
    hasRenderableReply(createReplyParentState({ text: "hi" })),
    true,
  );
});
