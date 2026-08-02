import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const renderer = readFileSync(
  new URL("../src/render.js", import.meta.url),
  "utf8",
);

test("editor controls keep unique ids after the UX layout change", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test("responsive UX controls and editor sections are present", () => {
  [
    "jumpEditorBtn",
    "jumpPreviewBtn",
    "jumpSettingsBtn",
    "quickCaptureBtn",
    "captureSettingsSection",
    "captureFontSize",
    "captureFontFamily",
    "captureGameFontScope",
    "captureOutlineWidth",
    "captureOutlineColor",
    "captureTextShadow",
    "mainEditorSection",
    "mediaEditorSection",
    "replyEditorSection",
    "quoteEditorSection",
  ].forEach((id) => {
    assert.match(html, new RegExp(`id="${id}"`));
  });

  assert.match(css, /@media \(min-width: 980px\)/);
  assert.match(css, /"fetch preview"/);
  assert.match(css, /"settings preview"\s+"editor preview"/);
  assert.match(css, /\.settings-panel\s*{\s*order: 4;/);
  assert.match(css, /position: sticky/);
  assert.match(css, /data-font-family="dnf-bitbit"/);
  assert.match(css, /data-font-family="galmuri"/);
  assert.match(css, /data-font-family="neo-dgm"/);
  assert.match(css, /data-font-family="suit-heavy"/);
  assert.match(css, /data-font-family="wanted-heavy"/);
  assert.match(css, /data-font-scope="emphasis"/);
  assert.match(css, /--capture-outline-width/);
});

test("reply editors always expose image add and remove controls", () => {
  assert.match(renderer, /이미지 수정 · 추가/);
  assert.match(renderer, /reply-image-input-/);
  assert.match(renderer, /전체 삭제/);
});

test("translations use the same text scale as their corresponding body", () => {
  assert.match(
    css,
    /\.tweet-translation-text\s*{[^}]*font-size:\s*var\(--capture-text-size\)/s,
  );
  assert.match(
    css,
    /\.tweet-translation-text\s*{[^}]*line-height:\s*var\(--capture-text-line\)/s,
  );
  assert.match(
    css,
    /\.reply-item-translation-text\s*{[^}]*font-size:\s*var\(--capture-quote-size\)/s,
  );
});
