function createTimeoutError(timeoutMs) {
  return new Error(`요청 시간이 초과되었습니다. (${timeoutMs}ms)`);
}

export async function fetchWithTimeout(resource, options = {}) {
  const { timeoutMs = 10000, signal, ...fetchOptions } = options;
  const controller = new AbortController();
  let timeoutId = 0;

  const abort = (reason) => {
    if (!controller.signal.aborted) {
      controller.abort(reason);
    }
  };

  const onAbort = () => {
    abort(signal.reason);
  };

  if (signal) {
    if (signal.aborted) {
      abort(signal.reason);
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutId = globalThis.setTimeout(() => {
      abort(createTimeoutError(timeoutMs));
    }, timeoutMs);
  }

  try {
    return await fetch(resource, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } finally {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}
