const HOST = "com.malesan.bridge";
const ALLOWED = new Set([
  "https://malesan.my.id",
  "https://www.malesan.my.id",
  "http://localhost:3000",
]);

function handleBridgeMessage(message, origin, sendResponse) {
  if (origin && !ALLOWED.has(origin)) {
    sendResponse({ ok: false, error: "Permintaan Bridge ditolak." });
    return false;
  }
  if (!message) {
    sendResponse({ ok: false, error: "Pesan kosong." });
    return false;
  }
  if (message.type === "PING" || message.type === "MALESAN_BRIDGE_PING") {
    sendResponse({ ok: true, pong: true, version: "2.1.3" });
    return false;
  }
  if (message.type !== "MALESAN_AUTO_CLIP") {
    sendResponse({ ok: false, error: "Tipe pesan tidak didukung." });
    return false;
  }
  chrome.runtime.sendNativeMessage(HOST, message, (response) => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: "Malesan Native Host belum aktif. Jalankan INSTALL_MALESAN_BRIDGE.cmd." });
      return;
    }
    sendResponse(response ?? { ok: false, error: "Bridge gak memberi jawaban." });
  });
  return true;
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const origin = sender.url ? new URL(sender.url).origin : "";
  return handleBridgeMessage(message, origin, sendResponse);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const origin = sender.tab?.url ? new URL(sender.tab.url).origin : "";
  return handleBridgeMessage(message, origin, sendResponse);
});
