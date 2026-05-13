import { captureElementAsPng } from "./src/capture.js";
import { getElements } from "./src/app/elements.js";
import { loadTweetFromUrl } from "./src/app/tweet-loader.js";
import { createInitialState } from "./src/domain/tweet-model.js";
import { normalizeMediaItems } from "./src/media.js";
import { createRenderer } from "./src/render.js";

(function () {
  const elements = getElements();

  const state = createInitialState();
  const { applyStateToInputs, renderPreview } = createRenderer(elements, state);
  let activeFetchController = null;
  let fetchRequestId = 0;

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

  function syncFromEditors() {
    state.authorName = elements.authorName.value;
    state.authorHandle = elements.authorHandle.value;
    state.tweetDate = elements.tweetDate.value;
    state.tweetText = elements.tweetText.value;
    state.translationText = elements.translationText.value;
    state.replyCount = elements.replyCount.value;
    state.retweetCount = elements.retweetCount.value;
    state.likeCount = elements.likeCount.value;
    state.bookmarkCount = elements.bookmarkCount.value;
    state.mediaLayout =
      elements.mediaLayout.value === "vertical" ? "vertical" : "grid";
    state.showReply = Boolean(elements.showReplyToggle.checked);
    state.showReplyMedia = Boolean(elements.showReplyMediaToggle.checked);
    state.showQuote = Boolean(elements.showQuoteToggle.checked);
    state.showQuoteMedia = Boolean(elements.showQuoteMediaToggle.checked);
    state.quoteMediaLayout =
      elements.quoteMediaLayout.value === "vertical" ? "vertical" : "grid";
    state.quoteAuthorName = elements.quoteAuthorName.value;
    state.quoteAuthorHandle = elements.quoteAuthorHandle.value;
    state.quoteText = elements.quoteText.value;
    renderPreview();
  }

  async function onFetchClick() {
    if (activeFetchController) {
      activeFetchController.abort();
    }

    const requestId = fetchRequestId + 1;
    const fetchController = new AbortController();
    fetchRequestId = requestId;
    activeFetchController = fetchController;

    try {
      elements.fetchBtn.disabled = true;
      setStatus("트윗 정보를 가져오는 중...");
      const shouldAutoCapture = Boolean(
        elements.autoCaptureToggle && elements.autoCaptureToggle.checked,
      );

      const result = await loadTweetFromUrl(elements.tweetUrl.value, {
        signal: fetchController.signal,
      });

      if (fetchController.signal.aborted || requestId !== fetchRequestId) {
        return;
      }

      Object.assign(state, result.patch);
      applyStateToInputs();
      renderPreview();
      if (result.usedFallback) {
        setStatus(
          "불러오기 완료(보조 경로). 필요하면 내용을 수정하고 저장하세요.",
          "success",
        );
      } else {
        setStatus(
          "불러오기 완료. 필요하면 내용을 수정하고 저장하세요.",
          "success",
        );
      }

      if (shouldAutoCapture) {
        await onCapture();
      }
    } catch (error) {
      if (fetchController.signal.aborted) {
        return;
      }

      setStatus(
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다.",
        "error",
      );
    } finally {
      if (activeFetchController === fetchController) {
        activeFetchController = null;
        elements.fetchBtn.disabled = false;
      }
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : "");
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
      const loaded = await Promise.all(files.map(readFileAsDataUrl));
      state.imageDataUrls = normalizeMediaItems(loaded.filter(Boolean));
      applyStateToInputs();
      renderPreview();
      setStatus(`${state.imageDataUrls.length}장 이미지 반영 완료.`, "success");
    } catch (error) {
      setStatus("이미지를 반영하지 못했습니다.", "error");
    }
  }

  function onRemoveImage() {
    state.imageDataUrls = [];
    elements.imageInput.value = "";
    applyStateToInputs();
    renderPreview();
    setStatus("이미지를 제거했습니다.");
  }

  async function onCapture() {
    await captureElementAsPng({
      captureArea: elements.captureArea,
      captureButton: elements.captureBtn,
      downloadFallbackLink: elements.downloadFallbackLink,
      setStatus,
      html2canvasImpl: window.html2canvas,
    });
  }

  function resetEditors() {
    Object.assign(state, createInitialState());
    elements.tweetUrl.value = "";
    elements.imageInput.value = "";
    applyStateToInputs();
    renderPreview();
    setStatus("입력값을 초기화했습니다.");
  }

  function onClearTweetUrl() {
    elements.tweetUrl.value = "";
    elements.tweetUrl.focus();
    setStatus("트윗 URL 입력값을 지웠습니다.");
  }

  function wireEvents() {
    elements.fetchBtn.addEventListener("click", onFetchClick);
    elements.clearUrlBtn.addEventListener("click", onClearTweetUrl);
    elements.tweetUrl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onFetchClick();
      }
    });

    elements.authorName.addEventListener("input", syncFromEditors);
    elements.authorHandle.addEventListener("input", syncFromEditors);
    elements.tweetDate.addEventListener("input", syncFromEditors);
    elements.tweetText.addEventListener("input", syncFromEditors);
    elements.translationText.addEventListener("input", syncFromEditors);
    elements.replyCount.addEventListener("input", syncFromEditors);
    elements.retweetCount.addEventListener("input", syncFromEditors);
    elements.likeCount.addEventListener("input", syncFromEditors);
    elements.bookmarkCount.addEventListener("input", syncFromEditors);
    elements.mediaLayout.addEventListener("change", syncFromEditors);
    elements.showReplyToggle.addEventListener("change", syncFromEditors);
    elements.showReplyMediaToggle.addEventListener("change", syncFromEditors);
    elements.showQuoteToggle.addEventListener("change", syncFromEditors);
    elements.showQuoteMediaToggle.addEventListener("change", syncFromEditors);
    elements.quoteMediaLayout.addEventListener("change", syncFromEditors);
    elements.quoteAuthorName.addEventListener("input", syncFromEditors);
    elements.quoteAuthorHandle.addEventListener("input", syncFromEditors);
    elements.quoteText.addEventListener("input", syncFromEditors);
    elements.previewAvatarImage.addEventListener("error", () => {
      state.profileImageSrc = "";
      renderPreview();
    });
    elements.previewQuoteAvatar.addEventListener("error", () => {
      state.quoteAuthorProfileImageSrc = "";
      renderPreview();
    });
    elements.imageInput.addEventListener("change", onImageSelected);
    elements.removeImageBtn.addEventListener("click", onRemoveImage);
    elements.captureBtn.addEventListener("click", onCapture);
    elements.resetBtn.addEventListener("click", resetEditors);
  }

  wireEvents();
  applyStateToInputs();
  renderPreview();
})();
