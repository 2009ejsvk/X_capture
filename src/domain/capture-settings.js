const STYLE_PRESETS = new Set(["classic", "translation", "media", "compact"]);
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
    exportFormat: "png",
    exportScale: "auto",
  };
}

export function normalizeCaptureSettings(settings = {}) {
  return {
    stylePreset: normalizeStylePreset(settings.stylePreset),
    exportFormat: normalizeExportFormat(settings.exportFormat),
    exportScale: normalizeExportScale(settings.exportScale),
  };
}
