export function createTweetActionItem(iconPath, value) {
  const actionItem = document.createElement("div");
  actionItem.className = "tweet-action-item";

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("class", "tweet-action-icon");

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", iconPath);
  group.appendChild(path);
  icon.appendChild(group);

  const text = document.createElement("span");
  text.textContent = String(value || "0").trim() || "0";

  actionItem.appendChild(icon);
  actionItem.appendChild(text);
  return actionItem;
}
