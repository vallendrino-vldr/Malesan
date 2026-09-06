export type Language = "id" | "en";

export type TranslationDictionary = {
  header: {
    searchPlaceholder: string;
    downloadApp: string;
    appShort: string;
    androidNative: string;
    desktopStudio: string;
    updateStudio: string;
    updateApp: string;
    tutorial: string;
    refresh: string;
    admin: string;
    credits: string;
    profile: string;
    switchLang: string;
  };
  tabs: {
    studio: string;
    vibe: string;
    pipeline: string;
    profil: string;
  };
  studio: {
    heroTitle: string;
    heroSubtitle: string;
    allModules: string;
    categoryIdeation: string;
    categoryScripting: string;
    categoryRepurpose: string;
    categoryVideo: string;
    categorySkills: string;
    modules: Record<
      string,
      {
        label: string;
        tagline: string;
        badge?: string;
      }
    >;
  };
  actions: {
    generate: string;
    generating: string;
    copy: string;
    copied: string;
    save: string;
    saved: string;
    export: string;
    exporting: string;
    close: string;
    cancel: string;
    retry: string;
    listen: string;
    stop: string;
    download: string;
    backToStudio: string;
  };
};
