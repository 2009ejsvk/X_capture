import assert from "node:assert/strict";
import test from "node:test";

import {
  isGameCaptureFontFamily,
  normalizeCaptureFontFamily,
  normalizeCaptureSettings,
  resolveCaptureScale,
  resolveExportFormat,
} from "../src/domain/capture-settings.js";

test("readable game fonts apply to the full body", () => {
  ["galmuri", "neo-dgm", "suit-heavy", "wanted-heavy"].forEach((family) => {
    assert.equal(normalizeCaptureFontFamily(family), family);
    assert.equal(isGameCaptureFontFamily(family), false);
  });

  assert.equal(isGameCaptureFontFamily("dnf-bitbit"), true);
});

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
      captureFontSize: "xlarge",
      captureFontFamily: "suit-heavy",
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
