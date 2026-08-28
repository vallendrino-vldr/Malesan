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
] as const;

export type StudioModule = (typeof STUDIO_MODULES)[number];

export function isStudioModule(value: string | undefined): value is StudioModule {
  return STUDIO_MODULES.includes(value as StudioModule);
}
