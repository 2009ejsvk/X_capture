const STYLE_PRESETS = new Set(["classic", "translation", "media", "compact"]);
const CAPTURE_FONT_SIZES = new Set(["small", "default", "large", "xlarge"]);
const CAPTURE_FONT_FAMILIES = new Set([
  "system",
  "pretendard",
  "noto-sans",
  "noto-serif",
  "galmuri",
  "neo-dgm",
  "suit-heavy",
  "wanted-heavy",
  "dnf-bitbit",
  "gasoek",
  "black-han",
  "bagel-fat",
]);
const GAME_CAPTURE_FONT_FAMILIES = new Set([
  "dnf-bitbit",
  "gasoek",
  "black-han",
  "bagel-fat",
]);
const CAPTURE_GAME_FONT_SCOPES = new Set(["emphasis", "all"]);
const CAPTURE_OUTLINE_WIDTHS = new Set(["0", "1", "2", "3", "4", "6"]);
const EXPORT_SCALES = new Set(["auto", "2", "3", "4"]);

const EXPORT_FORMATS = {
  png: {
    value: "png",
    label: "PNG",
    mimeType: "image/png",
    extension: "png",
    quality: undefined,
    backgroundColor: null,
  },
  jpg: {
    value: "jpg",
    label: "JPG",
    mimeType: "image/jpeg",
    extension: "jpg",
    quality: 0.92,
    backgroundColor: "#101418",
  },
  webp: {
    value: "webp",
    label: "WebP",
    mimeType: "image/webp",
    extension: "webp",
    quality: 0.92,
    backgroundColor: null,
  },
};

export function normalizeStylePreset(value) {
  const preset = String(value || "").trim();
  return STYLE_PRESETS.has(preset) ? preset : "classic";
}

export function normalizeCaptureFontSize(value) {
  const size = String(value || "").trim();
  return CAPTURE_FONT_SIZES.has(size) ? size : "xlarge";
}

export function normalizeCaptureFontFamily(value) {
  const family = String(value || "").trim();
  return CAPTURE_FONT_FAMILIES.has(family) ? family : "suit-heavy";
}

export function isGameCaptureFontFamily(value) {
  return GAME_CAPTURE_FONT_FAMILIES.has(normalizeCaptureFontFamily(value));
}

export function normalizeCaptureGameFontScope(value) {
  const scope = String(value || "").trim();
  return CAPTURE_GAME_FONT_SCOPES.has(scope) ? scope : "emphasis";
}

export function normalizeCaptureOutlineWidth(value) {
  const width = String(value ?? "").trim();
  return CAPTURE_OUTLINE_WIDTHS.has(width) ? width : "0";
}

export function normalizeCaptureOutlineColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "#000000";
}

export function normalizeExportFormat(value) {
  const format = String(value || "")
    .trim()
    .toLowerCase();
  return Object.hasOwn(EXPORT_FORMATS, format) ? format : "png";
}

export function resolveExportFormat(value) {
  return EXPORT_FORMATS[normalizeExportFormat(value)];
}

export function normalizeExportScale(value) {
  const scale = String(value || "")
    .trim()
    .toLowerCase();
  return EXPORT_SCALES.has(scale) ? scale : "auto";
}

export function resolveCaptureScale({
  exportScale,
  deviceScale = 1,
  elementWidth = 360,
  minExportWidth = 1440,
} = {}) {
  const normalizedScale = normalizeExportScale(exportScale);
  if (normalizedScale !== "auto") {
    return Number(normalizedScale);
  }

  const widthScale = minExportWidth / Math.max(Number(elementWidth) || 1, 1);
  return Math.min(Math.max(Number(deviceScale) || 1, widthScale, 2), 5);
}

export function createDefaultCaptureSettings() {
  return {
    stylePreset: "classic",
    captureFontSize: "xlarge",
    captureFontFamily: "suit-heavy",
    captureGameFontScope: "emphasis",
    captureOutlineWidth: "0",
    captureOutlineColor: "#000000",
    captureTextShadow: false,
    exportFormat: "png",
    exportScale: "auto",
  };
}

export function normalizeCaptureSettings(settings = {}) {
  return {
    stylePreset: normalizeStylePreset(settings.stylePreset),
    captureFontSize: normalizeCaptureFontSize(settings.captureFontSize),
    captureFontFamily: normalizeCaptureFontFamily(settings.captureFontFamily),
    captureGameFontScope: normalizeCaptureGameFontScope(
      settings.captureGameFontScope,
    ),
    captureOutlineWidth: normalizeCaptureOutlineWidth(
      settings.captureOutlineWidth,
    ),
    captureOutlineColor: normalizeCaptureOutlineColor(
      settings.captureOutlineColor,
    ),
    captureTextShadow: settings.captureTextShadow === true,
    exportFormat: normalizeExportFormat(settings.exportFormat),
    exportScale: normalizeExportScale(settings.exportScale),
  };
}
