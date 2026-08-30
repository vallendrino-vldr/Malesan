// Malesan Bridge Content Script
// Bridges web app requests directly to extension background worker
try {
  document.documentElement.setAttribute("data-malesan-bridge", "ready");
  window.postMessage({ type: "MALESAN_BRIDGE_PONG", ok: true, version: "2.1.3" }, "*");
} catch {
  // Ignore
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || typeof event.data !== "object") return;

  if (event.data.type === "MALESAN_BRIDGE_PING") {
    window.postMessage({ type: "MALESAN_BRIDGE_PONG", ok: true, version: "2.1.3" }, "*");
  } else if (event.data.type === "MALESAN_AUTO_CLIP_REQUEST") {
    chrome.runtime.sendMessage(event.data.payload, (response) => {
      const err = chrome.runtime.lastError;
      window.postMessage({
        type: "MALESAN_AUTO_CLIP_RESPONSE",
        requestId: event.data.requestId,
        response: err ? { ok: false, error: err.message } : (response ?? { ok: false, error: "Tidak ada jawaban dari Bridge." })
      }, "*");
    });
  }
});
