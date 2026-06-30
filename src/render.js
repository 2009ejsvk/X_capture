import {
  currentDateTimeLabel,
  normalizeHandle,
  toDisplayText,
} from "./utils.js?v=flag-emoji-20260630";
import {
  normalizeExportFormat,
  normalizeExportScale,
  normalizeStylePreset,
} from "./domain/capture-settings.js";
import { getVisibleMediaSrcs, normalizeMediaItems } from "./media.js";
import { createMediaSelector } from "./render/media-selector.js";
import { populateTweetMedia } from "./render/media.js";
import { createReplyTweetCard } from "./render/reply-card.js?v=flag-emoji-20260630";
import { resolveSourceMeta } from "./render/source-meta.js";

export function createRenderer(elements, state, options = {}) {
  function notifyStateChange() {
    if (typeof options.onStateChange === "function") {
      options.onStateChange();
    }
  }

  function getReplyParentsInDisplayOrder() {
    if (!Array.isArray(state.replyParents) || !state.replyParents.length) {
      return [];
    }

    const ordered = [];
    for (let index = state.replyParents.length - 1; index >= 0; index -= 1) {
      ordered.push({
        item: state.replyParents[index],
        stateIndex: index,
      });
    }
    return ordered;
  }

  function renderReplyEditors() {
    if (!elements.replyEditorList) {
      return;
    }

    const orderedReplies = getReplyParentsInDisplayOrder();
    elements.replyEditorList.innerHTML = "";

    if (!orderedReplies.length) {
      elements.replyEditorList.classList.add("hidden");
      return;
    }

    orderedReplies.forEach(({ item, stateIndex }, orderIndex) => {
      const authorName = String((item && item.authorName) || "").trim();
      const authorHandle = normalizeHandle(item && item.authorHandle, "");
      const titleText =
        [authorName, authorHandle].filter(Boolean).join(" ") ||
        `답글 ${orderIndex + 1}`;

      const editorItem = document.createElement("section");
      editorItem.className = "reply-editor-item";

      const visibilityRow = document.createElement("label");
      visibilityRow.className = "check-option reply-visibility-option";
      const visibilityToggle = document.createElement("input");
      visibilityToggle.type = "checkbox";
      visibilityToggle.checked = item.visible !== false;
      visibilityToggle.addEventListener("change", (event) => {
        if (
          !Array.isArray(state.replyParents) ||
          !state.replyParents[stateIndex]
        ) {
          return;
        }
        state.replyParents[stateIndex].visible = Boolean(event.target.checked);
        renderPreview();
        notifyStateChange();
      });
      const visibilityText = document.createElement("span");
      visibilityText.textContent = "캡처에 표시";
      visibilityRow.appendChild(visibilityToggle);
      visibilityRow.appendChild(visibilityText);
      editorItem.appendChild(visibilityRow);

      const title = document.createElement("p");
      title.className = "reply-editor-title";
      title.textContent = toDisplayText(titleText);
      editorItem.appendChild(title);

      const bodyField = document.createElement("div");
      bodyField.className = "reply-editor-fields";
      const bodyInputId = `replyBodyInput-${stateIndex}`;
      const bodyLabel = document.createElement("label");
      bodyLabel.className = "reply-editor-label";
      bodyLabel.htmlFor = bodyInputId;
      bodyLabel.textContent = "본문";
      const bodyTextarea = document.createElement("textarea");
      bodyTextarea.className = "reply-editor-textarea";
      bodyTextarea.id = bodyInputId;
      bodyTextarea.rows = 3;
      bodyTextarea.value = String((item && item.text) || "");
      bodyTextarea.placeholder = "답글 본문을 입력하세요.";
      bodyTextarea.addEventListener("input", (event) => {
        if (
          !Array.isArray(state.replyParents) ||
          !state.replyParents[stateIndex]
        ) {
          return;
        }
        state.replyParents[stateIndex].text = event.target.value;
        renderPreview();
        notifyStateChange();
      });
      bodyField.appendChild(bodyLabel);
      bodyField.appendChild(bodyTextarea);
      editorItem.appendChild(bodyField);

      const translationField = document.createElement("div");
      translationField.className = "reply-editor-fields";
      const translationInputId = `replyTranslationInput-${stateIndex}`;
      const translationLabel = document.createElement("label");
      translationLabel.className = "reply-editor-label";
      translationLabel.htmlFor = translationInputId;
      translationLabel.textContent = "번역";
      const translationTextarea = document.createElement("textarea");
      translationTextarea.className = "reply-editor-textarea";
      translationTextarea.id = translationInputId;
      translationTextarea.rows = 3;
      translationTextarea.value = String((item && item.translationText) || "");
      translationTextarea.placeholder = "답글 번역을 입력하세요.";
      translationTextarea.addEventListener("input", (event) => {
        if (
          !Array.isArray(state.replyParents) ||
          !state.replyParents[stateIndex]
        ) {
          return;
        }
        state.replyParents[stateIndex].translationText = event.target.value;
        renderPreview();
        notifyStateChange();
      });
      translationField.appendChild(translationLabel);
      translationField.appendChild(translationTextarea);
      editorItem.appendChild(translationField);

      elements.replyEditorList.appendChild(editorItem);
    });

    elements.replyEditorList.classList.remove("hidden");
  }

  function renderMediaSelectors() {
    if (elements.mainImageSelector) {
      elements.mainImageSelector.innerHTML = "";
      const selector = createMediaSelector(
        "메인 이미지 선택",
        state.imageDataUrls,
        (index, visible) => {
          const items = normalizeMediaItems(state.imageDataUrls);
          if (!items[index]) {
            return;
          }
          items[index].visible = visible;
          state.imageDataUrls = items;
          renderPreview();
          renderMediaSelectors();
          notifyStateChange();
        },
      );
      if (selector) {
        elements.mainImageSelector.appendChild(selector);
        elements.mainImageSelector.classList.remove("hidden");
      } else {
        elements.mainImageSelector.classList.add("hidden");
      }
    }

    if (elements.quoteImageSelector) {
      elements.quoteImageSelector.innerHTML = "";
      const selector = createMediaSelector(
        "리트윗 원문 이미지 선택",
        state.quoteDataUrls,
        (index, visible) => {
          const items = normalizeMediaItems(state.quoteDataUrls);
          if (!items[index]) {
            return;
          }
          items[index].visible = visible;
          state.quoteDataUrls = items;
          renderPreview();
          renderMediaSelectors();
          notifyStateChange();
        },
      );
      if (selector) {
        elements.quoteImageSelector.appendChild(selector);
        elements.quoteImageSelector.classList.remove("hidden");
      } else {
        elements.quoteImageSelector.classList.add("hidden");
      }
    }

    if (elements.replyImageSelectorList) {
      elements.replyImageSelectorList.innerHTML = "";
      const orderedReplies = getReplyParentsInDisplayOrder();
      orderedReplies.forEach(({ item, stateIndex }, orderIndex) => {
        const authorName = String((item && item.authorName) || "").trim();
        const authorHandle = normalizeHandle(item && item.authorHandle, "");
        const titleText =
          [authorName, authorHandle].filter(Boolean).join(" ") ||
          `답글 ${orderIndex + 1}`;
        const selector = createMediaSelector(
          `${titleText} 이미지 선택`,
          item && item.dataUrls,
          (index, visible) => {
            if (
              !Array.isArray(state.replyParents) ||
              !state.replyParents[stateIndex]
            ) {
              return;
            }
            const items = normalizeMediaItems(
              state.replyParents[stateIndex].dataUrls,
            );
            if (!items[index]) {
              return;
            }
            items[index].visible = visible;
            state.replyParents[stateIndex].dataUrls = items;
            renderPreview();
            renderMediaSelectors();
            notifyStateChange();
          },
        );
        if (selector) {
          elements.replyImageSelectorList.appendChild(selector);
        }
      });

      elements.replyImageSelectorList.classList.toggle(
        "hidden",
        !elements.replyImageSelectorList.childElementCount,
      );
    }
  }

  function applyStateToInputs() {
    elements.authorName.value = toDisplayText(state.authorName);
    elements.authorHandle.value = toDisplayText(state.authorHandle);
    elements.tweetDate.value = state.tweetDate;
    elements.tweetText.value = toDisplayText(state.tweetText);
    elements.translationText.value = toDisplayText(state.translationText);
    elements.replyCount.value = state.replyCount;
    elements.retweetCount.value = state.retweetCount;
    elements.likeCount.value = state.likeCount;
    elements.bookmarkCount.value = state.bookmarkCount;
    elements.mediaLayout.value = state.mediaLayout;
    elements.showReplyToggle.checked = Boolean(state.showReply);
    elements.showReplyMediaToggle.checked = Boolean(state.showReplyMedia);
    elements.showQuoteToggle.checked = Boolean(state.showQuote);
    elements.showQuoteMediaToggle.checked = Boolean(state.showQuoteMedia);
    elements.quoteMediaLayout.value = state.quoteMediaLayout;
    elements.quoteAuthorName.value = toDisplayText(state.quoteAuthorName);
    elements.quoteAuthorHandle.value = toDisplayText(state.quoteAuthorHandle);
    elements.quoteText.value = toDisplayText(state.quoteText);
    elements.stylePreset.value = normalizeStylePreset(state.stylePreset);
    elements.exportFormat.value = normalizeExportFormat(state.exportFormat);
    elements.exportScale.value = normalizeExportScale(state.exportScale);
    const hasQuoteEditorContent = Boolean(
      String(state.quoteAuthorName || "").trim() ||
      String(state.quoteAuthorHandle || "").trim() ||
      String(state.quoteText || "").trim() ||
      String(state.quoteAuthorProfileImageSrc || "").trim() ||
      normalizeMediaItems(state.quoteDataUrls).length,
    );
    elements.quoteEditor.classList.toggle("hidden", !hasQuoteEditorContent);
    renderReplyEditors();
    renderMediaSelectors();
  }

  function applyImageSource(imageElement, source) {
    const nextSource = String(source || "").trim();
    if (!nextSource) {
      imageElement.removeAttribute("src");
      return false;
    }

    const currentSource = String(imageElement.getAttribute("src") || "").trim();
    if (currentSource !== nextSource) {
      // Clear previous bitmap first to avoid stale frame capture while switching.
      imageElement.removeAttribute("src");
      imageElement.src = nextSource;
    }

    return true;
  }

  function renderReplyList() {
    if (!elements.previewReplyList) {
      return;
    }

    const showReply = Boolean(state.showReply);
    const showReplyMedia = Boolean(state.showReplyMedia);
    const replyItems = getReplyParentsInDisplayOrder();

    elements.previewReplyList.innerHTML = "";
    if (showReply && replyItems.length) {
      replyItems.forEach(({ item }) => {
        if (item && item.visible === false) {
          return;
        }

        const authorName = String((item && item.authorName) || "").trim();
        const authorHandle = normalizeHandle(item && item.authorHandle, "");
        const text = String((item && item.text) || "")
          .replace(/\r\n/g, "\n")
          .trim();
        const translation = String((item && item.translationText) || "")
          .replace(/\r\n/g, "\n")
          .trim();
        const media = getVisibleMediaSrcs(item && item.dataUrls);
        const hasMedia = showReplyMedia && media.length > 0;
        if (
          !authorName &&
          !authorHandle &&
          !text &&
          !translation &&
          !hasMedia
        ) {
          return;
        }

        elements.previewReplyList.appendChild(
          createReplyTweetCard(item, {
            showReplyMedia,
            mediaLayout: state.mediaLayout,
          }),
        );
      });
    }

    elements.previewReplyList.classList.toggle(
      "hidden",
      !elements.previewReplyList.childElementCount,
    );
  }

  function renderQuote() {
    if (
      !elements.previewQuote ||
      !elements.previewQuoteAvatar ||
      !elements.previewQuoteName ||
      !elements.previewQuoteHandle ||
      !elements.previewQuoteText ||
      !elements.previewQuoteMedia
    ) {
      return;
    }

    const quoteName = state.quoteAuthorName.trim();
    const quoteHandle = normalizeHandle(state.quoteAuthorHandle, "");
    const quoteAuthorProfileImageSrc = String(
      state.quoteAuthorProfileImageSrc || "",
    ).trim();
    const quoteText = String(state.quoteText || "")
      .replace(/\r\n/g, "\n")
      .trim();
    const quoteMedia = getVisibleMediaSrcs(state.quoteDataUrls);
    const showQuote = Boolean(state.showQuote);
    const showQuoteMedia = Boolean(state.showQuoteMedia);
    const hasQuoteText = Boolean(quoteName || quoteHandle || quoteText);
    const hasQuoteMedia = Boolean(quoteMedia.length);
    const quoteVisible =
      showQuote &&
      (hasQuoteText ||
        quoteAuthorProfileImageSrc ||
        (showQuoteMedia && hasQuoteMedia));

    elements.previewQuoteMedia.innerHTML = "";
    if (showQuoteMedia && quoteMedia.length) {
      populateTweetMedia(
        elements.previewQuoteMedia,
        quoteMedia,
        "인용 트윗 이미지",
        state.quoteMediaLayout,
      );
      Array.from(elements.previewQuoteMedia.querySelectorAll("img")).forEach(
        (image) => {
          image.className = "quote-image";
        },
      );
    } else {
      elements.previewQuoteMedia.classList.add("hidden");
      elements.previewQuoteMedia.removeAttribute("data-count");
    }

    if (quoteVisible) {
      if (quoteAuthorProfileImageSrc) {
        elements.previewQuoteAvatar.crossOrigin = "anonymous";
        elements.previewQuoteAvatar.referrerPolicy = "no-referrer";
        applyImageSource(
          elements.previewQuoteAvatar,
          quoteAuthorProfileImageSrc,
        );
        elements.previewQuoteAvatar.classList.remove("hidden");
      } else {
        elements.previewQuoteAvatar.removeAttribute("src");
        elements.previewQuoteAvatar.classList.add("hidden");
      }
      elements.previewQuoteName.textContent = toDisplayText(
        quoteName || "원문",
      );
      elements.previewQuoteHandle.textContent = toDisplayText(
        quoteHandle || "",
      );
      elements.previewQuoteText.textContent = toDisplayText(quoteText || "");
      elements.previewQuote.classList.remove("hidden");
      return;
    }

    elements.previewQuoteAvatar.removeAttribute("src");
    elements.previewQuoteAvatar.classList.add("hidden");
    elements.previewQuoteName.textContent = "";
    elements.previewQuoteHandle.textContent = "";
    elements.previewQuoteText.textContent = "";
    elements.previewQuote.classList.add("hidden");
  }

  function renderPreview() {
    elements.captureArea.dataset.stylePreset = normalizeStylePreset(
      state.stylePreset,
    );

    const trimmedName = state.authorName.trim() || "X User";
    const trimmedHandle = state.authorHandle.trim() || "@x";
    const handleWithPrefix = trimmedHandle.startsWith("@")
      ? trimmedHandle
      : `@${trimmedHandle}`;

    elements.previewName.textContent = toDisplayText(trimmedName);
    elements.previewHandle.textContent = toDisplayText(handleWithPrefix);
    elements.previewDate.textContent =
      state.tweetDate.trim() || currentDateTimeLabel();
    const rawText = String(state.tweetText || "").replace(/\r\n/g, "\n");
    elements.previewText.textContent = /\S/.test(rawText)
      ? toDisplayText(rawText)
      : "";

    if (elements.previewTranslation && elements.previewTranslationText) {
      const rawTranslation = String(state.translationText || "").replace(
        /\r\n/g,
        "\n",
      );
      if (/\S/.test(rawTranslation)) {
        elements.previewTranslationText.textContent =
          toDisplayText(rawTranslation);
        elements.previewTranslation.classList.remove("hidden");
      } else {
        elements.previewTranslationText.textContent = "";
        elements.previewTranslation.classList.add("hidden");
      }
    }

    elements.previewReplyCount.textContent = state.replyCount.trim() || "0";
    elements.previewRetweetCount.textContent = state.retweetCount.trim() || "0";
    elements.previewLikeCount.textContent = state.likeCount.trim() || "0";
    elements.previewBookmarkCount.textContent =
      state.bookmarkCount.trim() || "0";

    const initial = trimmedName.charAt(0).toUpperCase();
    elements.previewAvatarInitial.textContent = initial || "X";
    if (state.profileImageSrc) {
      elements.previewAvatarImage.crossOrigin = "anonymous";
      elements.previewAvatarImage.referrerPolicy = "no-referrer";
      applyImageSource(elements.previewAvatarImage, state.profileImageSrc);
      elements.previewAvatarImage.classList.remove("hidden");
      elements.previewAvatarInitial.classList.add("hidden");
    } else {
      elements.previewAvatarImage.removeAttribute("src");
      elements.previewAvatarImage.classList.add("hidden");
      elements.previewAvatarInitial.classList.remove("hidden");
    }

    renderReplyList();
    populateTweetMedia(
      elements.previewMedia,
      state.imageDataUrls,
      "트윗 첨부 이미지",
      state.mediaLayout,
    );
    renderQuote();

    const { sourceHost } = resolveSourceMeta(state.sourceUrl);
    elements.previewSource.textContent = sourceHost;

    const trimmedSourceUrl = String(state.sourceUrl || "").trim();
    if (trimmedSourceUrl) {
      elements.previewOriginalUrl.textContent = trimmedSourceUrl;
      elements.previewOriginalUrl.classList.remove("hidden");
    } else {
      elements.previewOriginalUrl.textContent = "";
      elements.previewOriginalUrl.classList.add("hidden");
    }
  }

  return {
    applyStateToInputs,
    renderPreview,
  };
}
