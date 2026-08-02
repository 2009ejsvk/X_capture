import {
  currentDateTimeLabel,
  normalizeHandle,
  stripLeadingReplyMentions,
  toDisplayText,
} from "./utils.js?v=reply-thread-v2-20260802";
import {
  isGameCaptureFontFamily,
  normalizeCaptureGameFontScope,
  normalizeCaptureFontFamily,
  normalizeCaptureFontSize,
  normalizeCaptureOutlineColor,
  normalizeCaptureOutlineWidth,
  normalizeExportFormat,
  normalizeExportScale,
  normalizeStylePreset,
} from "./domain/capture-settings.js?v=default-suit-xlarge-20260802";
import { getVisibleMediaSrcs, normalizeMediaItems } from "./media.js";
import {
  formatQuoteText,
  normalizeQuoteTextMode,
} from "./domain/tweet-model.js";
import { createMediaSelector } from "./render/media-selector.js";
import { populateTweetMedia } from "./render/media.js";
import { createReplyTweetCard } from "./render/reply-card.js?v=reply-thread-v2-20260802";
import { resolveSourceMeta } from "./render/source-meta.js";
import { renderTextWithLinks } from "./render/text.js";

export function createRenderer(elements, state, options = {}) {
  function readImageFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });
  }

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
      const editorItem = document.createElement("section");
      editorItem.className = "reply-editor-item thread-editor-card";

      const header = document.createElement("header");
      header.className = "reply-editor-header";

      const sequence = document.createElement("span");
      sequence.className = "thread-editor-sequence";
      sequence.textContent = String(orderIndex + 1);

      const title = document.createElement("p");
      title.className = "reply-editor-title";
      const updateTitle = () => {
        const currentItem = state.replyParents[stateIndex] || item;
        const authorName = String(currentItem.authorName || "").trim();
        const authorHandle = normalizeHandle(currentItem.authorHandle, "");
        title.textContent = toDisplayText(
          [authorName, authorHandle].filter(Boolean).join(" ") ||
            `이전 글 ${orderIndex + 1}`,
        );
      };
      updateTitle();

      const visibilityRow = document.createElement("label");
      visibilityRow.className = "check-option reply-visibility-option";
      const visibilityToggle = document.createElement("input");
      visibilityToggle.type = "checkbox";
      visibilityToggle.checked = item.visible !== false;
      visibilityToggle.addEventListener("change", (event) => {
        if (!state.replyParents[stateIndex]) {
          return;
        }
        state.replyParents[stateIndex].visible = Boolean(event.target.checked);
        renderPreview();
        notifyStateChange();
      });
      const visibilityText = document.createElement("span");
      visibilityText.textContent = "표시";
      visibilityRow.appendChild(visibilityToggle);
      visibilityRow.appendChild(visibilityText);

      header.appendChild(sequence);
      header.appendChild(title);
      header.appendChild(visibilityRow);
      editorItem.appendChild(header);

      const fields = document.createElement("div");
      fields.className = "editor-grid reply-editor-grid";

      const appendField = (property, labelText, fieldOptions = {}) => {
        const group = document.createElement("div");
        group.className = "field-group";
        if (fieldOptions.full) {
          group.classList.add("field-span-full");
        }

        const inputId = `reply-${property}-${stateIndex}`;
        const label = document.createElement("label");
        label.htmlFor = inputId;
        label.textContent = labelText;

        let input;
        if (fieldOptions.type === "textarea") {
          input = document.createElement("textarea");
          input.rows = fieldOptions.rows || 4;
          input.placeholder = fieldOptions.placeholder || "";
        } else if (fieldOptions.type === "select") {
          input = document.createElement("select");
          fieldOptions.options.forEach(({ value, text }) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = text;
            input.appendChild(option);
          });
        } else {
          input = document.createElement("input");
          input.type = "text";
          if (fieldOptions.inputMode) {
            input.inputMode = fieldOptions.inputMode;
          }
          if (fieldOptions.maxLength) {
            input.maxLength = fieldOptions.maxLength;
          }
        }

        input.id = inputId;
        input.value = String(item[property] || "");
        input.addEventListener(
          fieldOptions.type === "select" ? "change" : "input",
          (event) => {
            if (!state.replyParents[stateIndex]) {
              return;
            }
            state.replyParents[stateIndex][property] = event.target.value;
            if (property === "authorName" || property === "authorHandle") {
              updateTitle();
            }
            renderPreview();
            notifyStateChange();
          },
        );

        group.appendChild(label);
        group.appendChild(input);
        fields.appendChild(group);
      };

      appendField("authorName", "작성자명", { maxLength: 40 });
      appendField("authorHandle", "핸들", { maxLength: 40 });
      appendField("tweetDate", "날짜", { full: true, maxLength: 40 });
      appendField("text", "본문", {
        type: "textarea",
        rows: 5,
        full: true,
        placeholder: "본문을 입력하세요.",
      });
      appendField("translationText", "번역", {
        type: "textarea",
        rows: 4,
        full: true,
        placeholder: "번역 내용을 입력하세요.",
      });

      const metrics = document.createElement("div");
      metrics.className = "metrics-grid field-span-full reply-metrics-grid";
      [
        ["replyCount", "댓글"],
        ["retweetCount", "리트윗"],
        ["likeCount", "좋아요"],
        ["bookmarkCount", "북마크"],
      ].forEach(([property, labelText]) => {
        const group = document.createElement("div");
        group.className = "field-group";
        const inputId = `reply-${property}-${stateIndex}`;
        const label = document.createElement("label");
        label.htmlFor = inputId;
        label.textContent = labelText;
        const input = document.createElement("input");
        input.id = inputId;
        input.type = "text";
        input.inputMode = "numeric";
        input.maxLength = 20;
        input.value = String(item[property] || "0");
        input.addEventListener("input", (event) => {
          if (!state.replyParents[stateIndex]) {
            return;
          }
          state.replyParents[stateIndex][property] = event.target.value;
          renderPreview();
          notifyStateChange();
        });
        group.appendChild(label);
        group.appendChild(input);
        metrics.appendChild(group);
      });
      fields.appendChild(metrics);

      appendField("mediaLayout", "이미지 배치", {
        type: "select",
        full: true,
        options: [
          { value: "vertical", text: "세로" },
          { value: "grid", text: "나란히" },
        ],
      });
      editorItem.appendChild(fields);

      const mediaEdit = document.createElement("div");
      mediaEdit.className = "field-group reply-media-edit";
      const mediaInputId = `reply-image-input-${stateIndex}`;
      const mediaLabel = document.createElement("label");
      mediaLabel.htmlFor = mediaInputId;
      mediaLabel.textContent = "이미지 수정 · 추가";

      const mediaRow = document.createElement("div");
      mediaRow.className = "image-row";
      const mediaInput = document.createElement("input");
      mediaInput.id = mediaInputId;
      mediaInput.type = "file";
      mediaInput.accept = "image/*";
      mediaInput.multiple = true;
      mediaInput.addEventListener("change", async (event) => {
        if (!state.replyParents[stateIndex]) {
          return;
        }
        const currentItems = normalizeMediaItems(
          state.replyParents[stateIndex].dataUrls,
        );
        const remainingSlots = Math.max(4 - currentItems.length, 0);
        const files = Array.from(event.target.files || []).slice(
          0,
          remainingSlots,
        );
        event.target.value = "";
        if (!files.length) {
          return;
        }

        try {
          const loaded = await Promise.all(
            files.map((file) => readImageFileAsDataUrl(file)),
          );
          if (!state.replyParents[stateIndex]) {
            return;
          }
          state.replyParents[stateIndex].dataUrls = normalizeMediaItems([
            ...currentItems,
            ...loaded.filter(Boolean),
          ]);
          renderPreview();
          renderReplyEditors();
          notifyStateChange();
        } catch (error) {
          mediaInput.setCustomValidity("이미지를 읽지 못했습니다.");
          mediaInput.reportValidity();
          mediaInput.setCustomValidity("");
        }
      });

      const removeMediaButton = document.createElement("button");
      removeMediaButton.className = "btn btn-ghost reply-media-remove";
      removeMediaButton.type = "button";
      removeMediaButton.textContent = "전체 삭제";
      removeMediaButton.disabled = !normalizeMediaItems(item.dataUrls).length;
      removeMediaButton.addEventListener("click", () => {
        if (!state.replyParents[stateIndex]) {
          return;
        }
        state.replyParents[stateIndex].dataUrls = [];
        renderPreview();
        renderReplyEditors();
        notifyStateChange();
      });

      mediaRow.appendChild(mediaInput);
      mediaRow.appendChild(removeMediaButton);
      mediaEdit.appendChild(mediaLabel);
      mediaEdit.appendChild(mediaRow);
      const mediaHint = document.createElement("small");
      mediaHint.className = "reply-media-hint";
      mediaHint.textContent =
        "이미지가 없어도 추가할 수 있으며 최대 4장까지 가능합니다.";
      mediaEdit.appendChild(mediaHint);
      editorItem.appendChild(mediaEdit);

      const mediaSelector = createMediaSelector(
        `${title.textContent} 이미지 선택`,
        item.dataUrls,
        (index, visible) => {
          if (!state.replyParents[stateIndex]) {
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
          notifyStateChange();
        },
      );
      if (mediaSelector) {
        mediaSelector.classList.add("reply-inline-media");
        editorItem.appendChild(mediaSelector);
      }

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
  }

  function applyStateToInputs() {
    const hasReplyThread = Boolean(
      Array.isArray(state.replyParents) && state.replyParents.length,
    );
    if (
      elements.editorStack &&
      elements.mainEditorSection &&
      elements.replyEditorSection
    ) {
      if (hasReplyThread) {
        elements.editorStack.insertBefore(
          elements.replyEditorSection,
          elements.mainEditorSection,
        );
      } else if (elements.mediaEditorSection) {
        elements.editorStack.insertBefore(
          elements.mainEditorSection,
          elements.mediaEditorSection,
        );
        if (elements.quoteEditorSection) {
          elements.editorStack.insertBefore(
            elements.replyEditorSection,
            elements.quoteEditorSection,
          );
        }
      }
    }
    if (elements.mainEditorTitle) {
      elements.mainEditorTitle.textContent = hasReplyThread
        ? `${state.replyParents.length + 1}. 마지막 답글`
        : "기본 정보";
    }
    if (elements.mainEditorSummary) {
      elements.mainEditorSummary.textContent = hasReplyThread
        ? "대화의 마지막 글 · 본문 · 반응 수"
        : "작성자 · 본문 · 반응 수";
    }

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
    elements.quoteTextMode.value = normalizeQuoteTextMode(state.quoteTextMode);
    elements.quoteMediaLayout.value = state.quoteMediaLayout;
    elements.quoteAuthorName.value = toDisplayText(state.quoteAuthorName);
    elements.quoteAuthorHandle.value = toDisplayText(state.quoteAuthorHandle);
    elements.quoteText.value = toDisplayText(state.quoteText);
    elements.stylePreset.value = normalizeStylePreset(state.stylePreset);
    elements.captureFontSize.value = normalizeCaptureFontSize(
      state.captureFontSize,
    );
    elements.captureFontFamily.value = normalizeCaptureFontFamily(
      state.captureFontFamily,
    );
    elements.captureGameFontScope.value = normalizeCaptureGameFontScope(
      state.captureGameFontScope,
    );
    elements.captureOutlineWidth.value = normalizeCaptureOutlineWidth(
      state.captureOutlineWidth,
    );
    elements.captureOutlineColor.value = normalizeCaptureOutlineColor(
      state.captureOutlineColor,
    );
    elements.captureTextShadow.checked = state.captureTextShadow === true;
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
    if (normalizeMediaItems(state.imageDataUrls).length) {
      elements.mediaEditorSection.open = true;
    }
    if (Array.isArray(state.replyParents) && state.replyParents.length) {
      elements.replyEditorSection.open = true;
    }
    if (hasQuoteEditorContent) {
      elements.quoteEditorSection.open = true;
    }
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

        const text = String((item && item.text) || "")
          .replace(/\r\n/g, "\n")
          .trim();
        const translation = String((item && item.translationText) || "")
          .replace(/\r\n/g, "\n")
          .trim();
        const media = getVisibleMediaSrcs(item && item.dataUrls);
        const hasMedia = showReplyMedia && media.length > 0;
        if (!text && !translation && !hasMedia) {
          return;
        }

        elements.previewReplyList.appendChild(
          createReplyTweetCard(item, {
            showReplyMedia,
            mediaLayout: item.mediaLayout === "grid" ? "grid" : "vertical",
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
      renderTextWithLinks(
        elements.previewQuoteText,
        formatQuoteText(quoteText, state.quoteTextMode),
      );
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
    elements.captureArea.dataset.fontSize = normalizeCaptureFontSize(
      state.captureFontSize,
    );
    const captureFontFamily = normalizeCaptureFontFamily(
      state.captureFontFamily,
    );
    const usesGameFont = isGameCaptureFontFamily(captureFontFamily);
    const captureFontScope = usesGameFont
      ? normalizeCaptureGameFontScope(state.captureGameFontScope)
      : "all";
    elements.captureArea.dataset.fontFamily = captureFontFamily;
    elements.captureArea.dataset.fontScope = captureFontScope;
    elements.captureArea.dataset.textShadow =
      state.captureTextShadow === true ? "on" : "off";
    elements.captureArea.style.setProperty(
      "--capture-outline-width",
      `${normalizeCaptureOutlineWidth(state.captureOutlineWidth)}px`,
    );
    elements.captureArea.style.setProperty(
      "--capture-outline-color",
      normalizeCaptureOutlineColor(state.captureOutlineColor),
    );
    if (elements.captureFontSample) {
      elements.captureFontSample.dataset.fontFamily = captureFontFamily;
    }
    elements.captureGameFontScope.disabled = !usesGameFont;

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
    const displayText =
      Array.isArray(state.replyParents) && state.replyParents.length
        ? stripLeadingReplyMentions(rawText)
        : rawText;
    renderTextWithLinks(
      elements.previewText,
      /\S/.test(displayText) ? toDisplayText(displayText) : "",
    );

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
