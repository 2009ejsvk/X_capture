import { getVisibleMediaSrcs } from "../media.js?v=media20-20261114";

export function populateTweetMedia(container, mediaItems, altPrefix, layout) {
  container.innerHTML = "";
  const normalizedMedia = getVisibleMediaSrcs(mediaItems);

  if (!normalizedMedia.length) {
    container.classList.add("hidden");
    container.removeAttribute("data-count");
    container.removeAttribute("data-layout");
    container.removeAttribute("data-odd");
    return false;
  }

  container.dataset.count = String(normalizedMedia.length);
  container.dataset.layout = normalizedMedia.length >= 2 ? layout : "single";
  // 홀수 장을 나란히 놓으면 첫 장을 한 줄 전체로 써서 빈칸이 생기지 않게 한다.
  container.dataset.odd = String(normalizedMedia.length % 2 === 1);
  container.classList.remove("hidden");

  normalizedMedia.forEach((src, index) => {
    const image = document.createElement("img");
    image.className = "tweet-image";
    image.alt = `${altPrefix} ${index + 1}`;
    image.loading = index === 0 ? "eager" : "lazy";
    image.referrerPolicy = "no-referrer";
    image.crossOrigin = "anonymous";
    image.src = src;
    container.appendChild(image);
  });

  return true;
}
