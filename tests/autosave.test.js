import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDraftToState,
  clearDraft,
  loadDraft,
  saveDraft,
} from "../src/app/autosave.js";
import { createInitialState } from "../src/domain/tweet-model.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

test("saveDraft and loadDraft round-trip editable state", () => {
  const storage = createMemoryStorage();
  const state = createInitialState();
  state.authorName = "Saved User";
  state.stylePreset = "translation";

  assert.equal(
    saveDraft({
      state,
      tweetUrl: "https://x.com/openai/status/1234567890",
      storage,
    }),
    true,
  );

  const draft = loadDraft(storage);
  assert.equal(draft.tweetUrl, "https://x.com/openai/status/1234567890");
  assert.equal(draft.state.authorName, "Saved User");
  assert.equal(draft.state.stylePreset, "translation");
});

test("applyDraftToState copies known draft fields", () => {
  const state = createInitialState();
  const draft = {
    state: {
      authorHandle: "@restored",
      exportFormat: "webp",
    },
  };

  assert.equal(applyDraftToState(state, draft), true);
  assert.equal(state.authorHandle, "@restored");
  assert.equal(state.exportFormat, "webp");
});

test("clearDraft removes saved draft", () => {
  const storage = createMemoryStorage();
  saveDraft({
    state: createInitialState(),
    tweetUrl: "https://x.com/openai/status/1234567890",
    storage,
  });

  clearDraft(storage);
  assert.equal(loadDraft(storage), null);
});
