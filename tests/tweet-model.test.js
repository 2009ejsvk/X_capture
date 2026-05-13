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
  assert.equal(state.stylePreset, "classic");
  assert.equal(state.exportFormat, "png");
  assert.equal(state.exportScale, "auto");
  assert.deepEqual(state.imageDataUrls, []);
});

test("createReplyParentState normalizes reply fields", () => {
  const reply = createReplyParentState({
    authorHandle: "handle",
    text: " hello\r\n ",
    dataUrls: ["a", "a", { url: "b", visible: false }],
  });

  assert.equal(reply.authorHandle, "@handle");
  assert.equal(reply.visible, true);
  assert.equal(reply.text, "hello");
  assert.deepEqual(reply.dataUrls, [
    { src: "a", visible: true },
    { src: "b", visible: false },
  ]);
});

test("createReplyParentState preserves hidden replies", () => {
  const reply = createReplyParentState({
    visible: false,
    text: "hidden",
  });

  assert.equal(reply.visible, false);
  assert.equal(hasRenderableReply(reply), true);
});

test("hasRenderableReply detects empty and non-empty replies", () => {
  assert.equal(hasRenderableReply(createReplyParentState()), false);
  assert.equal(
    hasRenderableReply(createReplyParentState({ text: "hi" })),
    true,
  );
});
