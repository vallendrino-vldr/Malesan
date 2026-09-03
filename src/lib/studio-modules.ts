export const STUDIO_MODULES = [
  "ide",
  "idea",
  "hook",
  "script",
  "repurpose",
  "clip",
  "thread",
  "video",
  "affiliate",
  "carousel",
  "lancar_bahasa",
  "auto_clip",
] as const;

export type StudioModule = (typeof STUDIO_MODULES)[number];

export function isStudioModule(value: string | undefined): value is StudioModule {
  return STUDIO_MODULES.includes(value as StudioModule);
}

export type ModuleManifest = {
  id: StudioModule;
  label: string;
  tagline: string;
  badge?: string;
  category: "ideation" | "scripting" | "repurpose" | "video" | "skills";
  costKey: string;
};

export const MODULE_CATALOG: readonly ModuleManifest[] = [
  { id: "ide", label: "Ide Hari Ini", tagline: "3 ide konten siap posting lengkap", category: "ideation", costKey: "ide" },
  { id: "idea", label: "Idea Engine", tagline: "Eksplorasi ide liar & sudut pandang unik", category: "ideation", costKey: "idea" },
  { id: "hook", label: "Hook Lab", tagline: "Pembuka video anti-skip 3 detik pertama", category: "scripting", costKey: "hook" },
  { id: "script", label: "Script Builder", tagline: "Naskah video lengkap siap baca", category: "scripting", costKey: "script" },
  { id: "repurpose", label: "Repurpose", tagline: "Ubah konten panjang jadi klip padat", category: "repurpose", costKey: "repurpose" },
  { id: "clip", label: "Clip Engine", tagline: "Ekstrak klip penting dari video panjang", category: "repurpose", costKey: "clip" },
  { id: "thread", label: "Thread Engine", tagline: "Utas X / Threads yang memikat", category: "scripting", costKey: "thread" },
  { id: "video", label: "Video Subtitle Auto-CC", tagline: "Subtitle otomatis sinkron per kata", category: "video", costKey: "video" },
  { id: "affiliate", label: "Affiliate Engine", tagline: "Naskah video racun belanja berkonversi", category: "scripting", costKey: "affiliate" },
  { id: "carousel", label: "Carousel Generator", tagline: "Slide Instagram & TikTok otomatis", category: "scripting", costKey: "carousel" },
  { id: "lancar_bahasa", label: "Lancar Inggris", tagline: "Speaking AI & roleplay native", badge: "AI Master", category: "skills", costKey: "lancar_bahasa" },
  { id: "auto_clip", label: "Auto Clip 1080p", tagline: "Pemotong YouTube Full HD native", category: "video", costKey: "video" },
];
