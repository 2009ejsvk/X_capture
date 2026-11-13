import { captureElementsAsImages } from "./src/capture.js?v=copy-text-20261113";
import {
  enhanceSelectAsChips,
  syncChips,
} from "./src/app/chips.js?v=copy-text-20261113";
import { getElements } from "./src/app/elements.js?v=copy-text-20261113";
import { loadTweetFromUrl } from "./src/app/tweet-loader.js?v=copy-text-20261113";
import { normalizeCaptureSettings } from "./src/domain/capture-settings.js?v=copy-text-20261113";
import { createInitialState } from "./src/domain/tweet-model.js?v=copy-text-20261113";
import { normalizeMediaItems } from "./src/media.js?v=copy-text-20261113";
import { createRenderer } from "./src/render.js?v=copy-text-20261113";

(function () {
  const LEGACY_DRAFT_KEY = "x-capture:draft:v1";
  const DRAFT_KEY = "x-capture:draft:v2";
  const DRAFT_SAVE_DELAY_MS = 400;
  const elements = getElements();

  const state = createInitialState();
  const renderer = createRenderer(elements, state, {
    onStateChange: scheduleDraftSave,
    onSaveCard: (stateIndex) => saveSingleCard(stateIndex),
    onEditTargetChange: scrollEditedCardIntoView,
  });
  const desktopQuery = window.matchMedia("(min-width: 980px)");
  let toastTimer = 0;
  let toastAction = null;

  function applyStateToInputs() {
    renderer.applyStateToInputs();
    syncChips();
    refreshThreadControls();
  }

  function renderPreview() {
    renderer.renderPreview();
    syncChips();
  }

  function refreshThreadControls() {
    const replyCount = Array.isArray(state.replyParents)
      ? state.replyParents.length
      : 0;
    elements.openThreadBtn.classList.toggle("hidden", !replyCount);
    elements.openThreadBtn.textContent = `글 목록 ${replyCount + 1}`;
    elements.saveMainOnlyBtn.classList.toggle("hidden", !replyCount);
  }
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

  // 상태 안내는 누른 자리와 상관없이 화면 아래 토스트로 보여 준다.
  function setStatus(message, type, action) {
    if (toastTimer) {
      window.clearTimeout(toastTimer);
      toastTimer = 0;
    }

    elements.statusText.textContent = message || "";
    elements.statusText.classList.toggle("is-error", type === "error");
    elements.statusText.classList.toggle("is-success", type === "success");
    toastAction = action && action.onAction ? action.onAction : null;
    elements.toastActionBtn.textContent = action ? action.label : "";
    elements.toastActionBtn.classList.toggle("hidden", !toastAction);
    elements.toast.classList.toggle("hidden", !message);

    if (!message) {
      return;
    }

    const duration =
      type === "progress"
        ? 60000
        : type === "error" || toastAction
          ? 8000
          : 4000;
    toastTimer = window.setTimeout(() => setStatus(""), duration);
  }

  function openSheet(name) {
    if (name === "settings") {
      elements.captureSettingsSection.open = true;
    }

    if (desktopQuery.matches) {
      scrollToElement(
        name === "settings" ? elements.settingsPanel : elements.editorPanel,
      );
      return;
    }

    document.body.dataset.sheet = name;
  }

  function closeSheet() {
    delete document.body.dataset.sheet;
    renderer.setEditingTarget(null);
  }

  function scrollEditedCardIntoView() {
    window.requestAnimationFrame(() => {
      const card = elements.captureArea.querySelector(".tweet-card.is-editing");
      if (card) {
        card.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
  }

  // target: "main" 또는 이전 글의 stateIndex.
  function editCard(target) {
    setEditorTab(target === "main" ? "post" : "reply");
    renderer.setEditingTarget(target);
    openSheet("editor");
    scrollEditedCardIntoView();

    if (desktopQuery.matches) {
      return;
    }
    window.requestAnimationFrame(() => {
      const openEditor =
        target === "main" ? null : renderer.getOpenReplyEditor();
      if (openEditor) {
        openEditor.scrollIntoView({ block: "start" });
      } else {
        elements.editorPanel.scrollTop = 0;
      }
    });
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
    state.threadLayout =
      elements.threadLayout.value === "merged" ? "merged" : "separate";
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
      setStatus("트윗 정보를 가져오는 중...", "progress");
      const shouldAutoCapture = Boolean(
        elements.autoCaptureToggle && elements.autoCaptureToggle.checked,
      );

      const result = await loadTweetFromUrl(elements.tweetUrl.value, {
        signal: fetchController.signal,
        onProgress: (count) => {
          if (requestId === fetchRequestId) {
            setStatus(`이전 글 ${count}개째 불러오는 중...`, "progress");
          }
        },
      });

      if (fetchController.signal.aborted || requestId !== fetchRequestId) {
        return;
      }

      Object.assign(state, result.patch);
      elements.tweetUrl.blur();
      renderer.setEditingTarget(null);
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
        await runCapture([elements.captureArea]);
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

  async function runCapture(targets) {
    if (isCapturing) {
      return;
    }

    isCapturing = true;
    try {
      await captureElementsAsImages({
        targets,
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
    }
  }

  async function copyThreadText() {
    const text = renderer.getThreadText();
    if (!text) {
      setStatus("복사할 본문이 없습니다.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      // 클립보드 API 가 막힌 브라우저에서는 임시 입력칸을 선택해 복사한다.
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      const copied = document.execCommand("copy");
      helper.remove();
      if (!copied) {
        setStatus(
          "복사하지 못했습니다. 브라우저의 복사 권한을 확인하세요.",
          "error",
        );
        return;
      }
    }

    setStatus(`본문을 복사했습니다. (${Array.from(text).length}자)`, "success");
  }

  function closeSaveChoice() {
    elements.saveChoice.classList.add("hidden");
  }

  // 글이 여러 장이면 한 장으로 받을지 글마다 받을지 먼저 묻는다.
  function onCapture() {
    const cards = renderer.getCaptureCards();
    if (state.threadLayout !== "merged" && cards.length > 1) {
      elements.saveEachBtn.textContent = `글마다 따로 저장 (${cards.length}장)`;
      elements.saveChoice.classList.remove("hidden");
      elements.saveOneBtn.focus();
      return Promise.resolve();
    }

    return runCapture([elements.captureArea]);
  }

  function saveSingleCard(target) {
    const cards = renderer.getCaptureCards();
    const card =
      target === "main"
        ? cards[cards.length - 1]
        : elements.captureArea.querySelector(
            `.tweet-card[data-reply-index="${target}"]`,
          );
    if (!card) {
      setStatus("미리보기에 표시된 글만 저장할 수 있습니다.", "error");
      return Promise.resolve();
    }

    return runCapture([card]);
  }

  function resetEditors() {
    const snapshot = JSON.stringify({
      ...state,
      sourceUrlInput: elements.tweetUrl.value,
    });

    Object.assign(state, createInitialState());
    elements.tweetUrl.value = "";
    elements.imageInput.value = "";
    clearDraft();
    closeSheet();
    setEditorTab("post");
    applyStateToInputs();
    renderPreview();
    setStatus("입력값을 초기화했습니다.", undefined, {
      label: "되돌리기",
      onAction: () => {
        const { sourceUrlInput, ...previous } = JSON.parse(snapshot);
        Object.assign(state, createInitialState(), previous);
        elements.tweetUrl.value = sourceUrlInput || "";
        applyStateToInputs();
        renderPreview();
        scheduleDraftSave();
        setStatus("초기화 전 상태로 되돌렸습니다.", "success");
      },
    });
  }

  function onClearTweetUrl() {
    elements.tweetUrl.value = "";
    elements.tweetUrl.focus();
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

    // 붙여넣은 값이 트윗 주소면 버튼을 누르지 않아도 바로 불러온다.
    elements.tweetUrl.addEventListener("paste", () => {
      window.setTimeout(() => {
        if (/\/status\/\d{5,}/.test(elements.tweetUrl.value)) {
          onFetchClick();
        }
      }, 0);
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
    elements.threadLayout.addEventListener("change", syncFromEditors);
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
    elements.saveOneBtn.addEventListener("click", () => {
      closeSaveChoice();
      runCapture([elements.captureArea]);
    });
    elements.saveEachBtn.addEventListener("click", () => {
      closeSaveChoice();
      runCapture(renderer.getCaptureCards());
    });
    elements.saveCancelBtn.addEventListener("click", closeSaveChoice);
    elements.saveChoice.addEventListener("click", (event) => {
      if (event.target === elements.saveChoice) {
        closeSaveChoice();
      }
    });
    elements.saveMainOnlyBtn.addEventListener("click", () => {
      saveSingleCard("main");
    });
    elements.toastActionBtn.addEventListener("click", () => {
      if (toastAction) {
        toastAction();
      }
    });
    elements.resetBtn.addEventListener("click", resetEditors);

    // 미리보기의 글을 누르면 그 글의 편집 창이 열린다.
    elements.captureArea.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        return;
      }
      const card = event.target.closest(".tweet-card");
      if (!card || !elements.captureArea.contains(card)) {
        return;
      }
      const replyIndex = card.dataset.replyIndex;
      editCard(replyIndex === undefined ? "main" : Number(replyIndex));
    });
    elements.copyTextBtn.addEventListener("click", copyThreadText);
    elements.openThreadBtn.addEventListener("click", () => {
      setEditorTab("reply");
      renderer.setEditingTarget(null);
      openSheet("editor");
      elements.editorPanel.scrollTop = 0;
    });
    elements.openStyleBtn.addEventListener("click", () => {
      renderer.setEditingTarget(null);
      openSheet("settings");
    });
    elements.closeEditorSheetBtn.addEventListener("click", closeSheet);
    elements.closeSettingsSheetBtn.addEventListener("click", closeSheet);
    desktopQuery.addEventListener("change", () => {
      delete document.body.dataset.sheet;
    });

    elements.editorPostTab.addEventListener("click", () => {
      setEditorTab("post");
      renderer.setEditingTarget("main");
    });
    elements.editorMediaTab.addEventListener("click", () => {
      setEditorTab("media");
      renderer.setEditingTarget("main");
    });
    elements.editorReplyTab.addEventListener("click", () => {
      setEditorTab("reply");
      renderer.setEditingTarget(null);
    });
    elements.previewFocusBtn.addEventListener("click", () => {
      setPreviewExpanded(!previewExpanded);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (!elements.saveChoice.classList.contains("hidden")) {
          event.preventDefault();
          closeSaveChoice();
          return;
        }
        if (document.body.dataset.sheet) {
          event.preventDefault();
          closeSheet();
          return;
        }
        if (previewExpanded) {
          event.preventDefault();
          setPreviewExpanded(false);
          return;
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        onCapture();
      }
    });

    // 화면 키보드가 올라오면 시트를 키보드 바로 위로 올리고 높이를 줄인다.
    // 고정 배치 요소는 키보드를 모르기 때문에 visualViewport 로 직접 맞춘다.
    const viewport = window.visualViewport;
    if (viewport) {
      const syncKeyboardInset = () => {
        const inset = Math.max(
          0,
          document.documentElement.clientHeight -
            viewport.offsetTop -
            viewport.height,
        );
        const keyboardOpen = inset > 120;
        const rootStyle = document.documentElement.style;
        document.body.classList.toggle("has-keyboard", keyboardOpen);
        rootStyle.setProperty("--kb-inset", `${keyboardOpen ? inset : 0}px`);
        rootStyle.setProperty("--vv-height", `${viewport.height}px`);

        const focused = document.activeElement;
        if (
          keyboardOpen &&
          focused &&
          focused.closest(".editor-panel, .settings-panel")
        ) {
          window.requestAnimationFrame(() => {
            focused.scrollIntoView({ block: "center" });
          });
        }
      };
      viewport.addEventListener("resize", syncKeyboardInset);
      viewport.addEventListener("scroll", syncKeyboardInset);
    }

    enhanceSelectAsChips(elements.threadLayout);
    enhanceSelectAsChips(elements.mediaLayout);
    enhanceSelectAsChips(elements.quoteTextMode);
    enhanceSelectAsChips(elements.quoteMediaLayout);
    enhanceSelectAsChips(elements.stylePreset);
    enhanceSelectAsChips(elements.captureFontSize);
    enhanceSelectAsChips(elements.captureFontFamily, {
      scroll: true,
      fontPreview: true,
    });
    enhanceSelectAsChips(elements.captureGameFontScope);
    enhanceSelectAsChips(elements.captureOutlineWidth, { short: true });
    enhanceSelectAsChips(elements.exportFormat);
    enhanceSelectAsChips(elements.exportScale);

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
