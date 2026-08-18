import { captureElementAsImage } from "./src/capture.js?v=font-effects-20260802";
import { getElements } from "./src/app/elements.js?v=editor-tabs-v3-20260802";
import { loadTweetFromUrl } from "./src/app/tweet-loader.js?v=media-links-20260802";
import { normalizeCaptureSettings } from "./src/domain/capture-settings.js?v=default-suit-xlarge-20260802";
import { createInitialState } from "./src/domain/tweet-model.js?v=default-suit-xlarge-20260802";
import { normalizeMediaItems } from "./src/media.js";
import { createRenderer } from "./src/render.js?v=editor-tabs-v3-20260802";

(function () {
  const LEGACY_DRAFT_KEY = "x-capture:draft:v1";
  const DRAFT_KEY = "x-capture:draft:v2";
  const DRAFT_SAVE_DELAY_MS = 400;
  const elements = getElements();

  const state = createInitialState();
  const { applyStateToInputs, renderPreview } = createRenderer(
    elements,
    state,
    { onStateChange: scheduleDraftSave },
  );
  let activeFetchController = null;
  let fetchRequestId = 0;
  let previewExpanded = false;
  let activeEditorTab = "post";
  let isCapturing = false;
  let draftSaveTimer = 0;
  let draftRestored = false;

  function setEditorTab(nextTab) {
    const tabs = {
      post: [elements.editorPostTab, elements.mainEditorSection],
      media: [elements.editorMediaTab, elements.mediaEditorSection],
      reply: [elements.editorReplyTab, elements.replyEditorSection],
    };
    const requestedTab = tabs[nextTab];
    activeEditorTab =
      requestedTab && !requestedTab[0].disabled ? nextTab : "post";

    Object.entries(tabs).forEach(([tabName, [button, panel]]) => {
      const isActive = tabName === activeEditorTab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
      panel.classList.toggle("hidden", !isActive);
    });
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

  function syncFromEditors() {
    const captureSettings = normalizeCaptureSettings({
      stylePreset: elements.stylePreset.value,
      captureFontSize: elements.captureFontSize.value,
      captureFontFamily: elements.captureFontFamily.value,
      captureGameFontScope: elements.captureGameFontScope.value,
      captureOutlineWidth: elements.captureOutlineWidth.value,
      captureOutlineColor: elements.captureOutlineColor.value,
      captureTextShadow: elements.captureTextShadow.checked,
      exportFormat: elements.exportFormat.value,
      exportScale: elements.exportScale.value,
    });

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
    state.quoteTextMode =
      elements.quoteTextMode.value === "preview" ? "preview" : "full";
    state.quoteMediaLayout =
      elements.quoteMediaLayout.value === "vertical" ? "vertical" : "grid";
    state.quoteAuthorName = elements.quoteAuthorName.value;
    state.quoteAuthorHandle = elements.quoteAuthorHandle.value;
    state.quoteText = elements.quoteText.value;
    Object.assign(state, captureSettings);
    renderPreview();
    scheduleDraftSave();
  }

  function readStoredDraft() {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function writeDraft() {
    draftSaveTimer = 0;
    const snapshot = { ...state, sourceUrlInput: elements.tweetUrl.value };

    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
      return;
    } catch (error) {
      // Image data URLs are the only realistic way to blow the storage quota.
    }

    try {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          ...snapshot,
          profileImageSrc: "",
          imageDataUrls: [],
          quoteDataUrls: [],
          quoteAuthorProfileImageSrc: "",
          replyParents: (Array.isArray(snapshot.replyParents)
            ? snapshot.replyParents
            : []
          ).map((item) => ({
            ...item,
            dataUrls: [],
            authorProfileImageSrc: "",
          })),
          imagesOmitted: true,
        }),
      );
    } catch (error) {
      // Draft persistence is best-effort.
    }
  }

  function scheduleDraftSave() {
    if (!draftRestored) {
      return;
    }

    if (draftSaveTimer) {
      window.clearTimeout(draftSaveTimer);
    }
    draftSaveTimer = window.setTimeout(writeDraft, DRAFT_SAVE_DELAY_MS);
  }

  function clearDraft() {
    if (draftSaveTimer) {
      window.clearTimeout(draftSaveTimer);
      draftSaveTimer = 0;
    }

    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      // Storage cleanup is best-effort.
    }
  }

  function restoreDraft() {
    const draft = readStoredDraft();
    draftRestored = true;
    if (!draft) {
      return;
    }

    const { sourceUrlInput, imagesOmitted, ...draftState } = draft;
    Object.assign(state, createInitialState(), draftState);
    if (typeof sourceUrlInput === "string") {
      elements.tweetUrl.value = sourceUrlInput;
    }

    applyStateToInputs();
    renderPreview();
    setStatus(
      imagesOmitted
        ? "이전 작업을 복구했습니다. 용량 때문에 이미지는 복구하지 못했습니다."
        : "이전 작업을 복구했습니다.",
    );
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
      scheduleDraftSave();
      if (result.usedFallback) {
        setStatus(
          result.fallbackStatusMessage
            ? `${result.fallbackStatusMessage} 필요하면 내용을 수정하고 저장하세요.`
            : "불러오기 완료(보조 경로). 필요하면 내용을 수정하고 저장하세요.",
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

  async function addImagesFromInput(event, target) {
    const input = event.target;
    const files = Array.from(input.files || []).slice(0, 4);
    if (!files.length) {
      return;
    }

    try {
      const loaded = await Promise.all(files.map(readFileAsDataUrl));
      const previousCount = normalizeMediaItems(state[target.stateKey]).length;
      const nextImages = normalizeMediaItems([
        ...normalizeMediaItems(state[target.stateKey]),
        ...loaded.filter(Boolean),
      ]);
      state[target.stateKey] = nextImages;
      if (target.section && target.section.tagName === "DETAILS") {
        target.section.open = true;
      }
      input.value = "";
      applyStateToInputs();
      renderPreview();
      scheduleDraftSave();
      const addedCount = Math.max(nextImages.length - previousCount, 0);
      setStatus(
        addedCount
          ? `${target.label} ${addedCount}장 추가 완료. 현재 ${nextImages.length}장입니다.`
          : `${target.label}는 최대 4장까지 추가할 수 있습니다.`,
        addedCount ? "success" : "error",
      );
    } catch (error) {
      setStatus("이미지를 반영하지 못했습니다.", "error");
    }
  }

  function removeAllImages(target) {
    state[target.stateKey] = [];
    if (target.input) {
      target.input.value = "";
    }
    applyStateToInputs();
    renderPreview();
    scheduleDraftSave();
    setStatus(`${target.label}를 모두 제거했습니다.`);
  }

  async function onCapture() {
    if (isCapturing) {
      return;
    }

    isCapturing = true;
    elements.quickCaptureBtn.disabled = true;
    try {
      await captureElementAsImage({
        captureArea: elements.captureArea,
        captureButton: elements.captureBtn,
        downloadFallbackLink: elements.downloadFallbackLink,
        exportFormat: state.exportFormat,
        exportScale: state.exportScale,
        filenameOptions: {
          authorHandle: state.authorHandle,
          authorName: state.authorName,
          tweetDate: state.tweetDate,
          sourceUrl: state.sourceUrl,
        },
        setStatus,
        html2canvasImpl: window.html2canvas,
      });
    } finally {
      isCapturing = false;
      elements.quickCaptureBtn.disabled = false;
    }
  }

  function resetEditors() {
    Object.assign(state, createInitialState());
    elements.tweetUrl.value = "";
    elements.imageInput.value = "";
    clearDraft();
    setEditorTab("post");
    applyStateToInputs();
    renderPreview();
    setStatus("입력값을 초기화했습니다.");
  }

  function onClearTweetUrl() {
    elements.tweetUrl.value = "";
    elements.tweetUrl.focus();
    setStatus("트윗 URL 입력값을 지웠습니다.");
  }

  function scrollToElement(element) {
    if (!element) {
      return;
    }

    element.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function setPreviewExpanded(nextExpanded) {
    previewExpanded = nextExpanded;
    document.body.classList.toggle("is-preview-expanded", previewExpanded);
    elements.previewFocusBtn.textContent = previewExpanded
      ? "편집으로 돌아가기"
      : "미리보기 확대";
    elements.previewFocusBtn.setAttribute(
      "aria-pressed",
      String(previewExpanded),
    );

    if (previewExpanded) {
      elements.previewFocusBtn.focus();
      elements.previewFocusBtn.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    }
  }

  function clearLegacyDraft() {
    try {
      window.localStorage.removeItem(LEGACY_DRAFT_KEY);
    } catch (error) {
      // Storage cleanup is best-effort.
    }
  }

  function wireEvents() {
    elements.fetchBtn.addEventListener("click", onFetchClick);
    elements.clearUrlBtn.addEventListener("click", onClearTweetUrl);
    elements.tweetUrl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
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
    elements.quoteTextMode.addEventListener("change", syncFromEditors);
    elements.quoteMediaLayout.addEventListener("change", syncFromEditors);
    elements.quoteAuthorName.addEventListener("input", syncFromEditors);
    elements.quoteAuthorHandle.addEventListener("input", syncFromEditors);
    elements.quoteText.addEventListener("input", syncFromEditors);
    elements.stylePreset.addEventListener("change", syncFromEditors);
    elements.captureFontSize.addEventListener("change", syncFromEditors);
    elements.captureFontFamily.addEventListener("change", syncFromEditors);
    elements.captureGameFontScope.addEventListener("change", syncFromEditors);
    elements.captureOutlineWidth.addEventListener("change", syncFromEditors);
    elements.captureOutlineColor.addEventListener("input", syncFromEditors);
    elements.captureTextShadow.addEventListener("change", syncFromEditors);
    elements.exportFormat.addEventListener("change", syncFromEditors);
    elements.exportScale.addEventListener("change", syncFromEditors);
    elements.previewAvatarImage.addEventListener("error", () => {
      state.profileImageSrc = "";
      renderPreview();
    });
    elements.previewQuoteAvatar.addEventListener("error", () => {
      state.quoteAuthorProfileImageSrc = "";
      renderPreview();
    });
    const mainImageTarget = {
      stateKey: "imageDataUrls",
      label: "첨부 이미지",
      input: elements.imageInput,
      section: elements.mediaEditorSection,
    };
    const quoteImageTarget = {
      stateKey: "quoteDataUrls",
      label: "리트윗 원문 이미지",
      input: elements.quoteImageInput,
      section: elements.quoteEditorSection,
    };

    elements.imageInput.addEventListener("change", (event) => {
      addImagesFromInput(event, mainImageTarget);
    });
    elements.removeImageBtn.addEventListener("click", () => {
      removeAllImages(mainImageTarget);
    });
    elements.quoteImageInput.addEventListener("change", (event) => {
      addImagesFromInput(event, quoteImageTarget);
    });
    elements.removeQuoteImageBtn.addEventListener("click", () => {
      removeAllImages(quoteImageTarget);
    });
    elements.captureBtn.addEventListener("click", onCapture);
    elements.quickCaptureBtn.addEventListener("click", onCapture);
    elements.resetBtn.addEventListener("click", resetEditors);
    elements.jumpEditorBtn.addEventListener("click", () => {
      setEditorTab("post");
      scrollToElement(elements.editorPanel);
    });
    elements.jumpPreviewBtn.addEventListener("click", () => {
      scrollToElement(elements.previewPanel);
    });
    elements.jumpSettingsBtn.addEventListener("click", () => {
      elements.captureSettingsSection.open = true;
      scrollToElement(elements.settingsPanel);
    });
    elements.editorPostTab.addEventListener("click", () => {
      setEditorTab("post");
    });
    elements.editorMediaTab.addEventListener("click", () => {
      setEditorTab("media");
    });
    elements.editorReplyTab.addEventListener("click", () => {
      setEditorTab("reply");
    });
    elements.previewFocusBtn.addEventListener("click", () => {
      setPreviewExpanded(!previewExpanded);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && previewExpanded) {
        event.preventDefault();
        setPreviewExpanded(false);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        onCapture();
      }
    });

    window.addEventListener("beforeunload", () => {
      if (draftSaveTimer) {
        window.clearTimeout(draftSaveTimer);
        writeDraft();
      }
    });
  }

  clearLegacyDraft();
  wireEvents();
  applyStateToInputs();
  setEditorTab(activeEditorTab);
  renderPreview();
  restoreDraft();
})();
