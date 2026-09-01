/**
 * Centralized single-source-of-truth metadata for Malesan Android APK.
 * Keeps app shell, download modals, update notifications, and telemetry strictly in sync.
 */

export const LATEST_APK_VERSION = "2.2.5";
export const LATEST_APK_VERSION_CODE = 28;
export const LATEST_APK_SIZE_MB = "57.9 MB";
export const LATEST_APK_DISPLAY_SIZE = "58 MB";
export const LATEST_ARM32_SIZE = "51 MB";
export const LATEST_APK_DOWNLOAD_URL = "https://www.malesan.my.id/malesan.apk";
export const LATEST_ARM32_DOWNLOAD_URL = "https://www.malesan.my.id/malesan-arm32.apk";

export const LATEST_APK_CHANGELOG = [
  "Pembaruan instan 1-klik langsung dari dalam aplikasi tanpa ribet",
  "Notifikasi pembaruan di status bar HP saat ada versi baru",
  "Akselerasi hardware 60fps & filter Studio Ultra-HD super tajam",
  "Koreksi akurasi ukuran unduhan (58 MB)",
];

export interface ApkUpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  latestVersionCode: number;
  currentVersion?: string;
  currentVersionCode?: number;
  sizeMB: string;
  displaySize: string;
  downloadUrl: string;
  changelog: string[];
}

/**
 * Compare client installed version against latest registry version.
 */
export function checkApkUpdate(
  currentVersionCode?: number | null,
  currentVersionName?: string | null,
): ApkUpdateInfo {
  let hasUpdate = false;

  if (typeof currentVersionCode === "number" && currentVersionCode > 0) {
    hasUpdate = currentVersionCode < LATEST_APK_VERSION_CODE;
  } else if (currentVersionName && typeof currentVersionName === "string") {
    const curParts = currentVersionName.split(".").map((n) => parseInt(n, 10) || 0);
    const latestParts = LATEST_APK_VERSION.split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(curParts.length, latestParts.length); i++) {
      const cur = curParts[i] || 0;
      const lat = latestParts[i] || 0;
      if (lat > cur) {
        hasUpdate = true;
        break;
      }
      if (lat < cur) break;
    }
  }

  return {
    hasUpdate,
    latestVersion: LATEST_APK_VERSION,
    latestVersionCode: LATEST_APK_VERSION_CODE,
    currentVersion: currentVersionName || undefined,
    currentVersionCode: currentVersionCode || undefined,
    sizeMB: LATEST_APK_SIZE_MB,
    displaySize: LATEST_APK_DISPLAY_SIZE,
    downloadUrl: LATEST_APK_DOWNLOAD_URL,
    changelog: LATEST_APK_CHANGELOG,
  };
}
