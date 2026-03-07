(function () {
  const elements = {
    threadUrl: document.getElementById("threadUrl"),
    clearUrlBtn: document.getElementById("threadClearUrlBtn"),
    fetchBtn: document.getElementById("threadFetchBtn"),
    statusText: document.getElementById("threadStatusText"),
    authorName: document.getElementById("threadAuthorName"),
    authorHandle: document.getElementById("threadAuthorHandle"),
    threadDate: document.getElementById("threadDateInput"),
    threadText: document.getElementById("threadTextInput"),
    noteText: document.getElementById("threadNoteInput"),
    imageInput: document.getElementById("threadImageInput"),
    removeImageBtn: document.getElementById("threadRemoveImageBtn"),
    mediaLayout: document.getElementById("threadMediaLayout"),
    showOriginalUrlToggle: document.getElementById("threadShowOriginalUrlToggle"),
    resetBtn: document.getElementById("threadResetBtn"),
    captureBtn: document.getElementById("threadCaptureBtn"),
    captureArea: document.getElementById("threadCaptureArea"),
    previewAvatarImage: document.getElementById("threadPreviewAvatarImage"),
    previewAvatarInitial: document.getElementById("threadPreviewAvatarInitial"),
    previewName: document.getElementById("threadPreviewName"),
    previewHandle: document.getElementById("threadPreviewHandle"),
    previewText: document.getElementById("threadPreviewText"),
    previewNote: document.getElementById("threadPreviewNote"),
    previewNoteText: document.getElementById("threadPreviewNoteText"),
    previewMedia: document.getElementById("threadPreviewMedia"),
    previewDate: document.getElementById("threadPreviewDate"),
    previewSource: document.getElementById("threadPreviewSource"),
    previewOriginalUrl: document.getElementById("threadPreviewOriginalUrl"),
  };

  if (!elements.threadUrl) {
    return;
  }

  const defaultApiOrigin = "http://localhost:5173";

  function currentDateTimeLabel() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  function createInitialState() {
    return {
      authorHandle: "@threads",
      authorName: "Threads User",
      imageDataUrls: [],
      mediaLayout: "vertical",
      noteText: "",
      profileImageSrc: "",
      showOriginalUrl: true,
      sourceUrl: "",
      threadDate: "",
      threadText: "캡처할 Threads 본문이 여기에 표시됩니다.",
    };
  }

  const state = createInitialState();

  function getApiOrigin() {
    if (window.location.protocol === "file:") {
      return defaultApiOrigin;
    }

    const hostname = String(window.location.hostname || "").toLowerCase();
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    if (isLocalhost && window.location.port !== "5173") {
      return defaultApiOrigin;
    }

    return window.location.origin || defaultApiOrigin;
  }

  function toApiUrl(pathOrUrl) {
    const value = String(pathOrUrl || "").trim();
    if (!value) {
      return "";
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    try {
      return new URL(value, getApiOrigin()).href;
    } catch (error) {
      return value;
    }
  }

  function setStatus(message, type) {
    elements.statusText.textContent = message || "";
    elements.statusText.classList.remove("is-error", "is-success");

    if (type === "error") {
      elements.statusText.classList.add("is-error");
    }

    if (type === "success") {
      elements.statusText.classList.add("is-success");
    }
  }

  function normalizeHandle(value) {
    const text = String(value || "").trim();
    if (!text) {
      return "@threads";
    }
    return text.startsWith("@") ? text : `@${text}`;
  }

  function resolveSourceMeta(sourceUrl) {
    const normalized = String(sourceUrl || "").trim();
    if (!normalized) {
      return {
        sourceHost: "threads.com",
        sourceHref: "",
      };
    }

    try {
      const parsed = new URL(normalized);
      return {
        sourceHost: parsed.host.replace(/^www\./i, "") || "threads.com",
        sourceHref: parsed.href,
      };
    } catch (error) {
      return {
        sourceHost: "threads.com",
        sourceHref: "",
      };
    }
  }

  function applyImageSource(imageElement, source) {
    const nextSource = String(source || "").trim();
    if (!nextSource) {
      imageElement.removeAttribute("src");
      return false;
    }

    if (imageElement.getAttribute("src") !== nextSource) {
      imageElement.removeAttribute("src");
      imageElement.src = nextSource;
    }

    return true;
  }

  function populateMedia(container, imageSources, layout) {
    container.innerHTML = "";
    const normalizedSources = Array.isArray(imageSources)
      ? imageSources.map((source) => String(source || "").trim()).filter(Boolean).slice(0, 4)
      : [];

    if (!normalizedSources.length) {
      container.classList.add("hidden");
      container.removeAttribute("data-count");
      container.removeAttribute("data-layout");
      return;
    }

    container.dataset.count = String(normalizedSources.length);
    container.dataset.layout = normalizedSources.length > 1 ? layout : "single";
    container.classList.remove("hidden");

    normalizedSources.forEach((source, index) => {
      const image = document.createElement("img");
      image.className = "thread-image";
      image.alt = `Threads 이미지 ${index + 1}`;
      image.loading = index === 0 ? "eager" : "lazy";
      image.src = source;
      container.appendChild(image);
    });
  }

  function renderPreview() {
    const authorName = String(state.authorName || "").trim() || "Threads User";
    const authorHandle = normalizeHandle(state.authorHandle);
    const threadText = String(state.threadText || "").replace(/\r\n/g, "\n").trim();
    const noteText = String(state.noteText || "").replace(/\r\n/g, "\n").trim();
    const { sourceHost, sourceHref } = resolveSourceMeta(state.sourceUrl);

    elements.previewName.textContent = authorName;
    elements.previewHandle.textContent = authorHandle;
    elements.previewDate.textContent = String(state.threadDate || "").trim() || "날짜 미확인";
    elements.previewSource.textContent = sourceHost;

    if (threadText) {
      elements.previewText.textContent = threadText;
      elements.previewText.classList.remove("hidden");
    } else if (!state.sourceUrl) {
      elements.previewText.textContent = "캡처할 Threads 본문이 여기에 표시됩니다.";
      elements.previewText.classList.remove("hidden");
    } else {
      elements.previewText.textContent = "";
      elements.previewText.classList.add("hidden");
    }

    if (noteText) {
      elements.previewNoteText.textContent = noteText;
      elements.previewNote.classList.remove("hidden");
    } else {
      elements.previewNoteText.textContent = "";
      elements.previewNote.classList.add("hidden");
    }

    const avatarSeed = authorName || authorHandle.replace(/^@/, "") || "T";
    elements.previewAvatarInitial.textContent = avatarSeed.charAt(0).toUpperCase() || "T";
    if (state.profileImageSrc) {
      applyImageSource(elements.previewAvatarImage, state.profileImageSrc);
      elements.previewAvatarImage.classList.remove("hidden");
      elements.previewAvatarInitial.classList.add("hidden");
    } else {
      elements.previewAvatarImage.removeAttribute("src");
      elements.previewAvatarImage.classList.add("hidden");
      elements.previewAvatarInitial.classList.remove("hidden");
    }

    populateMedia(elements.previewMedia, state.imageDataUrls, state.mediaLayout);

    if (sourceHref && state.showOriginalUrl) {
      elements.previewOriginalUrl.textContent = sourceHref;
      elements.previewOriginalUrl.href = sourceHref;
      elements.previewOriginalUrl.classList.remove("hidden");
    } else {
      elements.previewOriginalUrl.textContent = "";
      elements.previewOriginalUrl.removeAttribute("href");
      elements.previewOriginalUrl.classList.add("hidden");
    }
  }

  function applyStateToInputs() {
    elements.authorName.value = state.authorName;
    elements.authorHandle.value = state.authorHandle;
    elements.threadDate.value = state.threadDate;
    elements.threadText.value = state.threadText;
    elements.noteText.value = state.noteText;
    elements.mediaLayout.value = state.mediaLayout;
    elements.showOriginalUrlToggle.checked = Boolean(state.showOriginalUrl);
  }

  function syncFromEditors() {
    state.authorName = elements.authorName.value;
    state.authorHandle = elements.authorHandle.value;
    state.threadDate = elements.threadDate.value;
    state.threadText = elements.threadText.value;
    state.noteText = elements.noteText.value;
    state.mediaLayout = elements.mediaLayout.value === "grid" ? "grid" : "vertical";
    state.showOriginalUrl = Boolean(elements.showOriginalUrlToggle.checked);
    renderPreview();
  }

  async function fetchThreadData(threadUrl) {
    const endpoint = `${getApiOrigin()}/api/thread?url=${encodeURIComponent(threadUrl)}`;
    let response;

    try {
      response = await fetch(endpoint);
    } catch (error) {
      throw new Error("로컬 API 서버(http://localhost:5173)에 연결하지 못했습니다. `npm start`로 서버를 실행해 주세요.");
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error("API 응답을 읽지 못했습니다. `npm start`로 연 서버에 접속 중인지 확인해 주세요.");
    }

    if (!response.ok) {
      throw new Error(payload && payload.error ? payload.error : "Threads 링크를 불러오지 못했습니다.");
    }

    return payload;
  }

  async function onFetchClick() {
    try {
      elements.fetchBtn.disabled = true;
      setStatus("Threads 정보를 가져오는 중...");

      const payload = await fetchThreadData(elements.threadUrl.value);
      state.authorName = payload.authorName || "Threads User";
      state.authorHandle = payload.authorHandle || "@threads";
      state.threadDate = payload.threadDate || "";
      state.threadText = payload.threadText || "";
      state.noteText = "";
      state.profileImageSrc = toApiUrl(payload.profileImageUrl || "");
      state.imageDataUrls = Array.isArray(payload.imageUrls)
        ? payload.imageUrls.slice(0, 4).map(toApiUrl).filter(Boolean)
        : [];
      state.sourceUrl = payload.sourceUrl || "";

      applyStateToInputs();
      renderPreview();

      const warningText = Array.isArray(payload.warnings) ? payload.warnings.join(" ") : "";
      setStatus(
        warningText
          ? `불러오기 완료. ${warningText}`
          : "불러오기 완료. 필요하면 내용을 수정한 뒤 저장하세요.",
        "success"
      );
      await onCapture();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.", "error");
    } finally {
      elements.fetchBtn.disabled = false;
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });
  }

  async function onImageSelected(event) {
    const files = Array.from(event.target.files || []).slice(0, 4);
    if (!files.length) {
      return;
    }

    try {
      state.imageDataUrls = (await Promise.all(files.map(readFileAsDataUrl))).filter(Boolean);
      renderPreview();
      setStatus(`${state.imageDataUrls.length}장 이미지를 반영했습니다.`, "success");
    } catch (error) {
      setStatus("이미지를 반영하지 못했습니다.", "error");
    }
  }

  function onRemoveImage() {
    state.imageDataUrls = [];
    elements.imageInput.value = "";
    renderPreview();
    setStatus("이미지를 제거했습니다.");
  }

  function downloadBlob(blob, filename) {
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  }

  function waitForNextFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  function waitForImageReady(image, timeoutMs) {
    if (!image || !(image instanceof HTMLImageElement)) {
      return Promise.resolve();
    }

    const src = String(image.getAttribute("src") || "").trim();
    if (!src || image.classList.contains("hidden")) {
      return Promise.resolve();
    }

    if (image.complete && image.naturalWidth > 0) {
      if (typeof image.decode === "function") {
        return image.decode().catch(() => {});
      }
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let done = false;
      let timerId = 0;

      const cleanup = () => {
        image.removeEventListener("load", onDone);
        image.removeEventListener("error", onDone);
        if (timerId) {
          clearTimeout(timerId);
        }
      };

      const onDone = () => {
        if (done) {
          return;
        }
        done = true;
        cleanup();
        resolve();
      };

      image.addEventListener("load", onDone, { once: true });
      image.addEventListener("error", onDone, { once: true });
      timerId = window.setTimeout(onDone, timeoutMs);
    });
  }

  async function waitForCaptureImages() {
    await waitForNextFrame();
    await waitForNextFrame();

    const images = Array.from(elements.captureArea.querySelectorAll("img")).filter((image) => {
      return image instanceof HTMLImageElement &&
        !image.classList.contains("hidden") &&
        Boolean(String(image.getAttribute("src") || "").trim());
    });

    if (!images.length) {
      return;
    }

    await Promise.all(images.map((image) => waitForImageReady(image, 6000)));
    await waitForNextFrame();
  }

  async function onCapture() {
    if (typeof html2canvas !== "function") {
      setStatus("캡처 라이브러리를 불러오지 못했습니다.", "error");
      return;
    }

    try {
      elements.captureBtn.disabled = true;
      setStatus("고해상도 PNG를 생성하는 중...");

      await waitForCaptureImages();

      const captureWidth = elements.captureArea.offsetWidth || 360;
      const widthScale = 1440 / captureWidth;
      const scale = Math.min(Math.max(window.devicePixelRatio || 1, widthScale, 2), 5);
      const canvas = await html2canvas(elements.captureArea, {
        allowTaint: false,
        backgroundColor: null,
        imageTimeout: 15000,
        scale,
        useCORS: true,
      });

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) {
            resolve(result);
            return;
          }
          reject(new Error("이미지 생성 실패"));
        }, "image/png");
      });

      downloadBlob(blob, `thread-capture-${Date.now()}.png`);
      setStatus("PNG 파일을 저장했습니다.", "success");
    } catch (error) {
      setStatus("PNG 저장에 실패했습니다.", "error");
    } finally {
      elements.captureBtn.disabled = false;
    }
  }

  function resetEditors() {
    Object.assign(state, createInitialState());
    elements.threadUrl.value = "";
    elements.imageInput.value = "";
    applyStateToInputs();
    renderPreview();
    setStatus("입력값을 초기화했습니다.");
  }

  function onClearUrl() {
    elements.threadUrl.value = "";
    elements.threadUrl.focus();
    setStatus("Threads 링크 입력값을 지웠습니다.");
  }

  function wireEvents() {
    elements.fetchBtn.addEventListener("click", onFetchClick);
    elements.clearUrlBtn.addEventListener("click", onClearUrl);
    elements.threadUrl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onFetchClick();
      }
    });
    elements.authorName.addEventListener("input", syncFromEditors);
    elements.authorHandle.addEventListener("input", syncFromEditors);
    elements.threadDate.addEventListener("input", syncFromEditors);
    elements.threadText.addEventListener("input", syncFromEditors);
    elements.noteText.addEventListener("input", syncFromEditors);
    elements.mediaLayout.addEventListener("change", syncFromEditors);
    elements.showOriginalUrlToggle.addEventListener("change", syncFromEditors);
    elements.imageInput.addEventListener("change", onImageSelected);
    elements.removeImageBtn.addEventListener("click", onRemoveImage);
    elements.captureBtn.addEventListener("click", onCapture);
    elements.resetBtn.addEventListener("click", resetEditors);
    elements.previewAvatarImage.addEventListener("error", () => {
      state.profileImageSrc = "";
      renderPreview();
    });
  }

  wireEvents();
  applyStateToInputs();
  if (!state.threadDate) {
    elements.threadDate.placeholder = `예: ${currentDateTimeLabel()}`;
  }
  if (window.location.protocol === "file:") {
    setStatus("현재 파일로 직접 열려 있습니다. 가능하면 `npm start` 후 http://localhost:5173 로 접속하세요.");
  }
  renderPreview();
})();
