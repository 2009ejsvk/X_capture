(function () {
  const xTab = document.getElementById("xModeTab");
  const threadsTab = document.getElementById("threadsModeTab");
  const xView = document.getElementById("xModeView");
  const threadsView = document.getElementById("threadModeView");

  if (!xTab || !threadsTab || !xView || !threadsView) {
    return;
  }

  const tabs = {
    x: xTab,
    threads: threadsTab,
  };

  const views = {
    x: xView,
    threads: threadsView,
  };

  function resolveMode() {
    const hash = String(window.location.hash || "").replace(/^#/, "").toLowerCase();
    return hash === "threads" ? "threads" : "x";
  }

  function applyMode(mode, updateHash) {
    const nextMode = mode === "threads" ? "threads" : "x";

    Object.entries(tabs).forEach(([key, tab]) => {
      const active = key === nextMode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.setAttribute("tabindex", active ? "0" : "-1");
    });

    Object.entries(views).forEach(([key, view]) => {
      view.classList.toggle("hidden", key !== nextMode);
    });

    document.body.dataset.captureMode = nextMode;

    if (updateHash) {
      const nextHash = nextMode === "threads" ? "#threads" : "#x";
      if (window.location.hash !== nextHash) {
        history.replaceState(null, "", nextHash);
      }
    }
  }

  xTab.addEventListener("click", () => applyMode("x", true));
  threadsTab.addEventListener("click", () => applyMode("threads", true));
  window.addEventListener("hashchange", () => applyMode(resolveMode(), false));

  applyMode(resolveMode(), false);
})();
