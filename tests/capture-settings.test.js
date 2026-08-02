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
      captureFontSize: "large",
      captureFontFamily: "dnf-bitbit",
      captureGameFontScope: "all",
      captureOutlineWidth: "4",
      captureOutlineColor: "#FF00AA",
      captureTextShadow: true,
      exportFormat: "webp",
      exportScale: "3",
    }),
    {
      stylePreset: "media",
      captureFontSize: "large",
      captureFontFamily: "dnf-bitbit",
      captureGameFontScope: "all",
      captureOutlineWidth: "4",
      captureOutlineColor: "#ff00aa",
      captureTextShadow: true,
      exportFormat: "webp",
      exportScale: "3",
    },
  );
});

test("normalizeCaptureSettings falls back to defaults", () => {
  assert.deepEqual(
    normalizeCaptureSettings({
      stylePreset: "unknown",
      captureFontSize: "giant",
      captureFontFamily: "comic-sans",
      captureGameFontScope: "everything",
      captureOutlineWidth: "9",
      captureOutlineColor: "red",
      captureTextShadow: "yes",
      exportFormat: "gif",
      exportScale: "8",
    }),
    {
      stylePreset: "classic",
      captureFontSize: "default",
      captureFontFamily: "system",
      captureGameFontScope: "emphasis",
      captureOutlineWidth: "0",
      captureOutlineColor: "#000000",
      captureTextShadow: false,
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
