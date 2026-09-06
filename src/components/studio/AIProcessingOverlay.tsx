"use client";

import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LivingProcessingCompanion } from "./LivingProcessingCompanion";
import { ProcessingTimeline, TimelinePhase } from "./ProcessingTimeline";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export type ModuleTimelineConfig = {
  headerTitleDesktop: string;
  headerTitleMobile: string;
  phases: TimelinePhase[];
  messages: Record<number, string>;
};

export const MODULE_TIMELINE_CONFIGS: Record<string, ModuleTimelineConfig> = {
  // 1. Ide Hari Ini / Brainstorm
  ide: {
    headerTitleDesktop: "LAGI NYARI IDE & POLA TERBAIK...",
    headerTitleMobile: "LAGI MIKIRIN IDE...",
    phases: [
      {
        id: 1,
        title: "Membaca topik lo",
        subtitle: "Nyari pola terbaik dari topik yang kamu kasih.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Riset sudut pandang",
        subtitle: "Milih angle yang paling cocok buat audiens lo.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Kurasi 3 ide terbaik",
        subtitle: "Nyiapin judul, format hook, dan inti konten.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Siap dipakai",
        subtitle: "3 ide konten pertama lo sudah siap.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue baca dulu topik lo...",
      2: "Lagi cari angle yang bikin orang berhenti scroll...",
      3: "Oke, gue kurasi 3 ide paling potensial...",
      4: "Hampir selesai. Tinggal gue rapihin...",
      5: "Siap! 3 ide udah beres.",
    },
  },

  // 2. Hook Lab / Bikin Hook
  hook: {
    headerTitleDesktop: "LAGI MERACIK HOOK 3 DETIK PERTAMA...",
    headerTitleMobile: "LAGI BIKIN HOOK...",
    phases: [
      {
        id: 1,
        title: "Bedah inti cerita",
        subtitle: "Identifikasi rasa penasaran & problem audiens.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Racik 3 detik pertama",
        subtitle: "Bikin pola kalimat pembuka yang bikin stay.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Uji daya pikat retensi",
        subtitle: "Kombinasi emosi, visual trigger, dan rasa kepo.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Hook siap dipilih",
        subtitle: "Opsi hook terbaik siap lo pilih.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue bedah dulu poin paling nendang...",
      2: "Lagi racik hook 3 detik pertama yang brutal...",
      3: "Oke, gue uji formula retensinya...",
      4: "Tinggal finishing variasi hook...",
      5: "Siap! Hook terbaik udah jadi.",
    },
  },

  // 3. Script Engine / Bikin Script
  script: {
    headerTitleDesktop: "LAGI MENYUSUN NASKAH LENGKAP...",
    headerTitleMobile: "LAGI NULIS NASKAH...",
    phases: [
      {
        id: 1,
        title: "Analisis hook terpilih",
        subtitle: "Kunci fondasi pembuka naskah.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Bangun alur retensi",
        subtitle: "Struktur pacing, jembatan ide, dan isi daging.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Tulis VO & visual footage",
        subtitle: "Pecah scene, arahan visual, dan teks layar.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Naskah lengkap siap",
        subtitle: "Script siap untuk syuting dan voiceover.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue kunci hook yang lo pilih...",
      2: "Lagi susun alur biar ga ada bagian yang ngebosenin...",
      3: "Oke, gue tulis arahan visual dan voice over-nya...",
      4: "Hampir beres. Tinggal poles CTA...",
      5: "Siap! Naskah lengkap udah beres.",
    },
  },

  // 4. Vibe Coding
  vibe: {
    headerTitleDesktop: "LAGI MERANCANG & MEMBANGUN APP...",
    headerTitleMobile: "LAGI BIKIN KODE...",
    phases: [
      {
        id: 1,
        title: "Analisis instruksi",
        subtitle: "Membaca spesifikasi fitur & interaksi.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Rancang arsitektur UI",
        subtitle: "Struktur layout, state, dan alur komponen.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Generate kode & logic",
        subtitle: "Build logic interaktif dan styling tailwind.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "App siap dicoba",
        subtitle: "Aplikasi langsung bisa lo preview.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue pelajari kebutuhan fiturnya...",
      2: "Lagi rancang struktur komponen dan state-nya...",
      3: "Oke, gue susun kode interaktifnya...",
      4: "Hampir selesai. Tinggal testing preview...",
      5: "Siap! App udah bisa dicoba.",
    },
  },

  // 5. Repurpose
  repurpose: {
    headerTitleDesktop: "LAGI MERACIK ULANG KONTEN MULTI-PLATFORM...",
    headerTitleMobile: "LAGI REPURPOSE...",
    phases: [
      {
        id: 1,
        title: "Membaca transkrip",
        subtitle: "Ekstraksi wawasan utama dari konten asal.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Format ulang media",
        subtitle: "Sesuaikan pola konsumsi tiap platform target.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Optimasi tone & CTA",
        subtitle: "Poles gaya penyampaian dan call-to-action.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Konten siap sebar",
        subtitle: "Versi multi-platform sudah siap diposting.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue baca dan petakan inti konten lo...",
      2: "Lagi sesuaikan format buat tiap medsos...",
      3: "Oke, gue poles tone dan hook per platform...",
      4: "Tinggal rapikan hasil akhirnya...",
      5: "Siap! Konten multi-platform selesai.",
    },
  },

  // 6. Clip Engine
  clip: {
    headerTitleDesktop: "LAGI MEMBEDAH POTONGAN KLIP VIRAL...",
    headerTitleMobile: "LAGI CARI KLIP...",
    phases: [
      {
        id: 1,
        title: "Pindai transkrip video",
        subtitle: "Cari momen paling padat wawasan & emosi.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Tentukan timestamp",
        subtitle: "Kunci durasi optimal 30-60 detik.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Racik judul & framing",
        subtitle: "Bikin headline pembuka yang mengundang klik.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Klip siap dipotong",
        subtitle: "Daftar timestamp & naskah klip sudah siap.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue dengerin dan scan transkrip videonya...",
      2: "Lagi tandai golden moment 30-60 detik...",
      3: "Oke, gue racik headline dan framing visualnya...",
      4: "Tinggal verifikasi timing tiap klip...",
      5: "Siap! Daftar klip viral udah jadi.",
    },
  },

  // 7. Thread Engine
  thread: {
    headerTitleDesktop: "LAGI MERANGKAI THREAD RETENSI TINGGI...",
    headerTitleMobile: "LAGI BIKIN THREAD...",
    phases: [
      {
        id: 1,
        title: "Bedah argumen utama",
        subtitle: "Ekstraksi poin-poin terkuat dari catatan mentah.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Racik tweet pembuka",
        subtitle: "Bikin hook post 1 yang mengundang rasa ingin tahu.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Susun alur tiap post",
        subtitle: "Pacing konsisten, 1 ide per cuitan tanpa filler.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Thread siap posting",
        subtitle: "Rangkaian thread lengkap dengan tweet penutup & CTA.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue bedah dulu poin-poin lo...",
      2: "Lagi racik cuitan pembuka yang nendang...",
      3: "Oke, gue susun alur logis per post...",
      4: "Tinggal finishing CTA penutup...",
      5: "Siap! Thread udah jadi.",
    },
  },

  // 8. Carousel Generator
  carousel: {
    headerTitleDesktop: "LAGI MENYUSUN SLIDE CAROUSEL...",
    headerTitleMobile: "LAGI BIKIN CAROUSEL...",
    phases: [
      {
        id: 1,
        title: "Analisis format visual",
        subtitle: "Menentukan ritme & kepadatan materi per slide.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Rancang slide pembuka",
        subtitle: "Cover slide magnetik yang menghentikan jempol.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Distribusi poin inti",
        subtitle: "Memecah wawasan utama menjadi slide mandiri.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Slide siap pakai",
        subtitle: "Seluruh slide siap dipindah ke desain visual.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue pelajari dulu topik carousel lo...",
      2: "Lagi rancang cover slide yang kuat...",
      3: "Menyusun isi slide agar runtut...",
      4: "Hampir selesai, memoles slide penutup...",
      5: "Siap! Rangkaian slide udah beres.",
    },
  },

  // 9. Affiliate Engine
  affiliate: {
    headerTitleDesktop: "LAGI MERACIK KONTEN AFFILIATE PERSUASIF...",
    headerTitleMobile: "LAGI BIKIN KONTEN...",
    phases: [
      {
        id: 1,
        title: "Analisis produk & USP",
        subtitle: "Menemukan keunggulan unik yang paling menjual.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Tentukan sudut soft-sell",
        subtitle: "Pendekatan edukatif tanpa terkesan jualan kasar.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Susun naskah & CTA",
        subtitle: "Kombinasi masalah penonton dan solusi produk.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Konten siap posting",
        subtitle: "Naskah affiliate lengkap siap menghasilkan komisi.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue analisis dulu produk & target pembeli...",
      2: "Lagi cari sudut soft-sell paling natural...",
      3: "Merangkai hook masalah dan solusi produk...",
      4: "Menyusun ajakan klik keranjang yang smooth...",
      5: "Siap! Konten affiliate udah selesai.",
    },
  },
};

export const MODULE_TIMELINE_CONFIGS_EN: Record<string, ModuleTimelineConfig> = {
  // 1. Daily Ideas / Brainstorm
  ide: {
    headerTitleDesktop: "FINDING BEST IDEAS & HOOK PATTERNS...",
    headerTitleMobile: "BRAINSTORMING IDEAS...",
    phases: [
      {
        id: 1,
        title: "Analyzing your topic",
        subtitle: "Uncovering the highest-retention angles.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Perspective research",
        subtitle: "Selecting hooks that fit your audience perfectly.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Curating top 3 ideas",
        subtitle: "Drafting catchy titles, hook formats, and core angles.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Ready to use",
        subtitle: "Your top 3 content ideas are finalized.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Reading your topic and background...",
      2: "Hunting for scroll-stopping angles...",
      3: "Curating the 3 highest-potential angles...",
      4: "Polishing headlines and hooks...",
      5: "Done! 3 ideas ready for you.",
    },
  },

  // 2. Hook Lab
  hook: {
    headerTitleDesktop: "CRAFTING 3-SECOND RETENTION HOOKS...",
    headerTitleMobile: "GENERATING HOOKS...",
    phases: [
      {
        id: 1,
        title: "Core angle breakdown",
        subtitle: "Identifying curiosity gaps and audience friction.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Drafting opening lines",
        subtitle: "Crafting hypnotic 3-second openers.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Stress-testing retention",
        subtitle: "Balancing emotion, visual cue, and intrigue.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Hooks ready to select",
        subtitle: "Your best opening variations are prepared.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Analyzing the most striking core point...",
      2: "Formulating brutal 3-second openers...",
      3: "Stress-testing retention formulas...",
      4: "Fine-tuning punchy hook variants...",
      5: "Done! Your best hooks are ready.",
    },
  },

  // 3. Script Engine
  script: {
    headerTitleDesktop: "WRITING FULL RETENTION SCRIPT...",
    headerTitleMobile: "WRITING SCRIPT...",
    phases: [
      {
        id: 1,
        title: "Hook alignment",
        subtitle: "Locking the opening thesis into the narrative.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Retention architecture",
        subtitle: "Structuring pacing, idea bridges, and value drops.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "VO & visual scene direction",
        subtitle: "Breaking down scenes, visual cues, and on-screen text.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Full script ready",
        subtitle: "Complete script ready for shooting & teleprompter.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Locking your selected hook...",
      2: "Building smooth pacing with zero fluff...",
      3: "Drafting visual directions and voiceover...",
      4: "Polishing call-to-action and punchlines...",
      5: "Done! Complete script is ready.",
    },
  },

  // 4. Vibe Coding
  vibe: {
    headerTitleDesktop: "ARCHITECTING & BUILDING APPLICATION...",
    headerTitleMobile: "WRITING CODE...",
    phases: [
      {
        id: 1,
        title: "Prompt & specs analysis",
        subtitle: "Parsing feature specs and user interaction flows.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "UI architecture design",
        subtitle: "Structuring layout, component state, and event handling.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Generating code & logic",
        subtitle: "Building interactive logic and Tailwind styling.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "App ready to preview",
        subtitle: "Live preview ready to inspect and interact.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Studying your requirements and features...",
      2: "Structuring components and state graph...",
      3: "Compiling interactive code and logic...",
      4: "Almost there, running preview verification...",
      5: "Done! Application is ready to preview.",
    },
  },

  // 5. Repurpose
  repurpose: {
    headerTitleDesktop: "REPURPOSING ACROSS MULTI-PLATFORMS...",
    headerTitleMobile: "REPURPOSING...",
    phases: [
      {
        id: 1,
        title: "Parsing source transcript",
        subtitle: "Extracting core insights and high-value nuggets.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Cross-platform adaptation",
        subtitle: "Tailoring formats for X, LinkedIn, TikTok, and IG.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Tone & CTA optimization",
        subtitle: "Refining platform tone and click-worthy CTAs.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Content ready to distribute",
        subtitle: "Multi-platform drafts ready for publishing.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Mapping out your source material...",
      2: "Reformatting for each platform audience...",
      3: "Polishing tone, hook, and layout per channel...",
      4: "Finalizing formatting and hooks...",
      5: "Done! Multi-platform content is ready.",
    },
  },

  // 6. Clip Engine
  clip: {
    headerTitleDesktop: "FINDING HIGH-VIRALITY VIDEO CLIPS...",
    headerTitleMobile: "FINDING CLIPS...",
    phases: [
      {
        id: 1,
        title: "Scanning video transcript",
        subtitle: "Detecting highest-density insights and spikes.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Identifying timestamps",
        subtitle: "Locking optimal 30-60 second golden segments.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Crafting titles & framing",
        subtitle: "Writing click-worthy headlines and visual cues.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Clips ready to export",
        subtitle: "Timestamps and scripts ready for cutting.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Scanning video transcript and speech flow...",
      2: "Highlighting 30-60s golden moments...",
      3: "Writing headlines and framing prompts...",
      4: "Verifying exact clip timestamps...",
      5: "Done! Viral clips list is ready.",
    },
  },

  // 7. Thread Engine
  thread: {
    headerTitleDesktop: "CRAFTING HIGH-RETENTION THREAD...",
    headerTitleMobile: "WRITING THREAD...",
    phases: [
      {
        id: 1,
        title: "Core argument breakdown",
        subtitle: "Extracting the sharpest insights from raw notes.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Drafting opening hook post",
        subtitle: "Writing a magnetic first post that demands attention.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Structuring narrative pacing",
        subtitle: "One actionable point per post with zero fluff.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Thread ready to publish",
        subtitle: "Complete thread with closing takeaways and CTA.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Analyzing your core points...",
      2: "Drafting an irresistible opening post...",
      3: "Structuring smooth narrative flow...",
      4: "Polishing takeaways and closing CTA...",
      5: "Done! Thread is ready.",
    },
  },

  // 8. Carousel Generator
  carousel: {
    headerTitleDesktop: "STRUCTURING HIGH-CONVERTING CAROUSEL...",
    headerTitleMobile: "DRAFTING CAROUSEL...",
    phases: [
      {
        id: 1,
        title: "Visual format analysis",
        subtitle: "Optimizing pacing and content density per slide.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Crafting thumb-stopping cover",
        subtitle: "Designing the headline hook that stops scrolling.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Distributing key insights",
        subtitle: "Breaking complex ideas into digestible slides.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Carousel ready to design",
        subtitle: "Full slide sequence ready for visual templates.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Studying your topic structure...",
      2: "Crafting a punchy cover slide...",
      3: "Distributing slide-by-slide value...",
      4: "Polishing call-to-action summary...",
      5: "Done! Carousel slides are ready.",
    },
  },

  // 9. Affiliate Engine
  affiliate: {
    headerTitleDesktop: "CRAFTING PERSUASIVE AFFILIATE SCRIPT...",
    headerTitleMobile: "WRITING SCRIPT...",
    phases: [
      {
        id: 1,
        title: "Product USP analysis",
        subtitle: "Highlighting unique angles that actually drive sales.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Soft-sell angle framing",
        subtitle: "Building relatable stories that sell without feeling salesy.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Scripting & CTA placement",
        subtitle: "Weaving problem setup with seamless product payoff.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Script ready to film",
        subtitle: "Complete affiliate script ready for recording.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Analyzing product benefits and buyer intent...",
      2: "Finding the most natural soft-sell angle...",
      3: "Structuring emotional hook and solution...",
      4: "Placing frictionless checkout CTAs...",
      5: "Done! Affiliate script is ready.",
    },
  },
};

function resolveConfig(moduleKey?: string, lang: "id" | "en" = "id"): ModuleTimelineConfig {
  const configs = lang === "en" ? MODULE_TIMELINE_CONFIGS_EN : MODULE_TIMELINE_CONFIGS;
  if (!moduleKey) return configs.ide;
  const key = moduleKey.toLowerCase();
  if (key.includes("hook")) return configs.hook;
  if (key.includes("script")) return configs.script;
  if (key.includes("vibe") || key.includes("app")) return configs.vibe;
  if (key.includes("repurpose") || key.includes("recycle")) return configs.repurpose;
  if (key.includes("clip")) return configs.clip;
  if (key.includes("thread")) return configs.thread || configs.ide;
  if (key.includes("carousel")) return configs.carousel || configs.ide;
  if (key.includes("affiliate")) return configs.affiliate || configs.ide;
  return configs.ide;
}

type OverlayData = {
  isOpen: boolean;
  isCompleted: boolean;
  moduleKey?: string;
  chars: number;
  label?: string;
  status?: string;
};

type Listener = (data: OverlayData) => void;

let currentData: OverlayData = {
  isOpen: false,
  isCompleted: false,
  chars: 0,
};

const listeners = new Set<Listener>();

function emit() {
  const snapshot = { ...currentData };
  listeners.forEach((l) => l(snapshot));
}

export function startStudioProcessing(opts: {
  moduleKey?: string;
  label?: string;
  status?: string;
}) {
  currentData = {
    isOpen: true,
    isCompleted: false,
    moduleKey: opts.moduleKey,
    label: opts.label,
    status: opts.status,
    chars: 0,
  };
  emit();
}

export function updateStudioStatus(status?: string) {
  if (!currentData.isOpen) return;
  currentData.status = status;
  emit();
}

export function updateStudioChars(chars: number) {
  if (!currentData.isOpen) return;
  currentData.chars = chars;
  emit();
}

export function completeStudioProcessing() {
  if (!currentData.isOpen) return;
  currentData.isCompleted = true;
  emit();
}

export function closeStudioProcessing() {
  currentData = {
    isOpen: false,
    isCompleted: false,
    chars: 0,
  };
  emit();
}

export function GlobalStudioProcessingOverlay() {
  const [data, setData] = useState<OverlayData>(currentData);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [visualCompleted, setVisualCompleted] = useState(false);

  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const progressRef = useRef<number>(0);
  const charsRef = useRef<number>(0);
  const isCompletingRef = useRef<boolean>(false);

  // Subscribe to Global Store
  useEffect(() => {
    const listener: Listener = (nextData) => {
      setData(nextData);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Sync progressRef with progress state
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Sync charsRef with data.chars without triggering loop re-creation
  useEffect(() => {
    charsRef.current = data.chars;
  }, [data.chars]);

  // Main Processing & Smooth Completion Animation Engine
  useEffect(() => {
    if (data.isOpen && !data.isCompleted) {
      // RESET for new run
      isCompletingRef.current = false;
      startTimeRef.current = Date.now();

      animationRef.current = requestAnimationFrame(() => {
        setVisualCompleted(false);
        setProgress(0);
        setElapsed(0);
      });

      const loop = () => {
        const now = Date.now();
        const secs = (now - startTimeRef.current) / 1000;
        setElapsed(secs);

        // Smooth continuous 4-phase progress curve (0 to 89.5%)
        let nextProgress = 0;
        if (secs < 2.5) {
          nextProgress = (secs / 2.5) * 25; // 0 - 25% (Phase 1)
        } else if (secs < 6.0) {
          nextProgress = 25 + ((secs - 2.5) / 3.5) * 30; // 25 - 55% (Phase 2)
        } else if (secs < 11.0) {
          nextProgress = 55 + ((secs - 6.0) / 5.0) * 30; // 55 - 85% (Phase 3)
        } else {
          const remainingTime = secs - 11.0;
          nextProgress = 85 + (1 - Math.exp(-remainingTime / 6)) * 4.5; // 85 - 89.5% (Phase 4)
        }

        // Chars provide only a subtle organic pacing nudge (max +2%) without skipping phases
        if (charsRef.current > 0) {
          const charBonus = Math.min(2.5, charsRef.current / 400);
          nextProgress = Math.min(89.5, nextProgress + charBonus);
        }

        const clamped = Math.min(89.5, Math.max(progressRef.current, nextProgress));
        setProgress(clamped);
        animationRef.current = requestAnimationFrame(loop);
      };

      animationRef.current = requestAnimationFrame(loop);
    } else if (data.isOpen && data.isCompleted && !isCompletingRef.current) {
      // SMOOTH 100% COMPLETION SEQUENCE
      isCompletingRef.current = true;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      const startProgress = progressRef.current;
      const targetProgress = 100;
      const durationMs = 450; // Smooth continuous glide to 100%
      const startTweenTime = Date.now();

      const tweenLoop = () => {
        const elapsedMs = Date.now() - startTweenTime;
        const t = Math.min(1, elapsedMs / durationMs);
        // easeOutCubic
        const ease = 1 - Math.pow(1 - t, 3);
        const currentVal = startProgress + (targetProgress - startProgress) * ease;
        setProgress(currentVal);

        if (t < 1) {
          animationRef.current = requestAnimationFrame(tweenLoop);
        } else {
          setProgress(100);
          setVisualCompleted(true);

          // Hold the 100% celebratory completion state for 850ms, then smoothly exit
          const exitTimer = setTimeout(() => {
            closeStudioProcessing();
            isCompletingRef.current = false;
          }, 850);

          return () => clearTimeout(exitTimer);
        }
      };

      animationRef.current = requestAnimationFrame(tweenLoop);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [data.isOpen, data.isCompleted]);

  const { language } = useLanguage();
  const isEn = language === "en";
  const config = resolveConfig(data.moduleKey, isEn ? "en" : "id");
  const isCompleted = visualCompleted || progress >= 100;
  const currentPhase = isCompleted
    ? 4
    : progress < 25
    ? 1
    : progress < 55
    ? 2
    : progress < 85
    ? 3
    : 4;

  const timerFormatted = `${String(Math.floor(elapsed)).padStart(2, "0")}s`;

  return (
    <AnimatePresence>
      {data.isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px",
          }}
        >
          {/* Background Dim Mode with Butter-Smooth Exit */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 bg-black/65 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Floating AI Workspace Window with Cinematic Spring Exit */}
          <motion.div
            key="modal-window"
            role="dialog"
            aria-modal="true"
            aria-label={isEn ? "Malesan is processing" : "Malesan sedang memproses"}
            initial={{ opacity: 0, scale: 0.93, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.94,
              y: 16,
              transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
            }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`relative z-10 w-full max-w-[520px] max-h-[92vh] flex flex-col justify-between rounded-[28px] border border-white/[0.08] bg-[#111111] p-4.5 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_60px_rgba(255,138,61,0.22)] backdrop-blur-2xl transition-all duration-300 ${
              isCompleted
                ? "ring-2 ring-emerald-500/50 shadow-[0_0_80px_rgba(16,185,129,0.35)]"
                : ""
            }`}
          >
            {/* Ambient Internal Radial Glow */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-80 rounded-full blur-2xl transition-all duration-500 ${
                isCompleted
                  ? "bg-[radial-gradient(circle,rgba(16,185,129,0.25)_0%,transparent_70%)]"
                  : "bg-[radial-gradient(circle,rgba(255,138,61,0.22)_0%,transparent_70%)]"
              }`}
            />

            {/* HUD Header */}
            <div className="relative z-10 flex items-center justify-between border-b border-white/[0.06] pb-3">
              {/* Left: Headline Status */}
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="relative flex size-2.5 shrink-0">
                  <span
                    className={`absolute inline-flex size-full rounded-full opacity-75 ${
                      isCompleted
                        ? "bg-emerald-400 animate-ping"
                        : "bg-ember animate-ping"
                    }`}
                  />
                  <span
                    className={`relative inline-flex size-2.5 rounded-full ${
                      isCompleted ? "bg-emerald-400" : "bg-ember"
                    }`}
                  />
                </span>
                <span
                  className={`truncate font-mono text-xs font-bold tracking-wider uppercase transition-colors duration-200 ${
                    isCompleted ? "text-emerald-400" : "text-ember"
                  }`}
                >
                  {isCompleted ? (
                    isEn ? "READY TO USE" : "SIAP DIPAKAI"
                  ) : data.status ? (
                    data.status.toUpperCase()
                  ) : (
                    <>
                      <span className="hidden sm:inline">{config.headerTitleDesktop}</span>
                      <span className="sm:hidden">{config.headerTitleMobile}</span>
                    </>
                  )}
                </span>
              </div>

              {/* Right: Fixed-width HUD Timer [ 04s ] */}
              <div className="flex w-16 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-[#161616] py-1 font-mono text-xs font-semibold text-[#F5F5F5] shadow-inner">
                <span className="tabular font-mono tracking-tight">
                  {timerFormatted}
                </span>
              </div>
            </div>

            {/* Center: Living Mascot Companion with Contextual Speech */}
            <div className="relative z-10 my-auto py-1 sm:py-2">
              <LivingProcessingCompanion
                phase={currentPhase}
                progress={progress}
                messages={config.messages}
                isCompleted={isCompleted}
              />
            </div>

            {/* Bottom: Neural Progress Bar & Contextual Step Timeline */}
            <div className="relative z-10 mt-auto rounded-2xl border border-white/[0.06] bg-black/40 p-3 sm:p-4">
              <ProcessingTimeline
                currentPhase={currentPhase}
                progress={progress}
                phases={config.phases}
                isCompleted={isCompleted}
              />
            </div>

            {/* Bottom-most Status Strip */}
            <div className="relative z-10 mt-2.5 sm:mt-3.5 text-center">
              <p
                className={`font-mono text-[10px] sm:text-micro transition-colors duration-200 ${
                  isCompleted ? "text-emerald-400 font-semibold" : "text-muted/60"
                }`}
              >
                {isCompleted
                  ? (isEn ? "Content is ready in your workspace!" : "Konten siap di workspace lo!")
                  : (isEn ? "Stay on this page until results appear." : "Tetap di halaman ini sampai hasilnya muncul.")}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Backward compatibility export
export const AIProcessingOverlay = GlobalStudioProcessingOverlay;
