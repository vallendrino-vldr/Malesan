"use client";

import type { Word, CaptionStyle } from "@/lib/video/captions";
import type { VideoLayout } from "@/lib/video/layout";
import type { ManualKeyframe } from "@/lib/video/keyframe-engine";

export type VideoProject = {
  id: string;
  title: string;
  durationSec: number;
  thumbnailUrl?: string;
  videoBlob?: Blob;
  words: Word[];
  style: CaptionStyle;
  presetId: string;
  layout: VideoLayout;
  manualKeyframes?: ManualKeyframe[];
  framingMode: "auto_ai" | "podcast_split" | "manual_keyframe" | "preset_left" | "preset_center" | "preset_right";
  createdAt: number;
  updatedAt: number;
};

const DB_NAME = "malesan_video_studio";
const DB_VERSION = 1;
const STORE_NAME = "projects";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB tidak didukung di browser ini."));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVideoProject(project: Omit<VideoProject, "updatedAt"> & { updatedAt?: number }): Promise<VideoProject> {
  const db = await openDB();
  const fullProject: VideoProject = {
    ...project,
    updatedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(fullProject);
    req.onsuccess = () => resolve(fullProject);
    req.onerror = () => reject(req.error);
  });
}

export async function listVideoProjects(): Promise<VideoProject[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("updatedAt");
      const results: VideoProject[] = [];
      const req = index.openCursor(null, "prev");
      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const val = cursor.value as VideoProject;
          // Strip heavy videoBlob from list view to keep modal snappy
          const summary = { ...val };
          delete summary.videoBlob;
          results.push(summary as VideoProject);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function getVideoProject(id: string): Promise<VideoProject | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as VideoProject) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteVideoProject(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

export async function clearAllVideoProjects(): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}
