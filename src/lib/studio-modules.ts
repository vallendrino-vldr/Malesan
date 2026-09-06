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
  { id: "ide", label: "Ide Hari Ini", tagline: "3 ide segar siap posting", category: "ideation", costKey: "ide" },
  { id: "idea", label: "Eksplorasi Ide", tagline: "Ide liar jadi konsep matang", category: "ideation", costKey: "idea" },
  { id: "hook", label: "Lab Hook & Pembuka", tagline: "10 pembuka video anti-skip", category: "scripting", costKey: "hook" },
  { id: "script", label: "Naskah Video", tagline: "Script lengkap siap syuting", category: "scripting", costKey: "script" },
  { id: "repurpose", label: "Daur Ulang Konten", tagline: "Satu konten ke multi-platform", category: "repurpose", costKey: "repurpose" },
  { id: "clip", label: "Pemotong Klip", tagline: "Ekstrak klip viral otomatis", category: "repurpose", costKey: "clip" },
  { id: "thread", label: "Naskah Utas", tagline: "Utas memikat di X & Threads", category: "scripting", costKey: "thread" },
  { id: "video", label: "Subtitle Otomatis", tagline: "Auto caption per kata & BGM", category: "video", costKey: "video" },
  { id: "affiliate", label: "Naskah Jualan", tagline: "Racun belanja TikTok & Shopee", category: "scripting", costKey: "affiliate" },
  { id: "carousel", label: "Slide Karosel", tagline: "Ekspor gambar IG & TikTok", category: "scripting", costKey: "carousel" },
  { id: "lancar_bahasa", label: "Lancar Inggris", tagline: "Speaking AI native & roleplay", badge: "AI Master", category: "skills", costKey: "lancar_bahasa" },
  { id: "auto_clip", label: "Auto Clip YouTube", tagline: "Potong momen viral otomatis 9:16", badge: "AI Flagship", category: "video", costKey: "video" },
];
