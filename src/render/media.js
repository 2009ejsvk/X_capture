import { getVisibleMediaSrcs } from "../media.js";

export function populateTweetMedia(container, mediaItems, altPrefix, layout) {
  container.innerHTML = "";
  const normalizedMedia = getVisibleMediaSrcs(mediaItems);

  if (!normalizedMedia.length) {
    container.classList.add("hidden");
    container.removeAttribute("data-count");
    container.removeAttribute("data-layout");
    return false;
  }

  container.dataset.count = String(normalizedMedia.length);
  container.dataset.layout = normalizedMedia.length >= 2 ? layout : "single";
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
