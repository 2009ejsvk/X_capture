import { normalizeMediaItems } from "../media.js";

export function createMediaSelector(
  titleText,
  mediaItems,
  onToggle,
  actions = {},
) {
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

  const createIconButton = (label, symbol, disabled, handler) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-ghost media-selector-action";
    button.textContent = symbol;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.disabled = disabled;
    button.addEventListener("click", handler);
    return button;
  };

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

    if (actions.onMove || actions.onRemove) {
      const actionRow = document.createElement("div");
      actionRow.className = "media-selector-actions";

      if (actions.onMove) {
        actionRow.appendChild(
          createIconButton("앞으로 이동", "←", index === 0, () => {
            actions.onMove(index, index - 1);
          }),
        );
        actionRow.appendChild(
          createIconButton(
            "뒤로 이동",
            "→",
            index === normalizedMedia.length - 1,
            () => {
              actions.onMove(index, index + 1);
            },
          ),
        );
      }

      if (actions.onRemove) {
        actionRow.appendChild(
          createIconButton("이 이미지 삭제", "✕", false, () => {
            actions.onRemove(index);
          }),
        );
      }

      entry.appendChild(actionRow);
    }

    grid.appendChild(entry);
  });

  wrapper.appendChild(grid);
  return wrapper;
}
