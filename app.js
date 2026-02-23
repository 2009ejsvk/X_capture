(function () {
  const elements = {
    tweetUrl: document.getElementById("tweetUrl"),
    fetchBtn: document.getElementById("fetchBtn"),
    statusText: document.getElementById("statusText"),
    authorName: document.getElementById("authorName"),
    authorHandle: document.getElementById("authorHandle"),
    tweetDate: document.getElementById("tweetDate"),
    tweetText: document.getElementById("tweetText"),
    imageInput: document.getElementById("imageInput"),
    mediaLayout: document.getElementById("mediaLayout"),
    removeImageBtn: document.getElementById("removeImageBtn"),
    sampleBtn: document.getElementById("sampleBtn"),
    captureBtn: document.getElementById("captureBtn"),
    captureArea: document.getElementById("captureArea"),
    previewAvatar: document.getElementById("previewAvatar"),
    previewAvatarImage: document.getElementById("previewAvatarImage"),
    previewAvatarInitial: document.getElementById("previewAvatarInitial"),
    previewName: document.getElementById("previewName"),
    previewHandle: document.getElementById("previewHandle"),
    previewDate: document.getElementById("previewDate"),
    previewText: document.getElementById("previewText"),
    previewMedia: document.getElementById("previewMedia"),
    previewSource: document.getElementById("previewSource"),
  };

  const state = {
    sourceUrl: "",
    authorName: "X User",
    authorHandle: "@x",
    tweetDate: new Date().toLocaleDateString("ko-KR"),
    tweetText: "캡처할 트윗 본문이 여기에 표시됩니다.",
    profileImageSrc: "",
    mediaLayout: "grid",
    imageDataUrls: [],
  };

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

  function parseHandle(authorUrl, fallbackName) {
    try {
      const path = new URL(authorUrl).pathname;
      const segment = path.split("/").filter(Boolean)[0];
      if (segment) {
        return segment.startsWith("@") ? segment : `@${segment}`;
      }
    } catch (error) {
      // Intentionally ignored.
    }

    if (!fallbackName) {
      return "@x";
    }

    const compact = fallbackName.replace(/\s+/g, "");
    return compact.startsWith("@") ? compact : `@${compact}`;
  }

  function parseOembedHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html || "", "text/html");
    const blockquote = doc.querySelector("blockquote.twitter-tweet");
    const textNode = blockquote ? blockquote.querySelector("p") : null;
    const text = textNode ? extractTextPreserveSpaces(textNode).replace(/\r\n/g, "\n") : "";

    const linkNodes = blockquote ? [...blockquote.querySelectorAll("a")] : [];
    const dateNode = linkNodes.length ? linkNodes[linkNodes.length - 1] : null;
    const dateLabel = dateNode ? dateNode.textContent.trim() : "";

    return { text, dateLabel };
  }

  function extractTextPreserveSpaces(node) {
    if (!node) {
      return "";
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue || "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    if (node.tagName === "BR") {
      return "\n";
    }

    let output = "";
    node.childNodes.forEach((child) => {
      output += extractTextPreserveSpaces(child);
    });
    return output;
  }

  function normalizeUrl(input) {
    const urlText = (input || "").trim();
    if (!urlText) {
      throw new Error("트윗 URL을 입력해 주세요.");
    }

    let url;
    try {
      url = new URL(urlText);
    } catch (error) {
      throw new Error("URL 형식이 올바르지 않습니다.");
    }

    const host = url.hostname.replace(/^www\./i, "");
    const isXHost = host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com";
    if (!isXHost) {
      throw new Error("x.com 또는 twitter.com URL만 지원합니다.");
    }

    const idMatch = url.pathname.match(/\/status\/(\d+)/i);
    if (!idMatch) {
      throw new Error("트윗 상세 URL(/status/숫자) 형식만 지원합니다.");
    }

    const tweetId = idMatch[1];
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const statusIndex = pathSegments.findIndex((segment) => segment.toLowerCase() === "status");
    const beforeStatus = statusIndex > 0 ? (pathSegments[statusIndex - 1] || "").toLowerCase() : "";
    const isUserPath = beforeStatus && beforeStatus !== "i" && beforeStatus !== "web";

    // /photo/1, /video/1, /i/web/status/... 같은 변형 링크를 정규화한다.
    const preferredUrl = isUserPath
      ? `https://x.com/${pathSegments[statusIndex - 1]}/status/${tweetId}`
      : `https://x.com/i/status/${tweetId}`;

    return {
      tweetId,
      preferredUrl,
      canonicalUrl: `https://x.com/i/status/${tweetId}`,
      twitterCanonicalUrl: `https://twitter.com/i/status/${tweetId}`,
    };
  }

  async function dataUrlFromRemoteImage(imageUrl) {
    if (!imageUrl) {
      return "";
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return "";
      }

      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("이미지 변환 실패"));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      return "";
    }
  }

  async function toDisplayImageSrc(imageUrl) {
    if (!imageUrl) {
      return "";
    }

    const dataUrl = await dataUrlFromRemoteImage(imageUrl);
    return dataUrl || imageUrl;
  }

  async function toDisplayImageSrcs(imageUrls) {
    const uniqueUrls = [...new Set((Array.isArray(imageUrls) ? imageUrls : [])
      .map((url) => String(url || "").trim())
      .filter(Boolean))].slice(0, 4);

    if (!uniqueUrls.length) {
      return [];
    }

    const converted = await Promise.all(uniqueUrls.map(toDisplayImageSrc));
    return converted.filter(Boolean);
  }

  async function fetchOembed(url) {
    const endpoint = `https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      const error = new Error(`oEmbed 오류 (${response.status})`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  async function fetchTweetFromOembed(info) {
    const urls = [info.preferredUrl, info.canonicalUrl, info.twitterCanonicalUrl];
    let lastError = null;

    for (const url of urls) {
      try {
        const payload = await fetchOembed(url);
        return { payload, usedUrl: url };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("oEmbed 호출에 실패했습니다.");
  }

  function formatDateLabel(rawDate) {
    if (!rawDate) {
      return new Date().toLocaleDateString("ko-KR");
    }

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      return String(rawDate);
    }

    return parsed.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function isImageLikeUrl(url) {
    const value = String(url || "");
    return (
      /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(value) ||
      /[?&]format=(jpg|jpeg|png|webp|gif)(&|$)/i.test(value)
    );
  }

  function pickVxImages(payload) {
    const images = [];
    let videoThumbnail = "";

    if (Array.isArray(payload.media_extended)) {
      for (const media of payload.media_extended) {
        if (!media) {
          continue;
        }

        if (media.type === "image" && (media.url || media.thumbnail_url)) {
          images.push(media.url || media.thumbnail_url);
          continue;
        }

        if (!videoThumbnail && (media.type === "video" || media.type === "gif") && media.thumbnail_url) {
          videoThumbnail = media.thumbnail_url;
        }
      }
    }

    if (!images.length && Array.isArray(payload.mediaURLs) && payload.mediaURLs.length) {
      const imageLikes = payload.mediaURLs.filter((url) => isImageLikeUrl(url));
      images.push(...imageLikes);
    }

    if (!images.length && videoThumbnail) {
      images.push(videoThumbnail);
    }

    return [...new Set(images.map((url) => String(url || "").trim()).filter(Boolean))].slice(0, 4);
  }

  async function fetchTweetFromVx(tweetId) {
    const endpoint = `https://api.vxtwitter.com/status/${tweetId}`;
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`보조 API 오류 (${response.status})`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error("보조 API 응답 파싱 실패");
    }

    if (!payload || !payload.tweetID) {
      throw new Error("보조 API에서 트윗을 찾지 못했습니다.");
    }

    const handle = payload.user_screen_name ? `@${String(payload.user_screen_name).replace(/^@/, "")}` : "@x";
    const profileImageUrl = String(payload.user_profile_image_url || "").trim();

    return {
      sourceUrl: payload.tweetURL || `https://x.com/i/status/${tweetId}`,
      authorName: (payload.user_name || "").trim() || "X User",
      authorHandle: handle,
      tweetDate: formatDateLabel(payload.date),
      tweetText: String(payload.text || "").replace(/\r\n/g, "\n"),
      profileImageUrl: profileImageUrl ? profileImageUrl.replace("_normal", "_400x400") : "",
      imageUrls: pickVxImages(payload),
    };
  }

  function formatOembedError(error) {
    if (error && typeof error === "object" && "status" in error) {
      const status = Number(error.status);
      if (status === 404) {
        return "oEmbed에서 트윗을 찾지 못했습니다.";
      }

      if (Number.isFinite(status)) {
        return `oEmbed 오류 (${status})`;
      }
    }

    return "oEmbed 네트워크 오류";
  }

  function applyStateToInputs() {
    elements.authorName.value = state.authorName;
    elements.authorHandle.value = state.authorHandle;
    elements.tweetDate.value = state.tweetDate;
    elements.tweetText.value = state.tweetText;
    elements.mediaLayout.value = state.mediaLayout;
  }

  function renderPreview() {
    const trimmedName = state.authorName.trim() || "X User";
    const trimmedHandle = state.authorHandle.trim() || "@x";
    const handleWithPrefix = trimmedHandle.startsWith("@") ? trimmedHandle : `@${trimmedHandle}`;

    elements.previewName.textContent = trimmedName;
    elements.previewHandle.textContent = handleWithPrefix;
    elements.previewDate.textContent = state.tweetDate.trim() || new Date().toLocaleDateString("ko-KR");
    const rawText = String(state.tweetText || "").replace(/\r\n/g, "\n");
    elements.previewText.textContent = /\S/.test(rawText) ? rawText : "(본문 없음)";
    const initial = trimmedName.charAt(0).toUpperCase();
    elements.previewAvatarInitial.textContent = initial || "X";
    if (state.profileImageSrc) {
      elements.previewAvatarImage.crossOrigin = "anonymous";
      elements.previewAvatarImage.referrerPolicy = "no-referrer";
      elements.previewAvatarImage.src = state.profileImageSrc;
      elements.previewAvatarImage.classList.remove("hidden");
      elements.previewAvatarInitial.classList.add("hidden");
    } else {
      elements.previewAvatarImage.removeAttribute("src");
      elements.previewAvatarImage.classList.add("hidden");
      elements.previewAvatarInitial.classList.remove("hidden");
    }

    elements.previewMedia.innerHTML = "";
    const mediaItems = Array.isArray(state.imageDataUrls) ? state.imageDataUrls.filter(Boolean).slice(0, 4) : [];
    if (mediaItems.length) {
      elements.previewMedia.dataset.count = String(mediaItems.length);
      elements.previewMedia.dataset.layout = mediaItems.length >= 2 ? state.mediaLayout : "single";
      elements.previewMedia.classList.remove("hidden");

      mediaItems.forEach((src, index) => {
        const image = document.createElement("img");
        image.className = "tweet-image";
        image.alt = `트윗 첨부 이미지 ${index + 1}`;
        image.loading = index === 0 ? "eager" : "lazy";
        image.referrerPolicy = "no-referrer";
        image.crossOrigin = "anonymous";
        image.src = src;
        elements.previewMedia.appendChild(image);
      });
    } else {
      elements.previewMedia.classList.add("hidden");
      elements.previewMedia.removeAttribute("data-count");
      elements.previewMedia.removeAttribute("data-layout");
    }

    if (state.sourceUrl) {
      try {
        const host = new URL(state.sourceUrl).host;
        elements.previewSource.textContent = host.replace(/^www\./i, "");
      } catch (error) {
        elements.previewSource.textContent = "x.com";
      }
    } else {
      elements.previewSource.textContent = "x.com";
    }
  }

  function syncFromEditors() {
    state.authorName = elements.authorName.value;
    state.authorHandle = elements.authorHandle.value;
    state.tweetDate = elements.tweetDate.value;
    state.tweetText = elements.tweetText.value;
    state.mediaLayout = elements.mediaLayout.value === "vertical" ? "vertical" : "grid";
    renderPreview();
  }

  async function onFetchClick() {
    try {
      elements.fetchBtn.disabled = true;
      setStatus("트윗 정보를 가져오는 중...");

      const normalized = normalizeUrl(elements.tweetUrl.value);
      let imageUrls = [];
      let profileImageUrl = "";
      let usedFallback = false;

      try {
        const result = await fetchTweetFromOembed(normalized);
        const payload = result.payload;
        const parsed = parseOembedHtml(payload.html);
        let vxText = "";

        state.sourceUrl = payload.url || result.usedUrl || normalized.canonicalUrl;
        state.authorName = (payload.author_name || "").trim() || "X User";
        state.authorHandle = parseHandle(payload.author_url || "", payload.author_name || "x");
        state.tweetDate = parsed.dateLabel || new Date().toLocaleDateString("ko-KR");
        state.tweetText = parsed.text || "본문을 가져오지 못했습니다. 직접 입력해 주세요.";
        imageUrls = payload.thumbnail_url ? [payload.thumbnail_url] : [];

        try {
          const vxMeta = await fetchTweetFromVx(normalized.tweetId);
          vxText = vxMeta.tweetText || "";
          if (vxText) {
            state.tweetText = vxText;
          }
          if (vxMeta.profileImageUrl) {
            profileImageUrl = vxMeta.profileImageUrl;
          }
          if (Array.isArray(vxMeta.imageUrls) && vxMeta.imageUrls.length) {
            imageUrls = vxMeta.imageUrls;
          }
        } catch (error) {
          // oEmbed 본문은 이미 가져왔으므로 이미지 보강 실패는 무시한다.
        }
      } catch (oembedError) {
        const fallback = await fetchTweetFromVx(normalized.tweetId);
        usedFallback = true;

        state.sourceUrl = fallback.sourceUrl || normalized.canonicalUrl;
        state.authorName = fallback.authorName;
        state.authorHandle = fallback.authorHandle;
        state.tweetDate = fallback.tweetDate;
        state.tweetText = fallback.tweetText;
        profileImageUrl = fallback.profileImageUrl || "";
        imageUrls = Array.isArray(fallback.imageUrls) ? fallback.imageUrls : [];
        setStatus(`${formatOembedError(oembedError)} 보조 경로로 불러왔습니다.`);
      }

      state.profileImageSrc = await toDisplayImageSrc(profileImageUrl);
      state.imageDataUrls = await toDisplayImageSrcs(imageUrls);

      applyStateToInputs();
      renderPreview();
      if (usedFallback) {
        setStatus("불러오기 완료(보조 경로). 필요하면 내용을 수정하고 저장하세요.", "success");
      } else {
        setStatus("불러오기 완료. 필요하면 내용을 수정하고 저장하세요.", "success");
      }
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
      const loaded = await Promise.all(files.map(readFileAsDataUrl));
      state.imageDataUrls = loaded.filter(Boolean);
      renderPreview();
      setStatus(`${state.imageDataUrls.length}장 이미지 반영 완료.`, "success");
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

  async function onCapture() {
    if (typeof html2canvas !== "function") {
      setStatus("캡처 라이브러리를 불러오지 못했습니다.", "error");
      return;
    }

    try {
      elements.captureBtn.disabled = true;
      setStatus("고해상도 이미지 생성 중...");

      const elementWidth = elements.captureArea.offsetWidth || 360;
      const deviceScale = window.devicePixelRatio || 1;
      const minExportWidth = 1440;
      const widthScale = minExportWidth / elementWidth;
      const scale = Math.min(Math.max(deviceScale, widthScale, 2), 5);

      const canvas = await html2canvas(elements.captureArea, {
        useCORS: true,
        allowTaint: false,
        scale,
        backgroundColor: null,
        imageTimeout: 15000,
      });

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error("이미지 생성 실패"));
          }
        }, "image/png");
      });

      const filename = `x-capture-${Date.now()}.png`;
      downloadBlob(blob, filename);
      setStatus("PNG 파일을 저장했습니다.", "success");
    } catch (error) {
      setStatus("이미지 저장에 실패했습니다.", "error");
    } finally {
      elements.captureBtn.disabled = false;
    }
  }

  function fillSample() {
    state.sourceUrl = "https://x.com/sample/status/1";
    state.authorName = "X Capture";
    state.authorHandle = "@xcapture";
    state.tweetDate = "2026년 2월 23일";
    state.tweetText =
      "모바일 웹에서 트윗 내용을 빠르게 카드로 만들어 PNG로 저장하는 샘플입니다.";
    state.profileImageSrc = "";
    state.mediaLayout = "grid";
    state.imageDataUrls = [];
    applyStateToInputs();
    renderPreview();
    setStatus("샘플 데이터를 채웠습니다.");
  }

  function wireEvents() {
    elements.fetchBtn.addEventListener("click", onFetchClick);
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
    elements.mediaLayout.addEventListener("change", syncFromEditors);
    elements.previewAvatarImage.addEventListener("error", () => {
      state.profileImageSrc = "";
      renderPreview();
    });
    elements.imageInput.addEventListener("change", onImageSelected);
    elements.removeImageBtn.addEventListener("click", onRemoveImage);
    elements.captureBtn.addEventListener("click", onCapture);
    elements.sampleBtn.addEventListener("click", fillSample);
  }

  wireEvents();
  fillSample();
})();
