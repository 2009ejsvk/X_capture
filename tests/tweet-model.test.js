import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialState,
  createReplyParentState,
  formatQuoteText,
  hasRenderableReply,
  normalizeQuoteTextMode,
} from "../src/domain/tweet-model.js";

test("createInitialState exposes the expected defaults", () => {
  const state = createInitialState();

  assert.equal(state.authorName, "X User");
  assert.equal(state.authorHandle, "@x");
  assert.equal(state.showReply, true);
  assert.equal(state.quoteTextMode, "full");
  assert.equal(state.stylePreset, "classic");
  assert.equal(state.captureFontSize, "default");
  assert.equal(state.captureFontFamily, "system");
  assert.equal(state.captureGameFontScope, "emphasis");
  assert.equal(state.captureOutlineWidth, "0");
  assert.equal(state.captureOutlineColor, "#000000");
  assert.equal(state.captureTextShadow, false);
  assert.equal(state.exportFormat, "png");
  assert.equal(state.exportScale, "auto");
  assert.deepEqual(state.imageDataUrls, []);
});

test("createReplyParentState normalizes reply fields", () => {
  const reply = createReplyParentState({
    authorHandle: "handle",
    text: " @target hello\r\n ",
    dataUrls: ["a", "a", { url: "b", visible: false }],
  });

  assert.equal(reply.authorHandle, "@handle");
  assert.equal(reply.visible, true);
  assert.equal(reply.text, "hello");
  assert.equal(reply.mediaLayout, "vertical");
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
  assert.equal(
    hasRenderableReply(createReplyParentState({ authorHandle: "target" })),
    false,
  );
});

test("formatQuoteText supports full and preview modes", () => {
  assert.equal(normalizeQuoteTextMode("unknown"), "full");
  assert.equal(formatQuoteText("full text", "full", 4), "full text");
  assert.equal(formatQuoteText("123456", "preview", 4), "1234…");
  assert.equal(formatQuoteText("1234", "preview", 4), "1234");
});
