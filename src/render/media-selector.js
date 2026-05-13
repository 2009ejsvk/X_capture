import { normalizeMediaItems } from "../media.js";

export function createMediaSelector(titleText, mediaItems, onToggle) {
  const normalizedMedia = normalizeMediaItems(mediaItems);
  if (!normalizedMedia.length) {
    return null;
  }

  const wrapper = document.createElement("section");
  wrapper.className = "reply-editor-item";

  const title = document.createElement("p");
  title.className = "reply-editor-title";
  title.textContent = titleText;
  wrapper.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "media-selector-grid";

  normalizedMedia.forEach((item, index) => {
    const entry = document.createElement("div");
    entry.className = "media-selector-item";

    const thumb = document.createElement("img");
    thumb.className = "media-selector-thumb";
    thumb.alt = `${titleText} ${index + 1}`;
    thumb.loading = "lazy";
    thumb.referrerPolicy = "no-referrer";
    thumb.crossOrigin = "anonymous";
    thumb.src = item.src;

    const label = document.createElement("label");
    label.className = "media-selector-check";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.visible !== false;
    checkbox.addEventListener("change", (event) => {
      onToggle(index, Boolean(event.target.checked));
    });

    const text = document.createElement("span");
    text.textContent = `이미지 ${index + 1}`;

    label.appendChild(checkbox);
    label.appendChild(text);
    entry.appendChild(thumb);
    entry.appendChild(label);
    grid.appendChild(entry);
  });

  wrapper.appendChild(grid);
  return wrapper;
}
