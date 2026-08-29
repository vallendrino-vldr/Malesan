const HOST = "com.malesan.bridge";
const ALLOWED = new Set([
  "https://malesan.my.id",
  "https://www.malesan.my.id",
  "http://localhost:3000",
]);

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const origin = sender.url ? new URL(sender.url).origin : "";
  if (!ALLOWED.has(origin) || !message || message.type !== "MALESAN_AUTO_CLIP") {
    sendResponse({ ok: false, error: "Permintaan Bridge ditolak." });
    return false;
  }
  chrome.runtime.sendNativeMessage(HOST, message, (response) => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: "Malesan Bridge belum aktif." });
      return;
    }
    sendResponse(response ?? { ok: false, error: "Bridge gak memberi jawaban." });
  });
  return true;
});
