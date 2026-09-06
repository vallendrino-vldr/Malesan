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
    hero: {
      greetingPagi: string;
      greetingSiang: string;
      greetingSore: string;
      greetingMalam: string;
      greetingDemo: string;
      title: string;
      subtitle: string;
    };
    oneClick: {
      badge: string;
      title: string;
      desc: string;
      cta: string;
    };
    toolsHeader: {
      title: string;
      subtitle: string;
    };
    draft: {
      title: string;
      subtitle: string;
      badge: string;
    };
    autoClipBanner: {
      badge: string;
      title: string;
      desc: string;
      cta: string;
    };
    valueStrip: Array<{
      k: string;
      v: string;
    }>;
    modules: Record<
      string,
      {
        label: string;
        tagline: string;
        badge?: string;
      }
    >;
  };
  tutorial: {
    triggerChip: string;
    triggerGuide: string;
    title: string;
    heading: string;
  };
  refresh: {
    trigger: string;
    checking: string;
    updated: string;
    upToDate: string;
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
