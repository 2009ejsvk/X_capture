import assert from "node:assert/strict";
import test from "node:test";

import { createCaptureFilename } from "../src/capture/filename.js";

test("createCaptureFilename combines author, date, tweet id, and extension", () => {
  assert.equal(
    createCaptureFilename(
      {
        authorHandle: "@openai",
        tweetDate: "2026-05-13 21:30",
        sourceUrl: "https://x.com/openai/status/1234567890",
      },
      "webp",
      Date.UTC(2026, 4, 13),
    ),
    "openai-20260513-1234567890.webp",
  );
});

test("createCaptureFilename sanitizes unsafe filename characters", () => {
  assert.equal(
    createCaptureFilename(
      {
        authorName: "A/B:C*D",
        tweetDate: "",
        sourceUrl: "",
      },
      "jpg",
      Date.UTC(2026, 4, 13),
    ),
    "A-B-C-D-20260513.jpg",
  );
});
