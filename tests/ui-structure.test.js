import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("editor controls keep unique ids after the UX layout change", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test("responsive UX controls and editor sections are present", () => {
  [
    "jumpEditorBtn",
    "jumpPreviewBtn",
    "quickCaptureBtn",
    "captureFontSize",
    "mediaEditorSection",
    "replyEditorSection",
    "quoteEditorSection",
  ].forEach((id) => {
    assert.match(html, new RegExp(`id="${id}"`));
  });

  assert.match(css, /@media \(min-width: 980px\)/);
  assert.match(css, /"fetch preview"/);
  assert.match(css, /position: sticky/);
});
