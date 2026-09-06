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
  vibe: {
    hubTitle: string;
    hubDesc: string;
    modeLearn: string;
    modeVibe: string;
    streakSuffix: string;
    totalXp: string;
    glossaryBtn: string;
    questProgress: string;
    completed: string;
    mainMission: string;
    startMission: string;
    replayMission: string;
    levelLocked: string;
    levelList: string;
    start: string;
    replay: string;
    locked: string;
    backToRoadmap: string;
    step1Tab: string;
    step2Tab: string;
    step3Tab: string;
    realWorldAnalogy: string;
    analogyTip: string;
    codeAnatomy: string;
    proTip: string;
    continueToSandbox: string;
    sandboxTitle: string;
    sandboxDesc: string;
    resetCode: string;
    runCode: string;
    terminalOutput: string;
    terminalEmpty: string;
    continueToQuiz: string;
    quizTitle: string;
    quizDesc: string;
    checkAnswer: string;
    correctAlert: string;
    wrongAlert: string;
    showHint: string;
    hideHint: string;
    nextLevel: string;
    retryQuiz: string;
    starterKasir: string;
    starterKasirSeed: string;
    starterAbsensi: string;
    starterAbsensiSeed: string;
    starterKatalog: string;
    starterKatalogSeed: string;
    starterHabit: string;
    starterHabitSeed: string;
    starterSplitBill: string;
    starterSplitBillSeed: string;
    starterLes: string;
    starterLesSeed: string;
    vibeInputPlaceholder: string;
    vibeGenerateBtn: string;
  };
  pipeline: {
    title: string;
    subtitle: string;
    viewKanban: string;
    viewCalendar: string;
    autoScheduleBtn: string;
    autoScheduling: string;
    clearBoardBtn: string;
    columns: {
      ide: { label: string; blurb: string; empty: string };
      draft: { label: string; blurb: string; empty: string };
      siap: { label: string; blurb: string; empty: string };
      posted: { label: string; blurb: string; empty: string };
    };
    stepIde: string;
    stepDraftHook: string;
    stepDraftNoHook: string;
    stepSiap: string;
    stepPosted: string;
    actionHook: string;
    actionScript: string;
    actionDetail: string;
    actionMove: string;
  };
  profile: {
    milestoneBadge: string;
    milestonePeriod: string;
    milestoneTitleActive: (count: number) => string;
    milestoneTitleEmpty: string;
    milestoneDescHigh: string;
    milestoneDescMed: string;
    milestoneDescLow: string;
    topupBtn: string;
    profileContentBtn: string;
    profileSetupBtn: string;
    freeCredits: string;
    paidCredits: string;
    referralTitle: string;
    referralDesc: string;
    referralLink: string;
    friendsJoined: string;
    bonusEarned: string;
    historyTitle: string;
    historySaved: (count: number) => string;
    signOut: string;
  };
};
