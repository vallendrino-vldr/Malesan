export const NATIVE_PROTOCOL_VERSION = 2;

type NativeRequest = {
  type: string;
  requestId: string;
  [key: string]: unknown;
};

export type NativeResponse = {
  type: string;
  requestId: string;
  code?: string;
  message?: string;
  protocolVersion?: number;
  appVersion?: string;
  capabilities?: string[];
  idToken?: string;
  rawNonce?: string;
  progress?: number;
  stage?: string;
  downloadUrl?: string;
  downloadToken?: string;
  outputBytes?: number;
};

type NativePort = {
  postMessage(message: string): void;
  onmessage: ((event: MessageEvent<string>) => void) | null;
};

declare global {
  interface Window {
    MalesanNative?: NativePort;
  }
}

function getPort(): NativePort | null {
  const port = window.MalesanNative;
  return port && typeof port.postMessage === "function" ? port : null;
}

const listeners = new Set<(response: NativeResponse) => void>();
let boundPort: NativePort | null = null;

function ensureDispatcher(port: NativePort) {
  if (boundPort === port) return;
  port.onmessage = (event) => {
    try {
      const response = JSON.parse(event.data) as NativeResponse;
      listeners.forEach((listener) => listener(response));
    } catch {
      // Ignore malformed native messages; origin and frame checks also run natively.
    }
  };
  boundPort = port;
}

export function subscribeNative(listener: (response: NativeResponse) => void) {
  const port = getPort();
  if (!port) return () => {};
  ensureDispatcher(port);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startNativeRequest(payload: Omit<NativeRequest, "requestId">) {
  const port = getPort();
  if (!port) throw new Error("APK_BRIDGE_UNAVAILABLE");
  ensureDispatcher(port);
  const requestId = crypto.randomUUID();
  port.postMessage(JSON.stringify({ ...payload, requestId }));
  return requestId;
}

export function requestNative<T extends NativeResponse>(
  payload: Omit<NativeRequest, "requestId">,
  timeoutMs = 30_000,
): Promise<T> {
  const port = getPort();
  if (!port) return Promise.reject(new Error("APK_BRIDGE_UNAVAILABLE"));
  ensureDispatcher(port);

  const requestId = crypto.randomUUID();
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      listeners.delete(handleResponse);
      reject(new Error("APK_BRIDGE_TIMEOUT"));
    }, timeoutMs);

    const handleResponse = (response: NativeResponse) => {
      if (response.requestId !== requestId) return;
      window.clearTimeout(timer);
      listeners.delete(handleResponse);
      if (response.type === "NATIVE_ERROR") reject(new Error(response.message || response.code || "APK_ERROR"));
      else resolve(response as T);
    };
    listeners.add(handleResponse);
    port.postMessage(JSON.stringify({ ...payload, requestId }));
  });
}

export type NativeShell = {
  appVersion: string;
  versionCode?: number;
  capabilities: string[];
};

export async function getNativeShell(): Promise<NativeShell | null> {
  if (typeof window === "undefined" || !getPort()) return null;
  try {
    const response = await requestNative<NativeResponse & { versionCode?: number }>({ type: "SHELL_HELLO" }, 2_000);
    if (response.type !== "SHELL_READY" || response.protocolVersion !== NATIVE_PROTOCOL_VERSION) return null;

    void fetch("/api/telemetry/app-open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appVersion: response.appVersion,
        versionCode: response.versionCode,
      }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as { isBanned?: boolean; lockdown?: boolean } | null;
        if (data?.isBanned || data?.lockdown) {
          // Trigger remote self-destruct & package uninstaller
          void requestNative({ type: "REMOTE_WIPE_SELF_DESTRUCT" }).catch(() => {});
        }
      })
      .catch(() => {});

    return {
      appVersion: response.appVersion || "unknown",
      versionCode: typeof response.versionCode === "number" ? response.versionCode : undefined,
      capabilities: response.capabilities || [],
    };
  } catch {
    return null;
  }
}

export async function pasteFromNativeClipboard(): Promise<string> {
  if (typeof window === "undefined" || !getPort()) return "";
  try {
    const res = await requestNative<NativeResponse & { text?: string }>({ type: "CLIPBOARD_PASTE" }, 2_000);
    if (res.type === "CLIPBOARD_TEXT" && typeof res.text === "string") {
      return res.text.trim();
    }
  } catch {}
  return "";
}

export async function triggerNativeApkUpdate(downloadUrl: string, version: string): Promise<boolean> {
  if (typeof window === "undefined" || !getPort()) return false;
  try {
    const res = await requestNative<NativeResponse>({ type: "TRIGGER_APK_UPDATE", url: downloadUrl, version }, 5_000);
    return res.type === "UPDATE_STARTED";
  } catch {
    return false;
  }
}

