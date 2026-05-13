import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeCaptureSettings,
  resolveCaptureScale,
  resolveExportFormat,
} from "../src/domain/capture-settings.js";

test("normalizeCaptureSettings keeps supported values", () => {
  assert.deepEqual(
    normalizeCaptureSettings({
      stylePreset: "media",
      exportFormat: "webp",
      exportScale: "3",
    }),
    {
      stylePreset: "media",
      exportFormat: "webp",
      exportScale: "3",
    },
  );
});

test("normalizeCaptureSettings falls back to defaults", () => {
  assert.deepEqual(
    normalizeCaptureSettings({
      stylePreset: "unknown",
      exportFormat: "gif",
      exportScale: "8",
    }),
    {
      stylePreset: "classic",
      exportFormat: "png",
      exportScale: "auto",
    },
  );
});

test("resolveCaptureScale uses explicit and automatic scales", () => {
  assert.equal(resolveCaptureScale({ exportScale: "4" }), 4);
  assert.equal(
    resolveCaptureScale({
      exportScale: "auto",
      deviceScale: 1,
      elementWidth: 360,
    }),
    4,
  );
});

test("resolveExportFormat exposes the export mime type", () => {
  assert.equal(resolveExportFormat("jpg").mimeType, "image/jpeg");
  assert.equal(resolveExportFormat("bad").extension, "png");
});
