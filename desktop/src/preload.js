const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("MalesanNative", {
  postMessage: (message) => {
    try {
      const parsed = typeof message === "string" ? JSON.parse(message) : message;
      ipcRenderer.send("malesan-native-request", parsed);
    } catch (err) {
      console.error("[Preload] Failed to dispatch native message:", err);
    }
  },
  onmessage: null,
});

ipcRenderer.on("malesan-native-response", (_event, payload) => {
  const messageStr = typeof payload === "string" ? payload : JSON.stringify(payload);
  if (window.MalesanNative && typeof window.MalesanNative.onmessage === "function") {
    try {
      window.MalesanNative.onmessage({ data: messageStr });
    } catch (err) {
      console.error("[Preload] Error in onmessage handler:", err);
    }
  }
});
