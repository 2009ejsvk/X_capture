import {
  resolveCaptureScale,
  resolveExportFormat,
} from "./domain/capture-settings.js";
import { createCaptureFilename } from "./capture/filename.js";

let activeDownloadHref = "";

function waitForDocumentVisible(setStatus) {
  if (
    typeof document === "undefined" ||
    document.visibilityState === "visible"
  ) {
    return Promise.resolve();
  }

  if (typeof setStatus === "function") {
    setStatus("브라우저 화면으로 돌아오면 저장을 계속합니다.");
  }

  return new Promise((resolve) => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      document.removeEventListener("visibilitychange", onVisible);
      resolve();
    };

    document.addEventListener("visibilitychange", onVisible);
  });
}

function refreshDownloadFallbackLink(link, href, filename) {
  if (!link) {
    return;
  }

  link.href = href;
  link.download = filename;
  link.classList.remove("hidden");
}

async function downloadBlob(blob, filename, options = {}) {
  const { downloadFallbackLink, setStatus } = options;

  if (activeDownloadHref) {
    URL.revokeObjectURL(activeDownloadHref);
    activeDownloadHref = "";
  }

  const href = URL.createObjectURL(blob);
  activeDownloadHref = href;
  refreshDownloadFallbackLink(downloadFallbackLink, href, filename);

  await waitForDocumentVisible(setStatus);

  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function getExtensionFromMimeType(mimeType, fallbackExtension) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  if (mimeType === "image/png") {
    return "png";
  }

  return fallbackExtension;
}

function canvasToBlob(canvas, exportConfig) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve({
            blob: result,
            extension: getExtensionFromMimeType(
              result.type,
              exportConfig.extension,
            ),
          });
          return;
        }

        if (exportConfig.mimeType !== "image/png") {
          canvas.toBlob((pngResult) => {
            if (pngResult) {
              resolve({
                blob: pngResult,
                extension: "png",
              });
            } else {
              reject(new Error("이미지 생성 실패"));
            }
          }, "image/png");
          return;
        }

        reject(new Error("이미지 생성 실패"));
      },
      exportConfig.mimeType,
      exportConfig.quality,
    );
  });
}

function waitForNextFrame() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    };

    requestAnimationFrame(finish);
    window.setTimeout(finish, 80);
  });
}

function waitForImageReady(image, timeoutMs) {
  if (!image || !(image instanceof HTMLImageElement)) {
    return Promise.resolve();
  }

  const source = String(image.getAttribute("src") || "").trim();
  if (!source || image.classList.contains("hidden")) {
    return Promise.resolve();
  }

  if (image.complete && image.naturalWidth > 0) {
    if (typeof image.decode === "function") {
      return image.decode().catch(() => {});
    }
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    let timerId = 0;
    const cleanup = () => {
      image.removeEventListener("load", onSettled);
      image.removeEventListener("error", onSettled);
      if (timerId) {
        clearTimeout(timerId);
        timerId = 0;
      }
    };
    const onSettled = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    };

    image.addEventListener("load", onSettled, { once: true });
    image.addEventListener("error", onSettled, { once: true });
    timerId = window.setTimeout(onSettled, timeoutMs);
  });
}

function prepareCaptureImages(captureArea) {
  const images = Array.from(captureArea.querySelectorAll("img")).filter(
    (image) => image instanceof HTMLImageElement,
  );

  images.forEach((image) => {
    image.loading = "eager";
    image.decoding = "sync";
  });

  return images.filter((image) => {
    return (
      Boolean(String(image.getAttribute("src") || "").trim()) &&
      !image.classList.contains("hidden")
    );
  });
}

async function waitForCaptureImages(captureArea) {
  if (!captureArea) {
    return;
  }

  await waitForNextFrame();
  await waitForNextFrame();

  const images = prepareCaptureImages(captureArea);

  if (!images.length) {
    return;
  }

  await Promise.all(images.map((image) => waitForImageReady(image, 6000)));
  await waitForNextFrame();
}

function getCaptureViewport(captureArea) {
  const rect = captureArea.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const documentElement = document.documentElement;
  const body = document.body;

  return {
    windowWidth: Math.ceil(
      Math.max(
        window.innerWidth,
        documentElement.scrollWidth,
        body ? body.scrollWidth : 0,
        rect.right + scrollX,
      ),
    ),
    windowHeight: Math.ceil(
      Math.max(
        window.innerHeight,
        documentElement.scrollHeight,
        body ? body.scrollHeight : 0,
        rect.bottom + scrollY,
      ),
    ),
  };
}

export async function captureElementAsImage({
  captureArea,
  captureButton,
  downloadFallbackLink,
  exportFormat = "png",
  exportScale = "auto",
  filenameOptions = {},
  setStatus,
  html2canvasImpl = globalThis.html2canvas,
}) {
  if (typeof html2canvasImpl !== "function") {
    setStatus("캡처 라이브러리를 불러오지 못했습니다.", "error");
    return;
  }

  try {
    captureButton.disabled = true;
    setStatus("고해상도 이미지 생성 중...");
    await waitForDocumentVisible(setStatus);
    await waitForCaptureImages(captureArea);
    const viewport = getCaptureViewport(captureArea);
    const exportConfig = resolveExportFormat(exportFormat);

    const elementWidth = captureArea.offsetWidth || 360;
    const deviceScale = window.devicePixelRatio || 1;
    const scale = resolveCaptureScale({
      exportScale,
      deviceScale,
      elementWidth,
    });

    const canvas = await html2canvasImpl(captureArea, {
      useCORS: true,
      allowTaint: false,
      scale,
      backgroundColor: exportConfig.backgroundColor,
      imageTimeout: 15000,
      windowWidth: viewport.windowWidth,
      windowHeight: viewport.windowHeight,
    });

    const { blob, extension } = await canvasToBlob(canvas, exportConfig);
    const filename = createCaptureFilename(filenameOptions, extension);
    await downloadBlob(blob, filename, { downloadFallbackLink, setStatus });
    setStatus(`${extension.toUpperCase()} 파일을 저장했습니다.`, "success");
  } catch (error) {
    setStatus("이미지 저장에 실패했습니다.", "error");
  } finally {
    captureButton.disabled = false;
  }
}

export const captureElementAsPng = captureElementAsImage;
