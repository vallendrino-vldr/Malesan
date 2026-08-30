const HOST = "com.malesan.bridge";
const ALLOWED = new Set([
  "https://malesan.my.id",
  "https://www.malesan.my.id",
  "http://localhost:3000",
]);

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const origin = sender.url ? new URL(sender.url).origin : "";
  if (!ALLOWED.has(origin) || !message) {
    sendResponse({ ok: false, error: "Permintaan Bridge ditolak." });
    return false;
  }
  if (message.type === "PING") {
    sendResponse({ ok: true, pong: true, version: "2.1.3" });
    return false;
  }
  if (message.type !== "MALESAN_AUTO_CLIP") {
    sendResponse({ ok: false, error: "Tipe pesan tidak didukung." });
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
