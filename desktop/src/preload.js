const { contextBridge, ipcRenderer } = require("electron");

let onMessageHandler = null;

// Expose MalesanNative API to the window object
contextBridge.exposeInMainWorld("MalesanNative", {
  postMessage: (message) => {
    try {
      const parsed = typeof message === "string" ? JSON.parse(message) : message;
      ipcRenderer.send("malesan-native-request", parsed);
    } catch (err) {
      console.error("[Preload] Failed to dispatch native message:", err);
    }
  },
  set onmessage(fn) {
    onMessageHandler = fn;
  },
  get onmessage() {
    return onMessageHandler;
  },
});

// Listen to responses from Electron main process
ipcRenderer.on("malesan-native-response", (_event, payload) => {
  const messageStr = typeof payload === "string" ? payload : JSON.stringify(payload);

  if (typeof onMessageHandler === "function") {
    try {
      onMessageHandler({ data: messageStr });
    } catch (err) {
      console.error("[Preload] Error in onmessage handler:", err);
    }
  }

  // Also broadcast via window.postMessage for maximum compatibility
  window.postMessage({ __malesan_native_message__: true, data: messageStr }, "*");
});
