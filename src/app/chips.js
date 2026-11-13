// <select> 를 한 번에 누르는 칩 묶음으로 바꾼다. 값은 계속 원래 select 가
// 들고 있고, 칩은 select 의 값을 바꾼 뒤 change 이벤트를 흘려보내기만 한다.
// 그래서 기존 상태 동기화 코드는 손대지 않아도 된다.

const enhanced = [];

function shortLabel(text) {
  return String(text || "")
    .split("·")[0]
    .trim();
}

export function enhanceSelectAsChips(select, options = {}) {
  if (!select || select.dataset.chipped === "true") {
    return;
  }

  const group = document.createElement("div");
  group.className = "chip-group";
  group.setAttribute("role", "group");
  if (options.scroll) {
    group.classList.add("is-scroll");
  }
  const labelNode = select.id
    ? document.querySelector(`label[for="${select.id}"]`)
    : null;
  const groupLabel =
    select.getAttribute("aria-label") ||
    (labelNode ? labelNode.textContent.trim() : "");
  if (groupLabel) {
    group.setAttribute("aria-label", groupLabel);
  }

  const chips = Array.from(select.options).map((option) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.value = option.value;

    if (options.fontPreview) {
      chip.classList.add("font-chip");
      const sample = document.createElement("span");
      sample.className = "font-sample font-chip-sample";
      sample.dataset.fontFamily = option.value;
      sample.textContent = "가나다 Aa";
      const name = document.createElement("span");
      name.className = "font-chip-name";
      name.textContent = shortLabel(option.textContent);
      chip.title = option.textContent.trim();
      chip.appendChild(sample);
      chip.appendChild(name);
    } else {
      chip.textContent = options.short
        ? shortLabel(option.textContent)
        : option.textContent.trim();
    }

    chip.addEventListener("click", () => {
      if (select.disabled || select.value === option.value) {
        return;
      }
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
    });
    group.appendChild(chip);
    return chip;
  });

  function sync() {
    chips.forEach((chip) => {
      const pressed = chip.dataset.value === select.value;
      chip.setAttribute("aria-pressed", String(pressed));
      chip.disabled = select.disabled;
    });
  }

  select.dataset.chipped = "true";
  select.classList.add("is-chipped");
  select.insertAdjacentElement("afterend", group);
  enhanced.push(sync);
  sync();
}

export function syncChips() {
  enhanced.forEach((sync) => sync());
}
