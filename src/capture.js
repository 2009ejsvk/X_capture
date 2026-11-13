import {
  resolveCaptureScale,
  resolveExportFormat,
} from "./domain/capture-settings.js?v=kbd-source-20261113";
import { createCaptureFilename } from "./capture/filename.js?v=kbd-source-20261113";

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
  const { downloadFallbackLink, setStatus, keepPreviousHref } = options;

  if (keepPreviousHref) {
    // 여러 장을 연달아 받을 때는 앞선 다운로드가 끝나기 전에 주소를 지우지 않는다.
    const batchHref = URL.createObjectURL(blob);
    window.setTimeout(() => URL.revokeObjectURL(batchHref), 60000);
    await waitForDocumentVisible(setStatus);
    const batchLink = document.createElement("a");
    batchLink.href = batchHref;
    batchLink.download = filename;
    document.body.appendChild(batchLink);
    batchLink.click();
    batchLink.remove();
    return;
  }

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

async function waitForCaptureFonts() {
  if (!document.fonts || !document.fonts.ready) {
    return;
  }

  await Promise.race([
    document.fonts.ready,
    new Promise((resolve) => window.setTimeout(resolve, 10000)),
  ]);
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

export function describeCaptureError(error) {
  const name = error && error.name ? String(error.name) : "";
  const message = error && error.message ? String(error.message) : "";

  if (name === "SecurityError" || /tainted|cross-origin/i.test(message)) {
    return "이미지 저장 실패: 외부 이미지의 보안 정책(CORS) 때문에 캔버스를 읽을 수 없습니다. 이미지를 직접 업로드해 보세요.";
  }

  if (/allocation|memory|size|too large/i.test(message)) {
    return "이미지 저장 실패: 캡처 크기가 너무 큽니다. 내보내기 배율을 낮춰 보세요.";
  }

  if (message) {
    return `이미지 저장 실패: ${message}`;
  }

  return "이미지 저장에 실패했습니다.";
}

async function renderElementToBlob(
  target,
  { exportFormat, exportScale, html2canvasImpl },
) {
  await waitForCaptureImages(target);
  const viewport = getCaptureViewport(target);
  const exportConfig = resolveExportFormat(exportFormat);

  const elementWidth = target.offsetWidth || 360;
  const deviceScale = window.devicePixelRatio || 1;
  const scale = resolveCaptureScale({
    exportScale,
    deviceScale,
    elementWidth,
  });

  const canvas = await html2canvasImpl(target, {
    useCORS: true,
    allowTaint: false,
    scale,
    backgroundColor: exportConfig.backgroundColor,
    imageTimeout: 15000,
    windowWidth: viewport.windowWidth,
    // 모바일에서는 미리보기가 화면 안에서만 스크롤되므로, 복제본에서는
    // 스크롤 잠금을 풀고 대상 높이만큼 창을 넉넉히 잡는다.
    windowHeight: viewport.windowHeight + target.scrollHeight,
    onclone: (clonedDocument) => {
      clonedDocument.body.classList.add("is-capturing");
      // 카드 한 장만 찍을 때는 그 글의 출처 주소를 함께 보여 준다.
      clonedDocument.body.classList.toggle(
        "is-capturing-card",
        target.classList.contains("tweet-card"),
      );
      clonedDocument.body.removeAttribute("data-sheet");
    },
  });

  return canvasToBlob(canvas, exportConfig);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function shareFiles(files) {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.share !== "function" ||
    typeof navigator.canShare !== "function" ||
    !window.matchMedia("(pointer: coarse)").matches ||
    !navigator.canShare({ files })
  ) {
    return false;
  }

  try {
    await navigator.share({ files });
    return true;
  } catch (error) {
    // 취소했거나 사용자 동작 시간이 지났으면 일반 다운로드로 넘어간다.
    return error && error.name === "AbortError" ? "aborted" : false;
  }
}

/**
 * targets 를 각각 한 장씩 저장한다. 하나만 넘기면 기존의 한 장 저장과 같다.
 */
export async function captureElementsAsImages({
  targets,
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

  const list = (Array.isArray(targets) ? targets : []).filter(Boolean);
  if (!list.length) {
    setStatus("저장할 글이 없습니다.", "error");
    return;
  }
  const isBatch = list.length > 1;

  try {
    captureButton.disabled = true;
    setStatus("고해상도 이미지 생성 중...", "progress");
    await waitForDocumentVisible(setStatus);
    await waitForCaptureFonts();

    const results = [];
    for (let index = 0; index < list.length; index += 1) {
      if (isBatch) {
        setStatus(
          `이미지 생성 중... ${index + 1} / ${list.length}`,
          "progress",
        );
      }
      const { blob, extension } = await renderElementToBlob(list[index], {
        exportFormat,
        exportScale,
        html2canvasImpl,
      });
      results.push({
        blob,
        extension,
        filename: createCaptureFilename(
          isBatch
            ? { ...filenameOptions, sequence: index + 1 }
            : filenameOptions,
          extension,
        ),
      });
    }

    const extensionLabel = results[0].extension.toUpperCase();
    if (!isBatch) {
      await downloadBlob(results[0].blob, results[0].filename, {
        downloadFallbackLink,
        setStatus,
      });
      setStatus(`${extensionLabel} 파일을 저장했습니다.`, "success");
      return;
    }

    const shared = await shareFiles(
      results.map(
        ({ blob, filename }) => new File([blob], filename, { type: blob.type }),
      ),
    );
    if (shared === true) {
      setStatus(`${results.length}장을 공유 창으로 보냈습니다.`, "success");
      return;
    }
    if (shared === "aborted") {
      setStatus("공유를 취소했습니다.");
      return;
    }

    for (const { blob, filename } of results) {
      await downloadBlob(blob, filename, {
        setStatus,
        keepPreviousHref: true,
      });
      // 연속 다운로드를 브라우저가 하나로 뭉개지 않도록 간격을 둔다.
      await wait(350);
    }
    setStatus(
      `${extensionLabel} ${results.length}장을 저장했습니다. 일부만 받아졌다면 브라우저의 여러 파일 다운로드 허용을 확인하세요.`,
      "success",
    );
  } catch (error) {
    setStatus(describeCaptureError(error), "error");
  } finally {
    captureButton.disabled = false;
  }
}

export async function captureElementAsImage({ captureArea, ...rest }) {
  return captureElementsAsImages({ targets: [captureArea], ...rest });
}

export const captureElementAsPng = captureElementAsImage;
