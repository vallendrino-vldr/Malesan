"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Level = "beginner" | "intermediate" | "advanced";
type Mode = "academy" | "voice" | "scenario" | "quiz" | "essay" | "progress";
type Persona = "sarah" | "alex" | "david" | "emma";

interface SuggestedReply {
  en: string;
  id: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  translateId?: string | null;
  suggestedReplies?: SuggestedReply[];
  tip?: string | null;
  pitfallTag?: string | null;
  roast?: string | null;
  score?: number;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  roastWrong: string;
}

interface EssayEvaluation {
  overallBandScore: string;
  overallScore100: number;
  roastReview: string;
  strengths: string[];
  weaknesses: string[];
  grammarCorrections: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  lexicalSuggestions: Array<{
    simpleWord: string;
    advancedWord: string;
    exampleUsage: string;
  }>;
  perfectedDraft: string;
}

interface ScenarioItem {
  id: string;
  title: string;
  partner: Persona;
  partnerRole: string;
  context: string;
  missions: string[];
}

interface SessionRecord {
  id: string;
  timestamp: number;
  type: "academy" | "voice" | "scenario" | "quiz" | "essay";
  title: string;
  score: number;
  durationSeconds?: number;
  pitfalls?: string[];
}

// Global Speech Recognition API Interfaces
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstanceLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

const PERSONAS: Array<{ id: Persona; name: string; tag: string; desc: string; accent: string }> = [
  { id: "sarah", name: "Sarah", tag: "British Casual", accent: "London", desc: "Ramah, sopan, aksen British mengalir alami" },
  { id: "alex", name: "Alex", tag: "American Slang", accent: "California", desc: "Santai, banyak ungkapan gaul modern & ceria" },
  { id: "david", name: "David", tag: "Tech Recruiter", accent: "Executive", desc: "Wawancara kerja profesional, tajam & suportif" },
  { id: "emma", name: "Emma", tag: "IELTS Coach", accent: "Academic", desc: "Melatih struktur berpikir kritis & kelancaran" },
];

const SCENARIOS: ScenarioItem[] = [
  {
    id: "job_interview",
    title: "Wawancara Kerja Global",
    partner: "david",
    partnerRole: "Senior Tech Recruiter",
    context: "Kamu sedang diwawancarai oleh Senior Tech Recruiter untuk posisi internasional jarak jauh.",
    missions: [
      "Perkenalkan diri dan keahlian utamamu",
      "Jelaskan pengalaman proyek yang paling membanggakan",
      "Sampaikan ekspektasi gaji dan gaya kerjamu",
    ],
  },
  {
    id: "airport_immigration",
    title: "Pemeriksaan Imigrasi Bandara",
    partner: "sarah",
    partnerRole: "Immigration Officer",
    context: "Kamu baru mendarat di London Heathrow dan petugas imigrasi menanyakan tujuan kunjunganmu.",
    missions: [
      "Jawab tujuan kedatangan dan lama tinggal",
      "Tunjukkan tempat menginap / reservasi hotel",
      "Jelaskan pekerjaanmu di Indonesia",
    ],
  },
  {
    id: "ordering_cafe",
    title: "Pesan Kopi & Makanan di Kafe",
    partner: "alex",
    partnerRole: "Barista Kafe Hipster",
    context: "Kamu sedang antre di kafe San Francisco dan ingin memesan minuman kustom.",
    missions: [
      "Pesan kopi dengan susu oat dan sedikit gula",
      "Tanya rekomendasi roti atau pastry terbaik",
      "Selesaikan pembayaran non-tunai",
    ],
  },
  {
    id: "salary_negotiation",
    title: "Negosiasi Kenaikan Gaji",
    partner: "david",
    partnerRole: "Engineering Manager",
    context: "Sesi 1-on-1 dengan manajer untuk membahas pencapaian tahunan dan penyesuaian kompensasi.",
    missions: [
      "Ungkapkan kontribusi dan hasil kerjamu tahun ini",
      "Tunjukkan riset standar gaji industri terkini",
      "Capai kesepakatan nilai yang saling menguntungkan",
    ],
  },
  {
    id: "hotel_checkin",
    title: "Check-in Hotel & Permintaan Kamar",
    partner: "emma",
    partnerRole: "Front Desk Concierge",
    context: "Kamu tiba di hotel bintang lima dan ingin check-in dengan request lantai tinggi pemandangan kota.",
    missions: [
      "Sebutkan nama reservasi dan tunjukkan paspor",
      "Minta kamar bebas rokok lantai atas",
      "Tanyakan jadwal sarapan dan fasilitas gym",
    ],
  },
  {
    id: "freelance_client",
    title: "Diskusi Proyek Klien Internasional",
    partner: "alex",
    partnerRole: "Product Owner Luar Negeri",
    context: "Klien luar negeri menghubungimu untuk merekrut keahlianmu dalam proyek digital.",
    missions: [
      "Jelaskan alur kerjamu dan estimasi waktu selesai",
      "Sampaikan rate harga jasa dan opsi revisi",
      "Sepakati tenggat waktu dan pembayaran deposit",
    ],
  },
];

const ESSAY_TOPICS = [
  "Dampak Artificial Intelligence terhadap lapangan pekerjaan masa depan",
  "Pentingnya kemampuan konten kreator di era ekonomi digital",
  "Kelebihan dan kekurangan sistem kerja Work From Home (WFH)",
  "Apakah gelar sarjana masih relevan untuk sukses di industri teknologi?",
  "Pengaruh media sosial terhadap kesehatan mental generasi muda",
];

// =========================================================================
// BEGINNER-FRIENDLY DUAL-AUDIO DATA STRUCTURE (NO CONFUSING IPA JARGON)
// =========================================================================
interface AudioDrillOption {
  text: string;
  subtext: string;
  soundSample: string;
  isCorrect: boolean;
}

interface AudioLessonStep {
  title: string;
  focusHighlight: string;
  easyPhonetic: string;
  explanation: string;
  wrongAudio: {
    label: string;
    text: string;
    sampleText: string;
    explanation: string;
  };
  correctAudio: {
    label: string;
    text: string;
    sampleText: string;
    explanation: string;
  };
  tongueTip: string;
  audioDrill: {
    prompt: string;
    options: AudioDrillOption[];
    explanation: string;
  };
}

interface AudioGateExamQuestion {
  question: string;
  options: Array<{
    text: string;
    subtext?: string;
    soundSample?: string;
  }>;
  correctIndex: number;
  explanation: string;
}

interface AudioGatedStage {
  id: number;
  percentage: number;
  title: string;
  subtitle: string;
  badge: string;
  summary: string;
  steps: AudioLessonStep[];
  exam: AudioGateExamQuestion[];
}

const AUDIO_GATED_STAGES: AudioGatedStage[] = [
  {
    id: 1,
    percentage: 20,
    title: "Tahap 1: Alfabet & Fonetik Dasar",
    subtitle: "Cara Baca Huruf Sebenarnya, Bunyi Lidah & Silent Letters",
    badge: "0% → 20%",
    summary: "Dengarkan perbandingan langsung bunyi salah vs benar untuk abjad kunci, desisan lidah TH, getaran V, dan huruf bisu.",
    steps: [
      {
        title: "Abjad 'H' & 'R' yang Sering Salah Dibaca",
        focusHighlight: "Huruf H = 'EITCH' • Huruf R = 'AR' (Lidah Melengkung)",
        easyPhonetic: "Panduan Ejaan Santai: H dibaca 'EITCH' (Bukan Hek) • R dibaca 'AR' lembut tanpa getar",
        explanation: "Orang Indonesia sering membaca huruf H menjadi 'Hek'. Huruf H murni dibaca 'Eitch'. Huruf R dibaca dengan menarik lidah ke belakang tanpa bergetar keras.",
        wrongAudio: {
          label: "BUNYI SALAH (Kaku / Terbata):",
          text: "H dibaca 'Hek' / R bergetar keras 'Rrr'",
          sampleText: "Hek, het, het.",
          explanation: "Menambahkan letupan 'H' kasar yang tidak ada pada penutur asli.",
        },
        correctAudio: {
          label: "BUNYI BENAR (Native):",
          text: "H dibaca 'Eitch' / R dibaca 'Ar' lembut",
          sampleText: "A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z.",
          explanation: "Murni melafalkan vokal 'ei' diikuti desisan halus 'tch'.",
        },
        tongueTip: "Tarik ujung lidah ke belakang menjauhi gigi seri saat menyebut huruf R.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah pelafalan abjad 'H' yang benar?",
          options: [
            {
              text: "Pelafalan 'Eitch' murni",
              subtext: "Ejaan: 'EITCH' (Tanpa huruf H di depan)",
              soundSample: "H is pronounced Eitch.",
              isCorrect: true,
            },
            {
              text: "Pelafalan 'Hek'",
              subtext: "Ejaan: 'HEK' (Dengan bunyi H kasar di awal)",
              soundSample: "Hek is wrong.",
              isCorrect: false,
            },
          ],
          explanation: "Abjad H dalam bahasa Inggris dibaca murni 'Eitch'.",
        },
      },
      {
        title: "Bunyi Lidah 'TH' (Tebal vs Tipis)",
        focusHighlight: "This = 'D-HIS' • Think = 'T-HINGK'",
        easyPhonetic: "Panduan Ejaan Santai: This/That (Tebal) • Think/Thank (Tipis) dengan ujung lidah digigit lembut",
        explanation: "Lidah dijepit lembut di antara gigi seri atas dan bawah. Jangan dibaca 'D' (bukan 'De') dan jangan dibaca 'T' (bukan 'Tingk').",
        wrongAudio: {
          label: "BUNYI SALAH (Indoglish D/T):",
          text: "Dis, Dat, Dey • Tingk, Tengkyu",
          sampleText: "Dis and dat, dey tingk and tengkyu.",
          explanation: "Lidah tertahan di dalam mulut menghasilkan bunyi D atau T kasar.",
        },
        correctAudio: {
          label: "BUNYI BENAR (Native TH):",
          text: "This, that, they • Think, thank, three",
          sampleText: "This and that, they think and thank you three times.",
          explanation: "Ujung lidah keluar sedikit di antara gigi atas dan bawah.",
        },
        tongueTip: "Keluarkan ujung lidah sekitar 2 milimeter di antara gigi seri.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah yang melafalkan 'Think and Thank you' dengan benar?",
          options: [
            {
              text: "Pelafalan 'Think and thank you'",
              subtext: "Desisan lidah /TH/ halus di gigi seri",
              soundSample: "I think and thank you.",
              isCorrect: true,
            },
            {
              text: "Pelafalan 'Tingk and tengkyu'",
              subtext: "Bunyi huruf T biasa khas Indonesia",
              soundSample: "I tingk and tengkyu.",
              isCorrect: false,
            },
          ],
          explanation: "Kata 'Think' dan 'Thank' wajib diawali desisan jepit lidah, bukan huruf T biasa.",
        },
      },
      {
        title: "Bunyi 'V' vs 'P'",
        focusHighlight: "Favorite Video = 'FE-VE-RIT VI-DI-O'",
        easyPhonetic: "Panduan Ejaan Santai: Huruf V wajib menghasilkan getaran di bibir bawah",
        explanation: "Huruf V bergetar pada bibir bawah (Voice Vibration). Jangan pernah sebut 'Pavorite' atau 'Pideo'!",
        wrongAudio: {
          label: "BUNYI SALAH (Tertukar P/F):",
          text: "Pavorite pideo, pery good",
          sampleText: "My pavorite pideo is pery good.",
          explanation: "Kedua bibir menutup sehingga menghasilkan bunyi P bukannya getaran V.",
        },
        correctAudio: {
          label: "BUNYI BENAR (Vibrating V):",
          text: "Favorite video, very good",
          sampleText: "My favorite video is very good.",
          explanation: "Gigi seri atas menyentuh bibir bawah bagian dalam dengan getaran suara jelas.",
        },
        tongueTip: "Sentuhkan gigi atas ke bibir bawah bagian dalam, rasakan getaran pita suara saat bunyi V keluar.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah pengucapan kata 'Favorite Video' yang benar?",
          options: [
            {
              text: "Pelafalan 'Favorite video'",
              subtext: "Gigi atas menyentuh bibir bawah + getaran suara",
              soundSample: "This is my favorite video.",
              isCorrect: true,
            },
            {
              text: "Pelafalan 'Pavorite pideo'",
              subtext: "Bibir menutup rapat menghasilkan bunyi huruf P",
              soundSample: "This is my pavorite pideo.",
              isCorrect: false,
            },
          ],
          explanation: "Huruf V wajib menghasilkan getaran bibir, tidak boleh ditekan menjadi huruf P.",
        },
      },
      {
        title: "Huruf Bisu S pada kata 'Island' (Pulau)",
        focusHighlight: "Island = 'AI-LEND' (Huruf S Jangan Dibaca)",
        easyPhonetic: "Panduan Ejaan Santai: Dibaca murni 'AI-LEND' (Huruf S adalah Silent Letter)",
        explanation: "Huruf S pada kata 'Island' (pulau) berstatus bisu (silent letter) dan HARAM disuarakan!",
        wrongAudio: {
          label: "BUNYI SALAH (S Dibaca Jelas):",
          text: "Is-land (s bersuara)",
          sampleText: "We visit the is-land.",
          explanation: "Membaca huruf S seperti 'Es-land'.",
        },
        correctAudio: {
          label: "BUNYI BENAR (S Bisu):",
          text: "Eye-land (s tidak bersuara)",
          sampleText: "We visit the island.",
          explanation: "Murni melafalkan kata 'Eye' (mata) disambung 'land'.",
        },
        tongueTip: "Ingat: Huruf S pada 'Island' sama sekali tidak berbunyi.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah cara membaca kata 'Island' (pulau) yang benar?",
          options: [
            {
              text: "Pelafalan 'Eye-land'",
              subtext: "Huruf S bisu dan tidak bersuara (Benar)",
              soundSample: "We visit the island.",
              isCorrect: true,
            },
            {
              text: "Pelafalan 'Is-land'",
              subtext: "Huruf S dibaca jelas seperti es (Salah)",
              soundSample: "We visit the is-land.",
              isCorrect: false,
            },
          ],
          explanation: "Huruf S pada 'Island' adalah silent letter, dibaca murni 'Eye-land'.",
        },
      },
      {
        title: "Huruf Bisu B pada kata 'Doubt' (Ragu)",
        focusHighlight: "Doubt = 'DA-UT' (Huruf B Jangan Dibaca)",
        easyPhonetic: "Panduan Ejaan Santai: Dibaca murni 'DA-UT' (Huruf B tidak berbunyi)",
        explanation: "Huruf B pada kata 'Doubt' (ragu) dan 'Debt' (utang) adalah silent letter yang tidak berbunyi.",
        wrongAudio: {
          label: "BUNYI SALAH (B Dibaca):",
          text: "Dowbt / Dobt",
          sampleText: "I have dowbt.",
          explanation: "Membunyikan huruf B.",
        },
        correctAudio: {
          label: "BUNYI BENAR (B Bisu):",
          text: "Daut (murni vokal au)",
          sampleText: "I have no doubt.",
          explanation: "Murni dibaca 'Daut'.",
        },
        tongueTip: "Cukup lafalkan 'Da-ut' tanpa menutup bibir untuk huruf B.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah cara membaca kata 'Doubt' yang benar?",
          options: [
            {
              text: "Pelafalan 'Daut'",
              subtext: "Huruf B bisu dan tidak bersuara (Benar)",
              soundSample: "I have no doubt.",
              isCorrect: true,
            },
            {
              text: "Pelafalan 'Dowbt'",
              subtext: "Huruf B dibaca dengan letupan bibir (Salah)",
              soundSample: "I have dowbt.",
              isCorrect: false,
            },
          ],
          explanation: "Huruf B pada 'doubt' dan 'debt' tidak pernah disuarakan sama sekali.",
        },
      },
    ],
    exam: [
      {
        question: "Dengarkan audio di bawah. Manakah pelafalan abjad 'H' yang benar?",
        options: [
          { text: "Eitch (tanpa bunyi H di awal)", subtext: "Ejaan: 'EITCH'", soundSample: "H is pronounced Eitch." },
          { text: "Hek (dengan bunyi H kasar)", subtext: "Ejaan: 'HEK'", soundSample: "Hek is wrong." },
        ],
        correctIndex: 0,
        explanation: "Huruf H dibaca murni 'Eitch'.",
      },
      {
        question: "Dengarkan audio di bawah. Manakah pelafalan kata 'Island' (pulau) yang tepat?",
        options: [
          { text: "Eye-land (s bisu)", subtext: "Ejaan: 'AI-LEND'", soundSample: "Island" },
          { text: "Is-land (s bersuara jelas)", subtext: "Ejaan: 'IS-LEND'", soundSample: "Is-land" },
        ],
        correctIndex: 0,
        explanation: "Huruf S pada kata 'Island' adalah silent letter, dibaca 'Eye-land'.",
      },
      {
        question: "Dengarkan audio di bawah. Manakah kalimat dengan bunyi desisan lidah 'TH' yang benar?",
        options: [
          { text: "This and that, thank you", subtext: "Desisan lembut di antara gigi seri", soundSample: "This and that, thank you." },
          { text: "Dis and dat, tengkyu", subtext: "Bunyi huruf D dan T biasa", soundSample: "Dis and dat, tengkyu." },
        ],
        correctIndex: 0,
        explanation: "Bunyi TH membutuhkan posisi lidah di antara gigi atas dan bawah.",
      },
    ],
  },
  {
    id: 2,
    percentage: 40,
    title: "Tahap 2: Sambung Kata & Irama Kalimat",
    subtitle: "Connected Speech, Linking & Natural Reductions",
    badge: "20% → 40%",
    summary: "Penutur asli menyambungkan konsonan ke vokal dan mereduksi kata agar kalimat mengalir mulus tanpa terputus-putus.",
    steps: [
      {
        title: "Menyambung Konsonan ke Vokal: 'Hold on'",
        focusHighlight: "Hold on → 'HOL-DON' • Pick it up → 'PI-KI-TAP'",
        easyPhonetic: "Panduan Ejaan Santai: Huruf mati di ujung kata pertama langsung menyambung ke huruf hidup kata berikutnya",
        explanation: "Konsonan di akhir kata pertama langsung disambungkan ke huruf vokal kata berikutnya tanpa jeda.",
        wrongAudio: {
          label: "BUNYI SALAH (Terputus-putus):",
          text: "Hold... On • Pick... It... Up",
          sampleText: "Hold... on... please pick... it... up.",
          explanation: "Membaca kata satu per satu seperti robot.",
        },
        correctAudio: {
          label: "BUNYI BENAR (Mengalir Natural):",
          text: "Hol-don • Pi-ki-tap",
          sampleText: "Hold on, please pick it up right now.",
          explanation: "D menyambung ke O ('Hol-don'), K menyambung ke I dan T menyambung ke U ('Pi-ki-tap').",
        },
        tongueTip: "Ucapkan frasa dua kata seolah-olah itu adalah satu kata panjang bersambung.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah yang terdengar mengalir seperti penutur asli?",
          options: [
            {
              text: "Pelafalan 'Hold on, pick it up'",
              subtext: "Menyambung konsonan ke vokal ('Hol-don', 'Pi-ki-tap')",
              soundSample: "Hold on, pick it up.",
              isCorrect: true,
            },
            {
              text: "Pelafalan 'Hold... on... pick... it... up'",
              subtext: "Terputus kata demi kata kaku",
              soundSample: "Hold on please pick it up slowly.",
              isCorrect: false,
            },
          ],
          explanation: "Connected speech menyambung konsonan ke vokal menjadi 'Hol-don' dan 'Pi-ki-tap'.",
        },
      },
      {
        title: "Reduksi Percakapan: 'Gonna' & 'Wanna'",
        focusHighlight: "Going to = 'GONNA' • Want to = 'WANNA'",
        easyPhonetic: "Panduan Ejaan Santai: 'AI'M GONNA TEL YU WHAT AI WANNA DU'",
        explanation: "Reduksi ini dipakai secara alami oleh penutur asli saat mengobrol santai dan mengalir cepat.",
        wrongAudio: {
          label: "BUNYI KAKU (Terlalu Formal):",
          text: "I am going to want to go",
          sampleText: "I am going to want to go now.",
          explanation: "Terlalu kaku untuk percakapan harian.",
        },
        correctAudio: {
          label: "BUNYI NATIVE (Luwes & Santai):",
          text: "I'm gonna tell you what I wanna do",
          sampleText: "I am gonna tell you what I wanna do.",
          explanation: "Menggunakan peluluhan kata 'gonna' dan 'wanna'.",
        },
        tongueTip: "Gunakan 'gonna' dan 'wanna' pada situasi santai, meeting tim, atau obrolan harian.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah ungkapan santai yang paling alami?",
          options: [
            {
              text: "Ungkapan 'I'm gonna tell you what I wanna do'",
              subtext: "Mengalir luwes dan santai (Native Style)",
              soundSample: "I am gonna tell you what I wanna do.",
              isCorrect: true,
            },
            {
              text: "Ungkapan 'I am going to want to do'",
              subtext: "Kaku dan terputus-putus",
              soundSample: "I am going to want to do that.",
              isCorrect: false,
            },
          ],
          explanation: "'Gonna' dan 'Wanna' membuat ritme bicara terasa rileks dan luwes.",
        },
      },
    ],
    exam: [
      {
        question: "Dengarkan audio di bawah. Manakah sambungan kata 'Hold on' yang benar?",
        options: [
          { text: "Hol-don (tersambung konsonan ke vokal)", subtext: "Ejaan: 'HOL-DON'", soundSample: "Hold on" },
          { text: "Hold... on (terputus kaku)", subtext: "Ejaan: 'HOLD... ON'", soundSample: "Hold on slowly" },
        ],
        correctIndex: 0,
        explanation: "Konsonan D di akhir 'Hold' menyambung ke 'on', dibaca 'Hol-don'.",
      },
      {
        question: "Bentuk reduksi santai dari frasa 'Want to' yang umum digunakan penutur asli adalah:",
        options: [
          { text: "Wanna", subtext: "Ejaan: 'WANNA'", soundSample: "I wanna go" },
          { text: "Wanto", subtext: "Ejaan: 'WAN-TO'", soundSample: "I want to" },
        ],
        correctIndex: 0,
        explanation: "'Want to' melebur menjadi 'Wanna' dalam percakapan santai.",
      },
    ],
  },
  {
    id: 3,
    percentage: 60,
    title: "Tahap 3: 50 Larangan & Jebakan Fatal Indoglish",
    subtitle: "Koreksi Terjemahan Harfiah yang Paling Sering Bikin Salah",
    badge: "40% → 60%",
    summary: "Hentikan menerjemahkan bahasa Indonesia kata per kata. Pelajari padanan baku yang benar dan dengarkan perbedaannya.",
    steps: [
      {
        title: "Larangan Keras: 'I am agree'",
        focusHighlight: "JANGAN: 'I am agree' → GUNAKAN: 'I agree' = 'AI E-GRI'",
        easyPhonetic: "Panduan Ejaan Santai: Langsung ucapkan 'I agree' (Tanpa kata 'am')",
        explanation: "'Agree' adalah kata kerja (verb), bukan kata sifat. Jadi TIDAK BOLEH memakai to be 'am'!",
        wrongAudio: {
          label: "BUNYI SALAH (Indoglish Fatal):",
          text: "I am agree with your opinion",
          sampleText: "I am agree with your opinion.",
          explanation: "Menambahkan to be 'am' sebelum kata kerja adalah kesalahan fatal.",
        },
        correctAudio: {
          label: "BUNYI BENAR (Standard English):",
          text: "I agree with your opinion",
          sampleText: "I agree with your opinion completely.",
          explanation: "Langsung gunakan subjek + kata kerja: 'I agree'.",
        },
        tongueTip: "Cukup katakan 'I agree' atau 'I completely agree'.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah kalimat persetujuan yang benar secara tata bahasa?",
          options: [
            {
              text: "Kalimat 'I agree with your proposal'",
              subtext: "Subjek langsung diikuti kata kerja tanpa 'am' (Benar)",
              soundSample: "I agree with your proposal completely.",
              isCorrect: true,
            },
            {
              text: "Kalimat 'I am agree with your proposal'",
              subtext: "Salah fatal karena menambahkan 'am' sebelum verb (Salah)",
              soundSample: "I am agree with your proposal.",
              isCorrect: false,
            },
          ],
          explanation: "'Agree' adalah verb (kata kerja), jadi langsung 'I agree' tanpa to be 'am'.",
        },
      },
      {
        title: "Larangan Keras: 'Thanks before'",
        focusHighlight: "JANGAN: 'Thanks before' → GUNAKAN: 'Thanks in advance'",
        easyPhonetic: "Panduan Ejaan Santai: 'TENGKS IN ED-VANS' (Standar Baku Terima Kasih di Awal)",
        explanation: "Penutur asli tidak mengenal frasa 'thanks before'. Untuk ucapan terima kasih di awal bantuan, gunakan 'Thanks in advance'.",
        wrongAudio: {
          label: "BUNYI SALAH (Terjemahan Harfiah):",
          text: "Thanks before for your help",
          sampleText: "Thanks before for your help.",
          explanation: "Menerjemahkan 'terima kasih sebelumnya' kata per kata.",
        },
        correctAudio: {
          label: "BUNYI BENAR (Professional Native):",
          text: "Thanks in advance for your help",
          sampleText: "Thanks in advance for your support and feedback.",
          explanation: "Standar baku dalam komunikasi email dan chat profesional internasional.",
        },
        tongueTip: "Pakai 'Thanks in advance' saat meminta tolong lewat email atau chat.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah ucapan terima kasih di awal yang benar?",
          options: [
            {
              text: "Ucapan 'Thanks in advance for your help'",
              subtext: "Standar baku profesional internasional (Benar)",
              soundSample: "Thanks in advance for your help.",
              isCorrect: true,
            },
            {
              text: "Ucapan 'Thanks before for your help'",
              subtext: "Terjemahan kata per kata yang rancu (Salah)",
              soundSample: "Thanks before for your help.",
              isCorrect: false,
            },
          ],
          explanation: "'Thanks in advance' adalah ungkapan resmi dan baku dalam bahasa Inggris.",
        },
      },
      {
        title: "Larangan Keras: 'Join with us'",
        focusHighlight: "JANGAN: 'Join with us' → GUNAKAN: 'Join us' = 'JOIN AS'",
        easyPhonetic: "Panduan Ejaan Santai: Langsung ucapkan 'Join us' (Tanpa kata 'with')",
        explanation: "Kata kerja 'Join' sudah otomatis berarti 'bergabung dengan'. Jangan menambahkan kata 'with'!",
        wrongAudio: {
          label: "BUNYI SALAH (Pemborosan Kata):",
          text: "Please join with our community",
          sampleText: "Please join with our community today.",
          explanation: "Menambahkan kata 'with' yang tidak diperlukan.",
        },
        correctAudio: {
          label: "BUNYI BENAR (Ringkas & Tepat):",
          text: "Please join our community / Join us",
          sampleText: "Please join our community and join us for lunch today.",
          explanation: "Langsung sebutkan objek setelah kata join: 'Join us', 'Join the meeting'.",
        },
        tongueTip: "Ingat: Join langsung diikuti nama kelompok atau orang.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah ajakan bergabung yang benar?",
          options: [
            {
              text: "Ajakan 'Please join our team for lunch'",
              subtext: "Langsung menyebutkan objek tanpa 'with' (Benar)",
              soundSample: "Please join our team for lunch.",
              isCorrect: true,
            },
            {
              text: "Ajakan 'Please join with our team for lunch'",
              subtext: "Pemborosan kata 'with' (Salah)",
              soundSample: "Please join with our team for lunch.",
              isCorrect: false,
            },
          ],
          explanation: "Kata 'Join' tidak membutuhkan preposisi 'with'. Cukup 'Join our team'.",
        },
      },
    ],
    exam: [
      {
        question: "Dengarkan audio di bawah. Manakah kalimat persetujuan yang benar?",
        options: [
          { text: "I agree with your decision", subtext: "Ejaan: 'AI E-GRI'", soundSample: "I agree with your decision." },
          { text: "I am agree with your decision", subtext: "Ejaan keliru dengan 'am'", soundSample: "I am agree with your decision." },
        ],
        correctIndex: 0,
        explanation: "'Agree' adalah kata kerja, jadi langsung 'I agree'.",
      },
      {
        question: "Dengarkan audio di bawah. Manakah ucapan 'terima kasih sebelumnya' yang benar?",
        options: [
          { text: "Thanks in advance for your support", subtext: "Ejaan: 'TENGKS IN ED-VANS'", soundSample: "Thanks in advance for your support." },
          { text: "Thanks before for your support", subtext: "Terjemahan harfiah keliru", soundSample: "Thanks before for your support." },
        ],
        correctIndex: 0,
        explanation: "'Thanks in advance' adalah standar baku universal.",
      },
    ],
  },
  {
    id: 4,
    percentage: 75,
    title: "Tahap 4: Formula 3 Pola Kalimat Refleks",
    subtitle: "Pola Waktu Spontan & Kesopanan Tingkat Tinggi",
    badge: "60% → 75%",
    summary: "Bicara spontan dengan 3 pola waktu utama dan kuasai cara meminta tolong atau menolak dengan sopan ala profesional.",
    steps: [
      {
        title: "Pola Masa Lalu Spontan (Verb 2)",
        focusHighlight: "Yesterday → Gunakan Verb 2 (Went, Met, Saw, Bought)",
        easyPhonetic: "Panduan Ejaan Santai: Cerita masa lalu langsung reflek pakai kata kerja lampau",
        explanation: "Saat menceritakan apa yang terjadi tadi pagi atau kemarin, ubah kata kerja ke bentuk lampau secara otomatis.",
        wrongAudio: {
          label: "BUNYI SALAH (Tenses Keliru):",
          text: "Yesterday I go to office and buy lunch",
          sampleText: "Yesterday I go to office and buy lunch.",
          explanation: "Memakai kata kerja waktu sekarang (V1) untuk cerita masa lalu.",
        },
        correctAudio: {
          label: "BUNYI BENAR (Past Tense Refleks):",
          text: "Yesterday I went to the office and bought lunch",
          sampleText: "Yesterday I went to the office, met the client, and bought lunch.",
          explanation: "Menggunakan Verb 2 (went, met, bought).",
        },
        tongueTip: "Latihlah reflek kata kerja lampau umum: Go → Went, Make → Made, Take → Took.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah cerita masa lalu yang benar?",
          options: [
            {
              text: "Cerita 'Yesterday I went to the office and met our client'",
              subtext: "Menggunakan Verb 2 (went & met) secara tepat (Benar)",
              soundSample: "Yesterday I went to the office and met our client.",
              isCorrect: true,
            },
            {
              text: "Cerita 'Yesterday I go to the office and meet our client'",
              subtext: "Menggunakan Verb 1 sekarang untuk masa lalu (Salah)",
              soundSample: "Yesterday I go to the office and meet our client.",
              isCorrect: false,
            },
          ],
          explanation: "Masa lalu wajib menggunakan bentuk lampau: 'went' dan 'met'.",
        },
      },
      {
        title: "Pola Bertanya & Meminta Sangat Sopan",
        focusHighlight: "Could you please...? = 'KUD YU PLIZ...?'",
        easyPhonetic: "Panduan Ejaan Santai: Gunakan 'Could you please...' untuk meminta tolong dengan anggun",
        explanation: "Hindari kalimat perintah langsung 'I want' atau 'Give me'. Gunakan modal verbs yang anggun.",
        wrongAudio: {
          label: "BUNYI KASAR (Perintah Langsung):",
          text: "Give me that report / I want your help",
          sampleText: "Give me that report right now.",
          explanation: "Terdengar kasar dan menuntut dalam budaya internasional.",
        },
        correctAudio: {
          label: "BUNYI ANGGUN (Polite Request):",
          text: "Could you please share that report when you have time?",
          sampleText: "Could you please share that report whenever you have a moment?",
          explanation: "Membuat lawan bicara merasa dihargai dan senang membantu.",
        },
        tongueTip: "'Could you please...' dan 'Would you mind...' adalah standar kesopanan global.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah permintaan tolong yang paling sopan?",
          options: [
            {
              text: "Permintaan 'Could you please review this draft whenever you have time?'",
              subtext: "Bahasa santun dan sangat profesional (Benar)",
              soundSample: "Could you please review this draft whenever you have time?",
              isCorrect: true,
            },
            {
              text: "Permintaan 'Give me your draft review now'",
              subtext: "Perintah kasar dan tidak sopan (Salah)",
              soundSample: "Give me your draft review now.",
              isCorrect: false,
            },
          ],
          explanation: "'Could you please...' adalah bentuk permintaan tolong yang santun dan profesional.",
        },
      },
    ],
    exam: [
      {
        question: "Dengarkan audio di bawah. Manakah kalimat permintaan tolong yang paling sopan?",
        options: [
          { text: "Could you please help me with this when you are free?", subtext: "Permintaan santun dengan 'Could you please'", soundSample: "Could you please help me with this when you are free?" },
          { text: "You must help me right now", subtext: "Perintah menuntut dan kasar", soundSample: "You must help me right now." },
        ],
        correctIndex: 0,
        explanation: "'Could you please help me...' adalah standar emas komunikasi sopan.",
      },
    ],
  },
  {
    id: 5,
    percentage: 90,
    title: "Tahap 5: 100 Frasa Wajib Bertahan Hidup Global",
    subtitle: "Meeting Remote, Traveling, Kafe & Small Talk",
    badge: "75% → 90%",
    summary: "Frasa emas siap pakai untuk situasi kerja internasional, kafe luar negeri, dan obrolan sehari-hari.",
    steps: [
      {
        title: "Frasa Meeting Online & Kerja Remote",
        focusHighlight: "Can everyone see my screen? • You are on mute!",
        easyPhonetic: "Panduan Ejaan Santai: 'KEN EV-RI-WAN SI MAI SKRIN? YU AR ON MYUT'",
        explanation: "Kuasai frasa penting saat memimpin atau mengikuti meeting online jarak jauh.",
        wrongAudio: {
          label: "BUNYI KELIRU:",
          text: "You hear me? / Look my screen",
          sampleText: "You hear me? Look my screen now.",
          explanation: "Tata bahasa janggal saat online meeting.",
        },
        correctAudio: {
          label: "BUNYI PROFESIONAL:",
          text: "Can everyone see my screen? Sarah, you are on mute.",
          sampleText: "Can everyone see my screen? Sarah, you are currently on mute.",
          explanation: "Frasa standar universal yang dipakai semua profesional global.",
        },
        tongueTip: "'Let's circle back' artinya mari kita bahas topik ini lagi nanti.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah frasa meeting online yang tepat?",
          options: [
            {
              text: "Frasa 'Can everyone see my screen? You are currently on mute.'",
              subtext: "Standar universal meeting online internasional (Benar)",
              soundSample: "Can everyone see my screen? You are currently on mute.",
              isCorrect: true,
            },
            {
              text: "Frasa 'Look to my screen all, your mic is broken'",
              subtext: "Tata bahasa rancu dan tidak baku (Salah)",
              soundSample: "Look to my screen all, your mic is broken.",
              isCorrect: false,
            },
          ],
          explanation: "'Can everyone see my screen?' dan 'You are on mute' adalah standar universal.",
        },
      },
    ],
    exam: [
      {
        question: "Saat memesan kopi dan ingin dibungkus bawa pulang, apa yang harus kamu katakan?",
        options: [
          { text: "Can I get an iced latte to go, please?", subtext: "Frasa 'to go' untuk pesanan bungkus", soundSample: "Can I get an iced latte to go, please?" },
          { text: "I want coffee wrap to home", subtext: "Terjemahan harfiah keliru", soundSample: "I want coffee wrap to home." },
        ],
        correctIndex: 0,
        explanation: "'To go' adalah istilah universal untuk makanan/minuman yang dibawa pulang.",
      },
    ],
  },
  {
    id: 6,
    percentage: 100,
    title: "Tahap 6: Ujian Kelulusan 100% Master",
    subtitle: "Tantangan Komprehensif Mengunci Status Fluent",
    badge: "90% → 100%",
    summary: "Selesaikan tantangan komprehensif untuk membuka sertifikasi penguasaan 100% di Rapor Belajar lo!",
    steps: [
      {
        title: "Instruksi Ujian Akhir",
        focusHighlight: "Uji seluruh materi: Fonetik, Connected Speech, Larangan Indoglish & Frasa Profesional",
        easyPhonetic: "Panduan Ejaan Santai: Dengarkan dengan saksama dan pilih kalimat yang 100% akurat",
        explanation: "Dengarkan rekaman audio di bawah dengan teliti untuk membuktikan kelayakanmu sebagai 100% English Master.",
        wrongAudio: {
          label: "CONTOH KELIRU:",
          text: "I am agree with you and thanks before.",
          sampleText: "I am agree with you and thanks before.",
          explanation: "Kesalahan fatal Indoglish yang harus dihindari.",
        },
        correctAudio: {
          label: "CONTOH MASTER 100%:",
          text: "Could you please share the report? Thanks in advance!",
          sampleText: "Could you please share the report? Thanks in advance!",
          explanation: "Pengucapan dan tata bahasa sempurna ala profesional.",
        },
        tongueTip: "Ingat kembali seluruh aturan fonetik dan larangan kata di tahap 1 sampai 5.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah kalimat master yang 100% sempurna?",
          options: [
            {
              text: "Kalimat 'Could you please lend me the report? Thanks in advance.'",
              subtext: "Menggunakan 'lend', 'could you please', dan 'thanks in advance' (Sempurna)",
              soundSample: "Could you please lend me the report? Thanks in advance.",
              isCorrect: true,
            },
            {
              text: "Kalimat 'Please borrow me the report and thanks before.'",
              subtext: "Tertukar 'borrow' dan memakai 'thanks before' (Salah)",
              soundSample: "Please borrow me the report and thanks before.",
              isCorrect: false,
            },
          ],
          explanation: "Kalimat opsi 1 menggunakan 'lend', 'could you please', dan 'thanks in advance' secara sempurna.",
        },
      },
    ],
    exam: [
      {
        question: "Dengarkan audio di bawah. Manakah kalimat yang 100% BENAR secara tata bahasa dan etika profesional?",
        options: [
          { text: "Could you please lend me the project report when you have a moment?", subtext: "Tata bahasa & kesopanan sempurna", soundSample: "Could you please lend me the project report when you have a moment?" },
          { text: "I am agree with you and thanks before for your help", subtext: "Kesalahan Indoglish fatal", soundSample: "I am agree with you and thanks before for your help." },
        ],
        correctIndex: 0,
        explanation: "'Could you please lend me...' adalah kalimat sempurna tanpa kesalahan Indoglish.",
      },
    ],
  },
];

export function LancarBahasa({ cost = 2, credits = 0 }: { cost?: number; credits?: number }) {
  const [mode, setMode] = useState<Mode>("academy");
  const [level, setLevel] = useState<Level>("intermediate");
  const [persona, setPersona] = useState<Persona>("sarah");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Audio Gated Academy States
  const [activeStageId, setActiveStageId] = useState<number>(1);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isExamMode, setIsExamMode] = useState<boolean>(false);
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [examSubmitted, setExamSubmitted] = useState<boolean>(false);
  const [drillAnswer, setDrillAnswer] = useState<number | null>(null);
  const [currentlyPlayingAudioText, setCurrentlyPlayingAudioText] = useState<string | null>(null);

  const [completedStages, setCompletedStages] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("malesan_english_completed_stages");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Voice & Roleplay Call States
  const [isCalling, setIsCalling] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTip, setActiveTip] = useState<string | null>(null);
  const [activeRoast, setActiveRoast] = useState<string | null>(null);
  const [showCallSummary, setShowCallSummary] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});

  // Active Roleplay Scenario State
  const [activeScenario, setActiveScenario] = useState<ScenarioItem | null>(null);
  const [completedMissions, setCompletedMissions] = useState<Record<number, boolean>>({});

  // Audio Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const capturedTextRef = useRef<string>("");

  // Quiz States
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizTopic, setQuizTopic] = useState("grammar_tenses");
  const [quizCount, setQuizCount] = useState<number>(5);

  // Essay States
  const [essayTopic, setEssayTopic] = useState(ESSAY_TOPICS[0]);
  const [essayText, setEssayText] = useState("");
  const [essayLoading, setEssayLoading] = useState(false);
  const [essayResult, setEssayResult] = useState<EssayEvaluation | null>(null);

  // Progress & Learning Analytics State (Stored in LocalStorage)
  const [records, setRecords] = useState<SessionRecord[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("malesan_english_records");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save record helper
  const saveSessionRecord = useCallback((rec: Omit<SessionRecord, "id" | "timestamp">) => {
    const newRec: SessionRecord = {
      ...rec,
      id: makeId("rec"),
      timestamp: Date.now(),
    };
    setRecords((prev) => {
      const updated = [newRec, ...prev].slice(0, 50);
      try {
        localStorage.setItem("malesan_english_records", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // Play Speech Audio via /api/tts with browser fallback
  const playSpeechAudio = useCallback(
    async (text: string, customPersona?: Persona) => {
      const activeP = customPersona || persona;
      setCurrentlyPlayingAudioText(text);
      try {
        if (currentAudioElementRef.current) {
          currentAudioElementRef.current.pause();
          currentAudioElementRef.current = null;
        }

        setIsPlayingAudio(true);
        const langCode = activeP === "sarah" || activeP === "emma" ? "en-GB" : "en-US";

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, lang: langCode }),
        });

        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.playbackRate = playbackSpeed;
          currentAudioElementRef.current = audio;
          audio.onended = () => {
            setIsPlayingAudio(false);
            setCurrentlyPlayingAudioText(null);
            URL.revokeObjectURL(url);
          };
          audio.onerror = () => {
            setIsPlayingAudio(false);
            setCurrentlyPlayingAudioText(null);
          };
          await audio.play();
          return;
        }
      } catch (err) {
        console.warn("API TTS playback failed, falling back to Web Speech:", err);
      }

      // Fallback: Web Speech Synthesis
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = activeP === "sarah" || activeP === "emma" ? "en-GB" : "en-US";
        utterance.rate = playbackSpeed * (level === "beginner" ? 0.85 : 1.0);
        utterance.onend = () => {
          setIsPlayingAudio(false);
          setCurrentlyPlayingAudioText(null);
        };
        utterance.onerror = () => {
          setIsPlayingAudio(false);
          setCurrentlyPlayingAudioText(null);
        };
        window.speechSynthesis.speak(utterance);
      } else {
        setIsPlayingAudio(false);
        setCurrentlyPlayingAudioText(null);
      }
    },
    [persona, level, playbackSpeed],
  );

  // Complete Stage by Passing Gate Exam
  const submitGateExam = (stage: AudioGatedStage) => {
    setExamSubmitted(true);
    let correctCount = 0;
    stage.exam.forEach((q, idx) => {
      if (examAnswers[idx] === q.correctIndex) correctCount++;
    });

    const passRate = correctCount / stage.exam.length;
    if (passRate >= 0.6) {
      if (!completedStages.includes(stage.id)) {
        const updated = [...completedStages, stage.id];
        setCompletedStages(updated);
        try {
          localStorage.setItem("malesan_english_completed_stages", JSON.stringify(updated));
        } catch {}
      }
      setFeedbackNotice(`LULUS! Selamat, kamu berhasil menyelesaikan ${stage.title}. Tahap berikutnya telah terbuka!`);

      saveSessionRecord({
        type: "academy",
        title: `Lulus: ${stage.title}`,
        score: Math.round(passRate * 100),
      });
    } else {
      setFeedbackNotice("Nilai kamu belum mencukupi untuk lulus. Silakan ulangi materi dan coba lagi!");
    }
  };

  // Timer Effect for Active Call / Roleplay
  useEffect(() => {
    if (!isCalling) return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isCalling]);

  // Audio Visualizer Waveform Animation Loop
  useEffect(() => {
    if (!isCalling) return;

    let animId: number;

    const renderWaveform = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const width = canvas.width;
          const height = canvas.height;
          const barWidth = 4;
          const gap = 3;
          const barCount = Math.floor(width / (barWidth + gap));
          const time = Date.now() * 0.005;

          for (let i = 0; i < barCount; i++) {
            const freq = Math.sin(time + i * 0.3) * 0.5 + 0.5;
            const barHeight = isRecording
              ? Math.max(8, freq * (height * 0.9))
              : isPlayingAudio
              ? Math.max(6, Math.sin(time * 3 + i * 0.4) * (height * 0.75))
              : isProcessing
              ? Math.max(4, Math.sin(time * 2 + i * 0.2) * (height * 0.45))
              : 4;

            const x = i * (barWidth + gap);
            const y = (height - barHeight) / 2;

            ctx.fillStyle = isRecording
              ? "#ef4444"
              : isPlayingAudio
              ? "#10b981"
              : isProcessing
              ? "#f59e0b"
              : "#3f3f46";
            ctx.fillRect(x, y, barWidth, barHeight);
          }
        }
      }
      animId = requestAnimationFrame(renderWaveform);
    };

    animId = requestAnimationFrame(renderWaveform);
    return () => cancelAnimationFrame(animId);
  }, [isCalling, isRecording, isProcessing, isPlayingAudio]);

  // Start Voice Call or Scenario Chamber
  const startCall = (scenarioItem?: ScenarioItem) => {
    if (credits < cost) {
      setFeedbackNotice(`Kredit lo kurang (${credits} tersisa). Butuh minimal ${cost} kredit.`);
      return;
    }
    const chosenPersona = scenarioItem ? scenarioItem.partner : persona;
    if (scenarioItem) {
      setActiveScenario(scenarioItem);
      setCompletedMissions({});
    } else {
      setActiveScenario(null);
    }

    setCallDuration(0);
    setIsCalling(true);
    setShowCallSummary(false);
    setFeedbackNotice(null);
    setTextInput("");
    capturedTextRef.current = "";

    const initialText = scenarioItem
      ? scenarioItem.id === "job_interview"
        ? "Hello and welcome. Thank you for joining our interview today. To start, could you please tell me about yourself and your professional background?"
        : scenarioItem.id === "airport_immigration"
        ? "Good day. Passport and entry declaration, please. What is the main purpose of your visit to London today?"
        : scenarioItem.id === "ordering_cafe"
        ? "Hey there! Welcome to Blue Bottle. What can I get started for you today?"
        : scenarioItem.id === "salary_negotiation"
        ? "Good morning. Thanks for setting up this 1-on-1 meeting. What would you like to discuss regarding your compensation?"
        : `Hello! Welcome to our ${scenarioItem.title}. How may I help you today?`
      : chosenPersona === "sarah"
      ? "Hello there! So lovely to talk with you today. How is your day going so far?"
      : chosenPersona === "alex"
      ? "Hey what is up! Super stoked to chat with you. What have you been working on lately?"
      : chosenPersona === "david"
      ? "Good day. Thank you for joining this session. Could you briefly introduce yourself?"
      : "Welcome to today's speaking preparation. Let us begin with your thoughts on our topic.";

    const initialTranslate = scenarioItem
      ? "Halo dan selamat datang. Ceritakan tentang dirimu dan latar belakang pekerjaanmu untuk memulai."
      : "Halo! Senang bisa berbicara denganmu hari ini. Bagaimana harimu sejauh ini?";

    const initialSuggestions: SuggestedReply[] = scenarioItem
      ? [
          { en: "I am a content creator and digital specialist.", id: "Saya seorang konten kreator dan spesialis digital." },
          { en: "I have worked on several global marketing projects.", id: "Saya telah mengerjakan beberapa proyek pemasaran global." },
          { en: "Could you tell me more about the role?", id: "Bisakah Anda jelaskan lebih banyak tentang posisi ini?" },
        ]
      : [
          { en: "I am doing great today, thanks for asking!", id: "Kabar saya sangat baik hari ini, terima kasih sudah bertanya!" },
          { en: "I have been quite busy with work today.", id: "Saya lumayan sibuk dengan pekerjaan hari ini." },
          { en: "Everything is going smoothly so far.", id: "Semuanya berjalan lancar sejauh ini." },
        ];

    setMessages([
      {
        id: "msg_init",
        role: "assistant",
        text: initialText,
        translateId: initialTranslate,
        suggestedReplies: initialSuggestions,
      },
    ]);

    // Auto-play voice greeting
    playSpeechAudio(initialText, chosenPersona);
  };

  // End Call & Save Progress
  const endCall = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (currentAudioElementRef.current) {
      currentAudioElementRef.current.pause();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsRecording(false);
    setIsCalling(false);
    setIsPlayingAudio(false);
    setShowCallSummary(true);

    // Save record to local progress analytics
    const userMsgs = messages.filter((m) => m.role === "user");
    const assistantScores = messages.filter((m) => m.score).map((m) => m.score as number);
    const avgScore = assistantScores.length
      ? Math.round(assistantScores.reduce((a, b) => a + b, 0) / assistantScores.length)
      : 80;
    const collectedPitfalls = messages.filter((m) => m.pitfallTag).map((m) => m.pitfallTag as string);

    if (userMsgs.length > 0) {
      saveSessionRecord({
        type: activeScenario ? "scenario" : "voice",
        title: activeScenario ? activeScenario.title : `Panggilan Suara (${persona.toUpperCase()})`,
        score: avgScore,
        durationSeconds: callDuration,
        pitfalls: collectedPitfalls,
      });
    }
  };

  // Toggle Recording
  const toggleRecording = async () => {
    if (isProcessing) return;

    if (isRecording) {
      setIsRecording(false);

      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }

      const recognized = capturedTextRef.current.trim() || textInput.trim();
      if (recognized) {
        await submitTextMessage(recognized);
      }
    } else {
      capturedTextRef.current = "";
      setTextInput("");
      setFeedbackNotice(null);

      const activeP = activeScenario ? activeScenario.partner : persona;

      // 1. Try Native Web Speech Recognition
      const SpeechRecognition =
        typeof window !== "undefined"
          ? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstanceLike; webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike }).SpeechRecognition ||
            (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstanceLike; webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike }).webkitSpeechRecognition
          : null;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = activeP === "sarah" || activeP === "emma" ? "en-GB" : "en-US";

          recognition.onresult = (event: SpeechRecognitionEventLike) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              transcript += event.results[i][0].transcript;
            }
            if (transcript.trim()) {
              capturedTextRef.current = transcript.trim();
              setTextInput(transcript.trim());
            }
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn("Speech recognition start failed:", e);
        }
      }

      // 2. Also start MediaRecorder for audio backup
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

        const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          if (!capturedTextRef.current.trim() && audioChunksRef.current.length > 0) {
            const audioBlob = new Blob(audioChunksRef.current, {
              type: mediaRecorder.mimeType || "audio/webm",
            });
            await submitAudioChunk(audioBlob);
          }
        };

        mediaRecorder.start(200);
        setIsRecording(true);
      } catch (err) {
        console.warn("Mic getUserMedia failed:", err);
        setIsRecording(true);
      }
    }
  };

  // Submit Audio Blob
  const submitAudioChunk = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setFeedbackNotice(null);
    const activeP = activeScenario ? activeScenario.partner : persona;
    const activeScenTitle = activeScenario ? activeScenario.title : "daily";

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "user_voice.webm");
      formData.append("persona", activeP);
      formData.append("level", level);
      formData.append("scenario", activeScenTitle);
      formData.append(
        "history",
        JSON.stringify(
          messages.map((m) => ({ role: m.role, text: m.text })),
        ),
      );

      const res = await fetch("/api/speaking/converse", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal memproses percakapan.");
      }

      const data = await res.json();

      const newMessages: ChatMessage[] = [
        ...messages,
        {
          id: makeId("usr"),
          role: "user",
          text: data.userTranscribedText,
        },
        {
          id: makeId("ast"),
          role: "assistant",
          text: data.replyEn,
          translateId: data.translateId,
          suggestedReplies: data.suggestedReplies,
          tip: data.correctionTip,
          pitfallTag: data.pitfallTag,
          roast: data.roastComment,
          score: data.fluencyScore,
        },
      ];

      setMessages(newMessages);
      if (data.correctionTip) setActiveTip(data.correctionTip);
      if (data.roastComment) setActiveRoast(data.roastComment);

      if (activeScenario) {
        const userMsgCount = newMessages.filter((m) => m.role === "user").length;
        if (userMsgCount >= 1) setCompletedMissions((prev) => ({ ...prev, 0: true }));
        if (userMsgCount >= 2) setCompletedMissions((prev) => ({ ...prev, 1: true }));
        if (userMsgCount >= 3) setCompletedMissions((prev) => ({ ...prev, 2: true }));
      }

      playSpeechAudio(data.replyEn, activeP);
    } catch (err) {
      setFeedbackNotice(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit Text Input Message
  const submitTextMessage = async (explicitText?: string) => {
    const userText = (explicitText || textInput).trim();
    if (!userText || isProcessing) return;

    setTextInput("");
    capturedTextRef.current = "";
    setIsProcessing(true);
    setFeedbackNotice(null);

    const activeP = activeScenario ? activeScenario.partner : persona;
    const activeScenTitle = activeScenario ? activeScenario.title : "daily";

    try {
      const res = await fetch("/api/speaking/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          persona: activeP,
          level,
          scenario: activeScenTitle,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal memproses percakapan.");
      }

      const data = await res.json();

      const newMessages: ChatMessage[] = [
        ...messages,
        {
          id: makeId("usr"),
          role: "user",
          text: userText,
        },
        {
          id: makeId("ast"),
          role: "assistant",
          text: data.replyEn,
          translateId: data.translateId,
          suggestedReplies: data.suggestedReplies,
          tip: data.correctionTip,
          pitfallTag: data.pitfallTag,
          roast: data.roastComment,
          score: data.fluencyScore,
        },
      ];

      setMessages(newMessages);
      if (data.correctionTip) setActiveTip(data.correctionTip);
      if (data.roastComment) setActiveRoast(data.roastComment);

      if (activeScenario) {
        const userMsgCount = newMessages.filter((m) => m.role === "user").length;
        if (userMsgCount >= 1) setCompletedMissions((prev) => ({ ...prev, 0: true }));
        if (userMsgCount >= 2) setCompletedMissions((prev) => ({ ...prev, 1: true }));
        if (userMsgCount >= 3) setCompletedMissions((prev) => ({ ...prev, 2: true }));
      }

      playSpeechAudio(data.replyEn, activeP);
    } catch (err) {
      setFeedbackNotice(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses percakapan.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate Dynamic Fresh Quiz
  const handleGenerateQuiz = async () => {
    if (credits < cost) {
      setFeedbackNotice(`Kredit lo kurang (${credits} tersisa). Butuh minimal ${cost} kredit.`);
      return;
    }
    setQuizLoading(true);
    setQuizFinished(false);
    setSelectedAnswers({});
    setCurrentQuestionIdx(0);
    setFeedbackNotice(null);
    try {
      const res = await fetch("/api/speaking/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          topic: quizTopic,
          count: quizCount,
          seed: makeId("seed"),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal membuat kuis.");
      }
      const data = await res.json();
      setQuizQuestions(data.questions || []);
    } catch (err) {
      setFeedbackNotice(err instanceof Error ? err.message : "Gagal memuat kuis.");
    } finally {
      setQuizLoading(false);
    }
  };

  // Complete Quiz & Record Progress
  const finishQuiz = () => {
    setQuizFinished(true);
    let correctCount = 0;
    quizQuestions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) correctCount++;
    });
    const finalScore = Math.round((correctCount / quizQuestions.length) * 100);

    saveSessionRecord({
      type: "quiz",
      title: `Kuis Kilat (${quizTopic})`,
      score: finalScore,
    });
  };

  // Evaluate Essay
  const handleEvaluateEssay = async () => {
    if (credits < cost) {
      setFeedbackNotice(`Kredit lo kurang (${credits} tersisa). Butuh minimal ${cost} kredit.`);
      return;
    }
    if (!essayText.trim() || essayText.trim().length < 20) {
      setFeedbackNotice("Tulis esai minimal 20 karakter sebelum dievaluasi.");
      return;
    }

    setEssayLoading(true);
    setEssayResult(null);
    setFeedbackNotice(null);
    try {
      const res = await fetch("/api/speaking/essay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, topic: essayTopic, essayText }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal mengevaluasi esai.");
      }
      const data = await res.json();
      setEssayResult(data.data);
      setFeedbackNotice("Evaluasi esai berhasil diselesaikan.");

      saveSessionRecord({
        type: "essay",
        title: `Ujian Esai: ${essayTopic.slice(0, 24)}...`,
        score: data.data.overallScore100 || 80,
      });
    } catch (err) {
      setFeedbackNotice(err instanceof Error ? err.message : "Gagal mengevaluasi esai.");
    } finally {
      setEssayLoading(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Aggregated Analytics
  const totalMinutesSpoken = Math.round(
    records.filter((r) => r.durationSeconds).reduce((a, b) => a + (b.durationSeconds || 0), 0) / 60,
  );
  const avgOverallScore = records.length
    ? Math.round(records.reduce((a, b) => a + b.score, 0) / records.length)
    : 82;

  // Curriculum Mastery Percentage Calculation
  const masteryPercentage = Math.round((completedStages.length / 6) * 100);

  // Most common grammar pitfall tags
  const pitfallCounts: Record<string, number> = {};
  records.forEach((r) => {
    r.pitfalls?.forEach((p) => {
      pitfallCounts[p] = (pitfallCounts[p] || 0) + 1;
    });
  });
  const topPitfalls = Object.entries(pitfallCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const activeStage = AUDIO_GATED_STAGES.find((s) => s.id === activeStageId) || AUDIO_GATED_STAGES[0];
  const activeStep = activeStage.steps[activeStepIndex] || activeStage.steps[0];

  return (
    <div className="w-full space-y-4">
      {/* GLOBAL NOTIFICATION NOTICE */}
      {feedbackNotice && (
        <div className="rounded-2xl border border-ember/40 bg-ember/15 p-3.5 sm:p-4 text-xs sm:text-sm font-medium text-ember flex items-center justify-between animate-in fade-in duration-200">
          <span>{feedbackNotice}</span>
          <button
            onClick={() => setFeedbackNotice(null)}
            className="text-micro font-bold underline hover:opacity-80 ml-4 shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* TOP HEADER CONTAINER */}
      <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/85 p-4 sm:p-5 backdrop-blur-xl shadow-lg space-y-4">
        {/* Title & Level Selector Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/35 bg-ember/15 px-3 py-0.5 text-[11px] font-bold text-ember uppercase tracking-wider">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3 text-ember">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
                AI English Master Studio
              </span>
              <span className="text-[11px] font-mono font-bold text-muted bg-surface-raised px-2.5 py-0.5 rounded-md border border-hairline">
                {cost} Kredit / Sesi
              </span>
            </div>

            <h1 className="font-display text-lg sm:text-xl font-bold text-ink tracking-tight">
              Lancar Inggris
            </h1>
            <p className="text-xs text-muted leading-relaxed">
              Drill telinga interaktif (audio salah vs benar), latihan bicara AI native, roleplay skenario nyata, dan evaluasi esai.
            </p>
          </div>

          {/* LEVEL SELECTOR SEGMENTED CONTROL */}
          <div className="w-full lg:w-auto shrink-0">
            <div className="grid grid-cols-3 lg:flex items-center gap-1 rounded-2xl border border-hairline bg-surface-raised/90 p-1 shadow-xs">
              {[
                { id: "beginner", name: "Pemula", cefr: "A1-A2" },
                { id: "intermediate", name: "Menengah", cefr: "B1-B2" },
                { id: "advanced", name: "Mahir", cefr: "C1-C2" },
              ].map((lvl) => {
                const isActive = level === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    onClick={() => setLevel(lvl.id as Level)}
                    className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
                      isActive
                        ? "bg-ember text-obsidian shadow-sm ring-1 ring-ember/50 font-display"
                        : "text-muted hover:text-ink hover:bg-surface"
                    }`}
                  >
                    <span>{lvl.name}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                        isActive ? "bg-obsidian/20 text-obsidian font-bold" : "bg-surface text-muted/80 border border-hairline/60"
                      }`}
                    >
                      {lvl.cefr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 6 STREAMLINED SUB-MODULE NAVIGATION TABS */}
        <div className="border-t border-hairline/60 pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              {
                id: "academy",
                label: "Belajar 0-100%",
                sub: "Audio Drills",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                    <path d="M6 6h10" />
                    <path d="M6 10h10" />
                  </svg>
                ),
              },
              {
                id: "voice",
                label: "Bicara AI",
                sub: "Live Speaking",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                ),
              },
              {
                id: "scenario",
                label: "Roleplay",
                sub: "Simulasi Skenario",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                ),
              },
              {
                id: "quiz",
                label: "Kuis",
                sub: "Kuis Kilat Pro",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                ),
              },
              {
                id: "essay",
                label: "Esai",
                sub: "Ujian & IELTS",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                ),
              },
              {
                id: "progress",
                label: "Rapor",
                sub: "Riwayat & Nilai",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                    <path d="M3 3v18h18" />
                    <path d="m19 9-5 5-4-4-3 3" />
                  </svg>
                ),
              },
            ].map((tab) => {
              const isCurrent = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (isCalling) endCall();
                    setMode(tab.id as Mode);
                  }}
                  className={`h-12 rounded-2xl border p-2 transition-all text-left flex items-center gap-2 w-full ${
                    isCurrent
                      ? "border-ember/70 bg-ember/15 text-ink shadow-sm ring-1 ring-ember/30"
                      : "border-hairline bg-surface hover:border-hairline/90 hover:bg-surface-raised text-muted"
                  }`}
                >
                  <div
                    className={`size-7 shrink-0 rounded-xl flex items-center justify-center ${
                      isCurrent ? "bg-ember text-obsidian font-bold" : "bg-surface-raised border border-hairline text-muted"
                    }`}
                  >
                    {tab.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs font-bold block truncate ${isCurrent ? "text-ember" : "text-ink"}`}>
                      {tab.label}
                    </span>
                    <span className="text-[10px] text-muted block truncate">{tab.sub}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 0: BELAJAR 0-100% (DUAL-AUDIO EAR TRAINING DRILL ENGINE) */}
      {/* ========================================================================= */}
      {mode === "academy" && (
        <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/90 p-4 sm:p-6 backdrop-blur-xl shadow-xl space-y-5">
          {/* Stage Progression Stepper Map (GATED / LOCKED SYSTEM) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-ember uppercase tracking-wider">
                  Ear-Training Audio Validation Engine
                </span>
                <h2 className="font-display text-base sm:text-lg font-bold text-ink mt-0.5">
                  Belajar 0% ke 100% (Latihan Telinga &amp; Pelafalan Riil)
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Dengarkan perbandingan audio salah vs benar, jawab tes pemahaman suara, dan luluskan tahap untuk membuka materi berikutnya.
                </p>
              </div>

              {/* Progress Metric Badge */}
              <div className="flex items-center gap-3 rounded-2xl border border-ember/30 bg-ember/10 p-2.5 self-start sm:self-auto shrink-0">
                <div className="size-9 rounded-xl bg-ember flex items-center justify-center text-obsidian font-display font-bold text-xs">
                  {masteryPercentage}%
                </div>
                <div>
                  <p className="text-micro font-bold text-muted uppercase">Penguasaan</p>
                  <p className="text-xs font-bold text-ink">{completedStages.length} / 6 Tahap Tuntas</p>
                </div>
              </div>
            </div>

            {/* Stepper Stage Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {AUDIO_GATED_STAGES.map((stg) => {
                const isCompleted = completedStages.includes(stg.id);
                const isUnlocked = stg.id === 1 || completedStages.includes(stg.id - 1) || isCompleted;
                const isCurrent = activeStageId === stg.id;

                let borderStyle = "border-hairline bg-surface-raised/40 opacity-60";
                if (isCurrent) borderStyle = "border-ember bg-ember/15 ring-1 ring-ember/50 shadow-sm opacity-100";
                else if (isCompleted) borderStyle = "border-emerald-500/40 bg-emerald-500/10 opacity-100";
                else if (isUnlocked) borderStyle = "border-hairline bg-surface hover:border-hairline/90 opacity-100";

                return (
                  <button
                    key={stg.id}
                    disabled={!isUnlocked}
                    onClick={() => {
                      setActiveStageId(stg.id);
                      setActiveStepIndex(0);
                      setIsExamMode(false);
                      setExamSubmitted(false);
                      setExamAnswers({});
                      setDrillAnswer(null);
                    }}
                    className={`rounded-2xl border p-2.5 text-left transition-all relative flex flex-col justify-between h-20 ${borderStyle}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-muted">{stg.badge}</span>
                      {isCompleted ? (
                        <span className="size-4 rounded-full bg-emerald-400 text-obsidian text-[10px] font-bold flex items-center justify-center">
                          ✓
                        </span>
                      ) : !isUnlocked ? (
                        <span className="text-[10px] text-muted font-bold">🔒</span>
                      ) : isCurrent ? (
                        <span className="size-2 rounded-full bg-ember animate-ping" />
                      ) : null}
                    </div>
                    <div>
                      <p className={`text-xs font-bold line-clamp-2 ${isCurrent ? "text-ember" : "text-ink"}`}>
                        {stg.title.split(":")[1] || stg.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTIVE STAGE DRILL CHAMBER */}
          <div className="border-t border-hairline/60 pt-4 space-y-4">
            {!isExamMode ? (
              /* LESSON STEP VIEW (DUAL-AUDIO COMPARISON + INTERACTIVE EAR TRAINING) */
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Step Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-raised/60 p-3.5 rounded-2xl border border-hairline">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-ember bg-ember/15 px-2 py-0.5 rounded-md">
                        Langkah {activeStepIndex + 1} dari {activeStage.steps.length}
                      </span>
                      <span className="text-xs font-bold text-ink">{activeStage.title}</span>
                    </div>
                    <h3 className="font-display text-sm sm:text-base font-bold text-ink mt-1">
                      {activeStep.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => setIsExamMode(true)}
                    className="h-8 px-3 rounded-xl border border-ember/40 bg-ember/10 text-ember text-xs font-bold hover:bg-ember/20 transition-all self-start sm:self-auto shrink-0"
                  >
                    Langsung Ujian Tahap Ini →
                  </button>
                </div>

                {/* Big Interactive Focus Arena */}
                <div className="rounded-3xl border border-ember/30 bg-gradient-to-b from-surface-raised to-surface p-4 sm:p-6 space-y-5 shadow-md">
                  {/* Focus Header without IPA Jargon */}
                  <div className="space-y-1.5 border-b border-hairline/60 pb-3.5">
                    <p className="text-micro font-bold text-muted uppercase tracking-wider">Fokus Bunyi &amp; Pelafalan:</p>
                    <h4 className="font-display text-base sm:text-xl font-bold text-ember">
                      {activeStep.focusHighlight}
                    </h4>
                    <p className="text-xs font-medium text-ink bg-surface-raised px-3 py-1.5 rounded-xl border border-hairline inline-block">
                      {activeStep.easyPhonetic}
                    </p>
                    <p className="text-xs text-muted mt-1 leading-relaxed">{activeStep.explanation}</p>
                  </div>

                  {/* DUAL-AUDIO COMPARISON (DENGARKAN BUNYI SALAH VS BUNYI BENAR) */}
                  <div className="space-y-2">
                    <span className="text-micro font-bold text-muted uppercase tracking-wider block">
                      Dengarkan Perbandingan Suara (Klik Tombol di Bawah):
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* WRONG AUDIO CARD */}
                      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                              {activeStep.wrongAudio.label}
                            </span>
                            <span className="size-2 rounded-full bg-rose-500" />
                          </div>
                          <p className="text-xs font-bold text-ink">{activeStep.wrongAudio.text}</p>
                          <p className="text-micro text-muted leading-relaxed">{activeStep.wrongAudio.explanation}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => playSpeechAudio(activeStep.wrongAudio.sampleText)}
                          className="h-10 px-4 rounded-xl border border-rose-500/40 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </svg>
                          {currentlyPlayingAudioText === activeStep.wrongAudio.sampleText ? "Sedang Memutar..." : "Putar Bunyi Salah"}
                        </button>
                      </div>

                      {/* CORRECT AUDIO CARD */}
                      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                              {activeStep.correctAudio.label}
                            </span>
                            <span className="size-2 rounded-full bg-emerald-400" />
                          </div>
                          <p className="text-xs font-bold text-ink">{activeStep.correctAudio.text}</p>
                          <p className="text-micro text-muted leading-relaxed">{activeStep.correctAudio.explanation}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => playSpeechAudio(activeStep.correctAudio.sampleText)}
                          className="btn-ember h-10 px-4 rounded-xl text-obsidian text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:brightness-105 cursor-pointer"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </svg>
                          {currentlyPlayingAudioText === activeStep.correctAudio.sampleText ? "Sedang Memutar..." : "Putar Bunyi Benar (Bule)"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tongue Tip */}
                  <div className="rounded-2xl border border-hairline bg-surface-raised p-3 text-xs text-muted flex items-start gap-2">
                    <span className="text-ember font-bold shrink-0">💡</span>
                    <p><b>Tips Emas Posisi Lidah:</b> {activeStep.tongueTip}</p>
                  </div>

                  {/* LUMINOUS ALIVE INTERACTIVE EAR-TRAINING VALIDATION DRILL */}
                  <div className="rounded-3xl border border-ember/35 bg-surface-raised/80 p-4 sm:p-5 space-y-3.5 shadow-sm">
                    <div>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ember uppercase tracking-wider">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5 text-ember">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        Uji Pemahaman Suara (Klik Kartu Jawaban):
                      </span>
                      <p className="font-display text-xs sm:text-sm font-bold text-ink mt-1 leading-relaxed">
                        {activeStep.audioDrill.prompt}
                      </p>
                    </div>

                    {/* Highly Interactive, Alive Choice Cards */}
                    <div className="space-y-2.5">
                      {activeStep.audioDrill.options.map((opt, optIdx) => {
                        const isChosen = drillAnswer === optIdx;
                        const isRight = opt.isCorrect;

                        let cardStyle = "border-hairline/90 bg-surface hover:border-ember/70 hover:bg-surface-raised hover:shadow-md";
                        if (drillAnswer !== null) {
                          if (isRight) cardStyle = "border-emerald-500 bg-emerald-500/20 shadow-md ring-2 ring-emerald-500/40 text-emerald-300 font-bold";
                          else if (isChosen) cardStyle = "border-rose-500 bg-rose-500/20 shadow-md ring-2 ring-rose-500/40 text-rose-300 font-bold";
                          else cardStyle = "border-hairline/40 bg-surface/40 opacity-50";
                        }

                        return (
                          <div
                            key={optIdx}
                            onClick={() => {
                              if (drillAnswer === null) setDrillAnswer(optIdx);
                            }}
                            className={`rounded-2xl border p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all cursor-pointer group ${cardStyle}`}
                          >
                            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                              {/* Round Badge Indicator */}
                              <div
                                className={`size-8 rounded-full flex items-center justify-center font-display font-bold text-xs shrink-0 transition-all ${
                                  drillAnswer !== null && isRight
                                    ? "bg-emerald-400 text-obsidian font-bold"
                                    : drillAnswer !== null && isChosen
                                    ? "bg-rose-500 text-white font-bold"
                                    : "bg-surface-raised border border-hairline group-hover:border-ember group-hover:text-ember text-muted"
                                }`}
                              >
                                {drillAnswer !== null && isRight ? "✓" : drillAnswer !== null && isChosen ? "✕" : String.fromCharCode(65 + optIdx)}
                              </div>

                              <div className="min-w-0 flex-1 space-y-0.5">
                                <p className="text-xs sm:text-sm font-bold text-ink group-hover:text-ember transition-colors">
                                  {opt.text}
                                </p>
                                <p className="text-[11px] text-muted leading-tight">
                                  {opt.subtext}
                                </p>
                              </div>
                            </div>

                            {/* Prominent Audio Trigger Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playSpeechAudio(opt.soundSample);
                              }}
                              className="btn-ember h-9 px-3.5 rounded-xl text-obsidian text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto shadow-sm hover:brightness-105"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                              </svg>
                              <span>{currentlyPlayingAudioText === opt.soundSample ? "Memutar..." : "Putar Suara"}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {drillAnswer !== null && (
                      <div className="rounded-2xl border border-hairline bg-surface p-4 text-xs leading-relaxed animate-in fade-in duration-200 space-y-1">
                        <p className={`font-display text-sm font-bold ${activeStep.audioDrill.options[drillAnswer].isCorrect ? "text-emerald-400" : "text-rose-400"}`}>
                          {activeStep.audioDrill.options[drillAnswer].isCorrect ? "Jawaban 100% Valid & Tepat!" : "Jawaban Kurang Tepat!"}
                        </p>
                        <p className="text-muted">
                          <b>Penjelasan Lengkap:</b> {activeStep.audioDrill.explanation}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Navigation Stepper Controls */}
                  <div className="flex items-center justify-between pt-3 border-t border-hairline/60">
                    <button
                      disabled={activeStepIndex === 0}
                      onClick={() => {
                        setActiveStepIndex((prev) => prev - 1);
                        setDrillAnswer(null);
                      }}
                      className="h-10 px-4 rounded-xl border border-hairline bg-surface text-xs font-bold text-ink hover:bg-surface-raised disabled:opacity-30 cursor-pointer"
                    >
                      ← Langkah Sebelumnya
                    </button>

                    {activeStepIndex < activeStage.steps.length - 1 ? (
                      <button
                        onClick={() => {
                          setActiveStepIndex((prev) => prev + 1);
                          setDrillAnswer(null);
                        }}
                        className="btn-ember h-10 px-5 rounded-xl font-display text-xs font-bold text-obsidian shadow-md cursor-pointer"
                      >
                        Langkah Berikutnya →
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsExamMode(true);
                          setExamSubmitted(false);
                          setExamAnswers({});
                        }}
                        className="btn-ember h-10 px-6 rounded-xl font-display text-xs font-bold text-obsidian shadow-md animate-pulse cursor-pointer"
                      >
                        Mulai Ujian Kelulusan {activeStage.badge} →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* STAGE GATEKEEPER EXAM VIEW (WITH AUDIO PLAYBACK) */
              <div className="space-y-5 animate-in fade-in duration-300">
                <div className="flex items-center justify-between bg-surface-raised/50 p-4 rounded-2xl border border-hairline">
                  <div>
                    <span className="text-micro font-mono font-bold text-ember uppercase">Ujian Kelulusan {activeStage.badge}</span>
                    <h3 className="font-display text-base font-bold text-ink mt-0.5">
                      Tes Pemahaman &amp; Validasi Suara {activeStage.title}
                    </h3>
                    <p className="text-xs text-muted">Dengarkan audio dan jawab minimal 60% soal dengan benar untuk membuka tahap berikutnya.</p>
                  </div>
                  <button
                    onClick={() => setIsExamMode(false)}
                    className="h-8 px-3 rounded-lg border border-hairline bg-surface text-xs font-bold text-muted hover:text-ink cursor-pointer"
                  >
                    Kembali ke Materi
                  </button>
                </div>

                <div className="space-y-3.5">
                  {activeStage.exam.map((q, qIdx) => (
                    <div key={qIdx} className="rounded-2xl border border-hairline bg-surface-raised p-4 sm:p-5 space-y-3">
                      <h4 className="font-display text-sm font-bold text-ink leading-relaxed">
                        {qIdx + 1}. {q.question}
                      </h4>
                      <div className="space-y-2">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = examAnswers[qIdx] === optIdx;
                          const isCorrect = optIdx === q.correctIndex;

                          let style = "border-hairline/90 bg-surface hover:border-ember/70 hover:bg-surface-raised";
                          if (examSubmitted) {
                            if (isCorrect) style = "border-emerald-500 bg-emerald-500/20 text-emerald-400 font-bold";
                            else if (isSelected) style = "border-rose-500 bg-rose-500/20 text-rose-400 font-bold";
                            else style = "border-hairline/40 opacity-50";
                          } else if (isSelected) {
                            style = "border-ember bg-ember/15 text-ember font-bold ring-1 ring-ember/50";
                          }

                          return (
                            <div
                              key={optIdx}
                              onClick={() => {
                                if (!examSubmitted) setExamAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
                              }}
                              className={`rounded-2xl border p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all cursor-pointer ${style}`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div
                                  className={`size-7 rounded-full flex items-center justify-center font-display font-bold text-xs shrink-0 ${
                                    isSelected ? "bg-ember text-obsidian" : "bg-surface-raised border border-hairline text-muted"
                                  }`}
                                >
                                  {String.fromCharCode(65 + optIdx)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-ink">{opt.text}</p>
                                  {opt.subtext && <p className="text-[10px] text-muted">{opt.subtext}</p>}
                                </div>
                              </div>

                              {opt.soundSample && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    playSpeechAudio(opt.soundSample || opt.text);
                                  }}
                                  className="btn-ember h-8 px-3 rounded-lg text-obsidian text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto shadow-xs hover:brightness-105"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                  </svg>
                                  Dengar
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {examSubmitted && (
                        <p className="text-[11px] text-muted pt-2 border-t border-hairline/40 leading-relaxed">
                          <b>Pembahasan:</b> {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Exam Action Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  {!examSubmitted ? (
                    <button
                      disabled={Object.keys(examAnswers).length < activeStage.exam.length}
                      onClick={() => submitGateExam(activeStage)}
                      className="btn-ember h-11 px-7 rounded-xl font-display text-xs font-bold text-obsidian shadow-md disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                    >
                      Kirim Jawaban &amp; Evaluasi Kelulusan →
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {completedStages.includes(activeStage.id) && activeStage.id < 6 ? (
                        <button
                          onClick={() => {
                            setActiveStageId(activeStage.id + 1);
                            setActiveStepIndex(0);
                            setIsExamMode(false);
                            setExamSubmitted(false);
                            setExamAnswers({});
                            setDrillAnswer(null);
                          }}
                          className="btn-ember h-11 px-7 rounded-xl font-display text-xs font-bold text-obsidian shadow-md cursor-pointer"
                        >
                          Lanjut ke Tahap {activeStage.id + 1} →
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setIsExamMode(false);
                            setExamSubmitted(false);
                            setExamAnswers({});
                            setDrillAnswer(null);
                          }}
                          className="h-11 px-6 rounded-xl border border-hairline bg-surface text-xs font-bold text-ink hover:bg-surface-raised cursor-pointer"
                        >
                          Ulangi Ujian
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: BICARA AI (LIVE SPEAKING CALL) */}
      {/* ========================================================================= */}
      {mode === "voice" && (
        <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/90 p-4 sm:p-6 backdrop-blur-xl shadow-xl space-y-5">
          {!isCalling && !showCallSummary ? (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-ink">
                    Pilih Partner Bicara AI
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Setiap partner memiliki dialek native, tempo bicara, dan kepribadian yang unik.
                  </p>
                </div>

                {/* Tempo selector for beginners */}
                <div className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-raised px-3 py-1.5 self-start sm:self-auto">
                  <span className="text-[11px] font-bold text-muted whitespace-nowrap">Tempo Suara:</span>
                  {[
                    { val: 0.75, label: "0.75x (Pelan)" },
                    { val: 1.0, label: "1.0x (Normal)" },
                  ].map((s) => (
                    <button
                      key={s.val}
                      onClick={() => setPlaybackSpeed(s.val)}
                      className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all whitespace-nowrap ${
                        playbackSpeed === s.val ? "bg-ember text-obsidian" : "text-muted hover:text-ink"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Persona Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {PERSONAS.map((p) => {
                  const isSelected = persona === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPersona(p.id)}
                      className={`rounded-2xl border p-4 text-left transition-all relative overflow-hidden flex flex-col justify-between h-36 ${
                        isSelected
                          ? "border-ember bg-ember/10 shadow-md ring-1 ring-ember/30"
                          : "border-hairline bg-surface-raised/60 hover:border-hairline/90"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm font-bold text-ink truncate">{p.name}</span>
                          <span className="text-[10px] font-mono font-bold text-ember bg-ember/15 px-2 py-0.5 rounded-md shrink-0">
                            {p.accent}
                          </span>
                        </div>
                        <p className="text-micro text-muted mt-2 leading-relaxed line-clamp-2">{p.desc}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-hairline/40">
                        <span className="text-[10px] font-medium text-muted">{p.tag}</span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ember">
                            <span className="size-1.5 rounded-full bg-ember" /> Dipilih
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Action Banner */}
              <div className="rounded-2xl border border-hairline/60 bg-surface-raised/40 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-0.5 text-center sm:text-left">
                  <h4 className="text-xs sm:text-sm font-bold text-ink">Bebas Bicara Tanpa Takut Salah</h4>
                  <p className="text-micro sm:text-xs text-muted">
                    Tersedia tombol terjemahan instan &amp; contekan kalimat pintar jika lo bingung mau merespons apa.
                  </p>
                </div>
                <button
                  onClick={() => startCall()}
                  className="btn-ember shrink-0 h-11 px-7 rounded-xl font-display text-xs font-bold text-obsidian shadow-md hover:brightness-105 w-full sm:w-auto"
                >
                  Mulai Panggilan Suara →
                </button>
              </div>
            </div>
          ) : isCalling ? (
            /* ACTIVE PHONE CALL SCREEN */
            <div className="space-y-5">
              {/* Call Top Bar */}
              <div className="flex items-center justify-between border-b border-hairline/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full border border-ember/40 bg-ember/20 flex items-center justify-center text-ember font-display font-bold text-sm shrink-0">
                    {persona.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-ink capitalize">
                      {persona} ({PERSONAS.find((p) => p.id === persona)?.tag})
                    </h3>
                    <p className="text-micro text-emerald-400 font-mono flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Terhubung • {formatSeconds(callDuration)}
                      {isPlayingAudio && <span className="text-ember font-bold ml-1">• Bersuara...</span>}
                    </p>
                  </div>
                </div>

                <button
                  onClick={endCall}
                  className="h-9 px-4 rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-400 text-xs font-bold hover:bg-rose-500/25 transition-all shrink-0"
                >
                  Akhiri Panggilan
                </button>
              </div>

              {/* Real-time Tips & Roast Badges */}
              {(activeTip || activeRoast) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-200">
                  {activeTip && (
                    <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs">
                      <p className="font-bold text-sky-400 text-micro uppercase tracking-wider">Koreksi Grammar Halus:</p>
                      <p className="text-ink mt-0.5 font-medium">{activeTip}</p>
                    </div>
                  )}
                  {activeRoast && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                      <p className="font-bold text-amber-400 text-micro uppercase tracking-wider">Catatan Humoris Malesan:</p>
                      <p className="text-ink mt-0.5 font-medium italic">&ldquo;{activeRoast}&rdquo;</p>
                    </div>
                  )}
                </div>
              )}

              {/* Chat / Transcript Stream */}
              <div className="h-64 sm:h-72 overflow-y-auto rounded-2xl border border-hairline/60 bg-surface-raised/40 p-4 space-y-3.5 custom-scrollbar">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed space-y-2 ${
                        m.role === "user"
                          ? "bg-ember text-obsidian font-medium rounded-tr-xs"
                          : "border border-hairline/80 bg-surface text-ink rounded-tl-xs shadow-xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span>{m.text}</span>
                        {m.role === "assistant" && (
                          <button
                            type="button"
                            onClick={() => playSpeechAudio(m.text)}
                            title="Putar suara"
                            className="shrink-0 text-muted hover:text-ember transition-colors p-0.5"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Beginner Feature: Tap to view Indonesian Translation */}
                      {m.role === "assistant" && m.translateId && (
                        <div className="border-t border-hairline/50 pt-1.5">
                          {showTranslations[m.id] ? (
                            <p className="text-[11px] text-muted font-normal italic">
                              Arti: &ldquo;{m.translateId}&rdquo;
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setShowTranslations((prev) => ({ ...prev, [m.id]: true }))
                              }
                              className="text-[10px] font-bold text-ember hover:underline"
                            >
                              Lihat Terjemahan Indo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {m.score && m.role === "assistant" && (
                      <span className="text-[10px] text-muted mt-1 px-1 font-mono">
                        Skor Kelancaran: {m.score}/100
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Beginner Feature: Smart Hint Suggestion Pills */}
              {messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].suggestedReplies && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <span className="text-micro font-bold text-muted uppercase tracking-wider">
                    Contekan Jawaban Cepat (Klik untuk kirim):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {messages[messages.length - 1].suggestedReplies?.map((hint, idx) => (
                      <button
                        key={idx}
                        onClick={() => submitTextMessage(hint.en)}
                        disabled={isProcessing}
                        className="rounded-xl border border-hairline bg-surface p-2.5 text-left hover:border-ember/60 hover:bg-surface-raised transition-all group"
                      >
                        <span className="font-bold text-xs text-ink group-hover:text-ember block truncate">{hint.en}</span>
                        <span className="text-[10px] text-muted block truncate mt-0.5">{hint.id}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Kinetic Waveform Canvas */}
              <div className="rounded-2xl border border-hairline/60 bg-surface-raised p-3 flex flex-col items-center justify-center">
                <canvas ref={canvasRef} width={400} height={46} className="w-full h-10" />
                <p className="text-[11px] font-mono text-muted mt-1">
                  {isRecording
                    ? "Mendengarkan suara lo secara live... Klik tombol merah untuk kirim"
                    : isPlayingAudio
                    ? "Partner AI sedang berbicara..."
                    : isProcessing
                    ? "AI sedang memikirkan balasan..."
                    : "Bicara lewat tombol mikrofon atau ketik pesan teks"}
                </p>
              </div>

              {/* Controls Bar */}
              <div className="space-y-3">
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={isProcessing}
                    className={`h-13 px-8 rounded-2xl font-display text-xs sm:text-sm font-bold transition-all flex items-center gap-2.5 shadow-lg ${
                      isRecording
                        ? "bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/30"
                        : isProcessing
                        ? "bg-surface-raised text-muted cursor-not-allowed border border-hairline"
                        : "bg-ember text-obsidian hover:brightness-105 active:scale-95"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4 sm:size-5">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                    {isRecording
                      ? "Selesai Bicara (Kirim Obrolan)"
                      : isProcessing
                      ? "Memproses Suara..."
                      : "Tekan untuk Mulai Bicara"}
                  </button>
                </div>

                {/* Instant Text Input Alternative */}
                <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface-raised p-1.5 focus-within:border-ember/60 transition-all">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitTextMessage();
                      }
                    }}
                    placeholder="Atau ketik kalimat bahasa Inggris di sini..."
                    disabled={isProcessing}
                    className="flex-1 bg-transparent px-3 text-xs sm:text-sm text-ink placeholder:text-muted/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => submitTextMessage()}
                    disabled={!textInput.trim() || isProcessing}
                    className="btn-ember h-9 px-4 rounded-xl font-display text-xs font-bold text-obsidian disabled:opacity-50 shrink-0"
                  >
                    Kirim
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* POST-CALL SCORECARD */
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="border-b border-hairline/60 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Rapor Selesai Percakapan
                  </h3>
                  <p className="text-xs text-muted">Durasi Panggilan: {formatSeconds(callDuration)}</p>
                </div>
                <button
                  onClick={() => setShowCallSummary(false)}
                  className="btn-ember h-9 px-4 rounded-xl text-xs font-bold text-obsidian"
                >
                  Panggilan Baru
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="rounded-2xl border border-hairline bg-surface-raised p-4 text-center">
                  <p className="text-micro font-bold text-muted uppercase tracking-wider">Total Kalimat</p>
                  <p className="font-display text-2xl font-bold text-ink mt-1">
                    {messages.filter((m) => m.role === "user").length}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                  <p className="text-micro font-bold text-emerald-400 uppercase tracking-wider">Rata-rata Skor</p>
                  <p className="font-display text-2xl font-bold text-emerald-400 mt-1">
                    {messages.filter((m) => m.score).length
                      ? Math.round(
                          messages.filter((m) => m.score).reduce((a, b) => a + (b.score || 0), 0) /
                            messages.filter((m) => m.score).length,
                        )
                      : 80}
                    /100
                  </p>
                </div>
                <div className="rounded-2xl border border-ember/30 bg-ember/10 p-4 text-center">
                  <p className="text-micro font-bold text-ember uppercase tracking-wider">Koreksi Diberikan</p>
                  <p className="font-display text-2xl font-bold text-ember mt-1">
                    {messages.filter((m) => m.tip).length} Catatan
                  </p>
                </div>
              </div>

              {/* Transcript History */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Rangkuman Obrolan:</h4>
                <div className="rounded-2xl border border-hairline bg-surface-raised/40 p-4 space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                  {messages.map((m) => (
                    <div key={m.id} className="text-xs">
                      <span className="font-bold text-ember capitalize">{m.role === "user" ? "Lo" : persona}: </span>
                      <span className="text-ink">{m.text}</span>
                      {m.tip && (
                        <p className="text-micro text-sky-400 mt-0.5 ml-4 font-medium">Tip: {m.tip}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: SIMULASI SKENARIO (ROLEPLAY CHAMBER) */}
      {/* ========================================================================= */}
      {mode === "scenario" && (
        <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/90 p-4 sm:p-6 backdrop-blur-xl shadow-xl space-y-5">
          {!isCalling ? (
            <div className="space-y-5">
              <div>
                <h3 className="font-display text-base font-bold text-ink">
                  Chamber Simulasi Skenario Dunia Nyata
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Latihan situasi spesifik dengan misi objektif, alur cerita, dan lawan bicara AI yang realistis.
                </p>
              </div>

              {/* Scenario Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {SCENARIOS.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-hairline bg-surface-raised p-4 sm:p-5 flex flex-col justify-between space-y-4 hover:border-ember/40 transition-all group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-display text-sm font-bold text-ink group-hover:text-ember transition-colors">
                          {s.title}
                        </h4>
                        <span className="text-[10px] font-mono font-bold text-ember bg-ember/15 px-2 py-0.5 rounded-md border border-ember/30 shrink-0 capitalize">
                          {s.partner}
                        </span>
                      </div>
                      <p className="text-xs text-muted leading-relaxed line-clamp-2">{s.context}</p>

                      {/* Missions list */}
                      <div className="space-y-1.5 pt-1 border-t border-hairline/40">
                        <p className="text-[10px] font-bold text-ember uppercase tracking-wider">Target Misi:</p>
                        <ul className="text-xs text-ink/85 space-y-1">
                          {s.missions.map((m, i) => (
                            <li key={i} className="flex items-start gap-1.5 leading-snug">
                              <span className="text-ember font-bold shrink-0">•</span>
                              <span>{m}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <button
                      onClick={() => startCall(s)}
                      className="btn-ember w-full h-10 rounded-xl text-xs font-bold text-obsidian shadow-sm hover:brightness-105"
                    >
                      Mulai Simulasi →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ACTIVE ROLEPLAY CHAMBER VIEW */
            <div className="space-y-5">
              {/* Scenario Context Header */}
              <div className="rounded-2xl border border-ember/30 bg-ember/10 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <h3 className="font-display text-sm sm:base font-bold text-ink truncate">
                      Skenario: {activeScenario?.title}
                    </h3>
                  </div>
                  <button
                    onClick={endCall}
                    className="h-8 px-3 rounded-lg border border-rose-500/40 bg-rose-500/15 text-rose-400 text-micro font-bold hover:bg-rose-500/25 shrink-0"
                  >
                    Selesaikan Simulasi
                  </button>
                </div>
                <p className="text-xs text-muted leading-relaxed">{activeScenario?.context}</p>

                {/* Live Mission Checklist */}
                <div className="border-t border-hairline/60 pt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {activeScenario?.missions.map((m, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-2.5 text-xs flex items-center gap-2 ${
                        completedMissions[idx]
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-bold"
                          : "border-hairline bg-surface text-muted"
                      }`}
                    >
                      <span className={`size-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                        completedMissions[idx] ? "bg-emerald-400 text-obsidian font-bold" : "border border-hairline"
                      }`}>
                        {completedMissions[idx] ? "✓" : idx + 1}
                      </span>
                      <span className="truncate">{m}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat Transcript */}
              <div className="h-64 sm:h-72 overflow-y-auto rounded-2xl border border-hairline/60 bg-surface-raised/40 p-4 space-y-3.5 custom-scrollbar">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed space-y-2 ${
                        m.role === "user"
                          ? "bg-ember text-obsidian font-medium rounded-tr-xs"
                          : "border border-hairline/80 bg-surface text-ink rounded-tl-xs shadow-xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span>{m.text}</span>
                        {m.role === "assistant" && (
                          <button
                            type="button"
                            onClick={() => playSpeechAudio(m.text, activeScenario?.partner)}
                            title="Putar suara"
                            className="shrink-0 text-muted hover:text-ember transition-colors p-0.5"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Indonesian translation toggle */}
                      {m.role === "assistant" && m.translateId && (
                        <div className="border-t border-hairline/50 pt-1.5">
                          {showTranslations[m.id] ? (
                            <p className="text-[11px] text-muted font-normal italic">
                              Arti: &ldquo;{m.translateId}&rdquo;
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setShowTranslations((prev) => ({ ...prev, [m.id]: true }))
                              }
                              className="text-[10px] font-bold text-ember hover:underline"
                            >
                              Lihat Terjemahan Indo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Beginner Hint Chips */}
              {messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].suggestedReplies && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <span className="text-micro font-bold text-muted uppercase tracking-wider">
                    Opsi Jawaban Skenario (Klik untuk kirim):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {messages[messages.length - 1].suggestedReplies?.map((hint, idx) => (
                      <button
                        key={idx}
                        onClick={() => submitTextMessage(hint.en)}
                        disabled={isProcessing}
                        className="rounded-xl border border-hairline bg-surface p-2.5 text-left hover:border-ember/60 hover:bg-surface-raised transition-all group"
                      >
                        <span className="font-bold text-xs text-ink group-hover:text-ember block truncate">{hint.en}</span>
                        <span className="text-[10px] text-muted block truncate mt-0.5">{hint.id}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Roleplay input controls */}
              <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface-raised p-1.5 focus-within:border-ember/60 transition-all">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitTextMessage();
                    }
                  }}
                  placeholder="Ketik balasan untuk percakapan ini..."
                  disabled={isProcessing}
                  className="flex-1 bg-transparent px-3 text-xs sm:text-sm text-ink placeholder:text-muted/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => submitTextMessage()}
                  disabled={!textInput.trim() || isProcessing}
                  className="btn-ember h-9 px-4 rounded-xl font-display text-xs font-bold text-obsidian disabled:opacity-50 shrink-0"
                >
                  Kirim
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: KUIS KILAT PRO */}
      {/* ========================================================================= */}
      {mode === "quiz" && (
        <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/90 p-4 sm:p-6 backdrop-blur-xl shadow-xl space-y-5">
          {quizQuestions.length === 0 ? (
            <div className="space-y-5">
              <div>
                <h3 className="font-display text-base font-bold text-ink">
                  Kuis Kilat Bahasa Inggris Pro
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Uji pemahaman tenses, idiom, kosakata bisnis, dan perbaikan kalimat dengan soal yang 100% segar &amp; anti-repetisi.
                </p>
              </div>

              {/* Topic Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { id: "grammar_tenses", title: "Tenses & Grammar", desc: "Past, Present, Perfect, & Conditionals" },
                  { id: "idioms_phrases", title: "Idioms & Phrasal Verbs", desc: "Ungkapan sehari-hari penutur asli" },
                  { id: "error_spotting", title: "Error Spotting", desc: "Cari letak kesalahan dalam kalimat" },
                  { id: "business_pro", title: "Business English", desc: "Email profesional, meeting & negosiasi" },
                  { id: "slang_pop", title: "Slang & Pop Culture", desc: "Bahasa gaul internet & tongkrongan global" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setQuizTopic(t.id)}
                    className={`rounded-2xl border p-4 text-left transition-all h-24 flex flex-col justify-between ${
                      quizTopic === t.id
                        ? "border-ember bg-ember/10 shadow-sm ring-1 ring-ember/30"
                        : "border-hairline bg-surface-raised/60 hover:border-hairline/90"
                    }`}
                  >
                    <p className="font-display text-sm font-bold text-ink">{t.title}</p>
                    <p className="text-micro text-muted line-clamp-2">{t.desc}</p>
                  </button>
                ))}
              </div>

              {/* Question Count Selector & Start Button Row */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-hairline/60 pt-4">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-bold text-ink whitespace-nowrap">Jumlah Soal:</span>
                  {[5, 10, 15].map((cnt) => (
                    <button
                      key={cnt}
                      onClick={() => setQuizCount(cnt)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
                        quizCount === cnt ? "bg-ember text-obsidian" : "text-muted hover:text-ink bg-surface border border-hairline"
                      }`}
                    >
                      {cnt} Soal
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleGenerateQuiz}
                  disabled={quizLoading}
                  className="btn-ember h-11 px-6 rounded-xl font-display text-xs font-bold text-obsidian shadow-md hover:brightness-105 w-full sm:w-auto"
                >
                  {quizLoading ? "Menyiapkan Soal Kuis Segar..." : `Mulai Kuis ${quizCount} Soal Baru →`}
                </button>
              </div>
            </div>
          ) : !quizFinished ? (
            /* ACTIVE QUIZ QUESTION */
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-hairline/60 pb-3">
                <span className="text-xs font-bold text-ember uppercase tracking-wider">
                  Soal {currentQuestionIdx + 1} dari {quizQuestions.length}
                </span>
                <span className="text-micro text-muted font-mono">Tingkat: {level.toUpperCase()}</span>
              </div>

              {quizQuestions[currentQuestionIdx] && (
                <div className="space-y-4">
                  <h3 className="font-display text-base sm:text-lg font-bold text-ink leading-relaxed">
                    {quizQuestions[currentQuestionIdx].question}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quizQuestions[currentQuestionIdx].options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[currentQuestionIdx] === optIdx;
                      const isAnswered = selectedAnswers[currentQuestionIdx] !== undefined;
                      const isCorrect = optIdx === quizQuestions[currentQuestionIdx].correctIndex;

                      let btnStyle = "border-hairline bg-surface hover:border-hairline/90 text-ink";
                      if (isAnswered) {
                        if (isCorrect) btnStyle = "border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold";
                        else if (isSelected) btnStyle = "border-rose-500 bg-rose-500/15 text-rose-400 font-bold";
                        else btnStyle = "border-hairline/40 bg-surface/40 text-muted opacity-50";
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={isAnswered}
                          onClick={() => {
                            setSelectedAnswers((prev) => ({ ...prev, [currentQuestionIdx]: optIdx }));
                          }}
                          className={`rounded-2xl border p-4 text-left text-xs sm:text-sm transition-all ${btnStyle}`}
                        >
                          <span className="font-mono font-bold mr-2 text-muted">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation & Roast Box */}
                  {selectedAnswers[currentQuestionIdx] !== undefined && (
                    <div className="rounded-2xl border border-hairline bg-surface-raised p-4 space-y-2 animate-in fade-in duration-200">
                      {selectedAnswers[currentQuestionIdx] === quizQuestions[currentQuestionIdx].correctIndex ? (
                        <p className="text-xs font-bold text-emerald-400">Jawaban Benar!</p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-rose-400">Jawaban Kurang Tepat!</p>
                          <p className="text-xs text-amber-400 italic">
                            &ldquo;{quizQuestions[currentQuestionIdx].roastWrong}&rdquo;
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-muted leading-relaxed">
                        <b>Penjelasan:</b> {quizQuestions[currentQuestionIdx].explanation}
                      </p>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex justify-end gap-2 pt-2">
                    {currentQuestionIdx < quizQuestions.length - 1 ? (
                      <button
                        disabled={selectedAnswers[currentQuestionIdx] === undefined}
                        onClick={() => setCurrentQuestionIdx((prev) => prev + 1)}
                        className="btn-ember h-10 px-5 rounded-xl text-xs font-bold text-obsidian disabled:opacity-50"
                      >
                        Soal Berikutnya →
                      </button>
                    ) : (
                      <button
                        disabled={selectedAnswers[currentQuestionIdx] === undefined}
                        onClick={finishQuiz}
                        className="btn-ember h-10 px-5 rounded-xl text-xs font-bold text-obsidian disabled:opacity-50"
                      >
                        Lihat Skor &amp; Catat Rapor →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* QUIZ SUMMARY */
            <div className="space-y-6 text-center animate-in fade-in duration-300">
              <h3 className="font-display text-xl font-bold text-ink">Hasil Kuis Lo</h3>
              {(() => {
                let correctCount = 0;
                quizQuestions.forEach((q, idx) => {
                  if (selectedAnswers[idx] === q.correctIndex) correctCount++;
                });
                const score = Math.round((correctCount / quizQuestions.length) * 100);

                return (
                  <div className="space-y-4">
                    <div className="size-24 rounded-full border-2 border-ember bg-ember/15 mx-auto flex items-center justify-center font-display text-2xl font-bold text-ember">
                      {score}%
                    </div>
                    <p className="text-xs text-muted">
                      Lo berhasil menjawab benar <b>{correctCount}</b> dari <b>{quizQuestions.length}</b> soal.
                    </p>
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={handleGenerateQuiz}
                        className="btn-ember h-10 px-5 rounded-xl text-xs font-bold text-obsidian"
                      >
                        Mulai Kuis Baru (Soal Segar)
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 4: UJIAN ESAI */}
      {/* ========================================================================= */}
      {mode === "essay" && (
        <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/90 p-4 sm:p-6 backdrop-blur-xl shadow-xl space-y-5">
          <div>
            <h3 className="font-display text-base font-bold text-ink">
              Ujian Esai &amp; Evaluasi Tulisan Bahasa Inggris
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Tulis paragraf opini atau esai lo, AI akan membedah tata bahasa, skor setara IELTS, dan memberikan draf sempurna.
            </p>
          </div>

          {/* Topic selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-ink">Pilih Topik atau Tulis Topik Sendiri:</label>
            <div className="flex flex-wrap gap-2">
              {ESSAY_TOPICS.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setEssayTopic(t)}
                  className={`rounded-xl border px-3 py-1.5 text-xs text-left transition-all ${
                    essayTopic === t
                      ? "border-ember bg-ember/15 text-ember font-bold"
                      : "border-hairline bg-surface-raised/60 text-muted hover:text-ink"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Text Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink">Tulis Esai Bahasa Inggris Lo:</label>
              <span className="text-micro font-mono text-muted">
                {essayText.trim().split(/\s+/).filter(Boolean).length} Kata • {essayText.length} Karakter
              </span>
            </div>
            <textarea
              rows={6}
              value={essayText}
              onChange={(e) => setEssayText(e.target.value)}
              placeholder="Write your English essay or opinion here (minimum 20 characters)..."
              className="w-full rounded-2xl border border-hairline bg-surface-raised p-4 text-xs sm:text-sm text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none transition-all leading-relaxed"
            />
          </div>

          <button
            onClick={handleEvaluateEssay}
            disabled={essayLoading}
            className="btn-ember h-11 px-6 rounded-xl font-display text-xs font-bold text-obsidian shadow-md hover:brightness-105 disabled:opacity-50"
          >
            {essayLoading ? "Menganalisis Esai..." : "Evaluasi & Bedah Esai Sekarang →"}
          </button>

          {/* Result View */}
          {essayResult && (
            <div className="rounded-2xl border border-hairline bg-surface-raised/40 p-5 space-y-5 animate-in fade-in duration-300">
              {/* Score Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="rounded-2xl border border-ember/40 bg-ember/15 p-4 text-center">
                  <p className="text-micro font-bold text-ember uppercase tracking-wider">Estimasi Skor IELTS</p>
                  <p className="font-display text-2xl font-bold text-ember mt-1">
                    Band {essayResult.overallBandScore}
                  </p>
                </div>
                <div className="rounded-2xl border border-hairline bg-surface p-4 text-center">
                  <p className="text-micro font-bold text-muted uppercase tracking-wider">Nilai Keseluruhan</p>
                  <p className="font-display text-2xl font-bold text-ink mt-1">
                    {essayResult.overallScore100} / 100
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
                  <p className="text-micro font-bold text-amber-400 uppercase tracking-wider">Koreksi Grammar</p>
                  <p className="font-display text-2xl font-bold text-amber-400 mt-1">
                    {essayResult.grammarCorrections?.length || 0} Poin
                  </p>
                </div>
              </div>

              {/* Roast / Humor Box */}
              {essayResult.roastReview && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
                  <p className="font-bold text-amber-400 text-micro uppercase tracking-wider">Catatan Roasting Malesan:</p>
                  <p className="text-ink mt-1 font-medium italic">&ldquo;{essayResult.roastReview}&rdquo;</p>
                </div>
              )}

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Kekuatan Tulisan:</p>
                  <ul className="space-y-1 text-xs text-ink list-disc list-inside">
                    {essayResult.strengths?.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-2">
                  <p className="text-xs font-bold text-rose-400 uppercase tracking-wider">Kelemahan &amp; Area Perbaikan:</p>
                  <ul className="space-y-1 text-xs text-ink list-disc list-inside">
                    {essayResult.weaknesses?.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Perfected Rewrite Draft */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-ink uppercase tracking-wider">Versi Draf Sempurna (High-Level Rewrite):</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(essayResult.perfectedDraft);
                      setFeedbackNotice("Draf sempurna berhasil disalin ke clipboard.");
                    }}
                    className="text-micro font-bold text-ember hover:underline"
                  >
                    Salin Draf
                  </button>
                </div>
                <div className="rounded-2xl border border-hairline bg-surface p-4 text-xs sm:text-sm text-ink leading-relaxed font-serif">
                  {essayResult.perfectedDraft}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 5: RAPOR & RIWAYAT BELAJAR (LEARNING ANALYTICS) */}
      {/* ========================================================================= */}
      {mode === "progress" && (
        <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/90 p-4 sm:p-6 backdrop-blur-xl shadow-xl space-y-5 animate-in fade-in duration-300">
          <div>
            <h3 className="font-display text-base font-bold text-ink">
              Rapor &amp; Analitik Progres Belajar Lo
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Pantau perkembangan skor kelancaran, penyelesaian kurikulum 0-100%, durasi latihan bicara, dan rekomendasi materi.
            </p>
          </div>

          {/* CURRICULUM MASTERY HIGHLIGHT CARD */}
          <div className="rounded-3xl border border-ember/40 bg-gradient-to-r from-surface-raised via-surface to-ember/15 p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ember uppercase tracking-wider">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5 text-ember">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                  </svg>
                  Status Kurikulum Akademi
                </span>
                <h4 className="font-display text-base sm:text-lg font-bold text-ink">
                  Tingkat Penguasaan: {masteryPercentage}% Menuju 100% Master
                </h4>
              </div>

              <button
                onClick={() => setMode("academy")}
                className="btn-ember h-9 px-4 rounded-xl text-xs font-bold text-obsidian shrink-0 self-start sm:self-auto"
              >
                Buka Belajar 0-100% →
              </button>
            </div>

            {/* Kinetic Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded-full bg-surface-raised border border-hairline overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-ember transition-all duration-500 shadow-sm"
                  style={{ width: `${Math.max(4, masteryPercentage)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                <span>0% (Pemula Nol)</span>
                <span>{completedStages.length} / 6 Tahap Selesai</span>
                <span className="font-bold text-ember">100% (Fluent Master)</span>
              </div>
            </div>
          </div>

          {/* Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="rounded-2xl border border-hairline bg-surface-raised p-3.5 text-center">
              <p className="text-micro font-bold text-muted uppercase tracking-wider">Total Menit Bicara</p>
              <p className="font-display text-xl sm:text-2xl font-bold text-ink mt-1">{totalMinutesSpoken} Menit</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-center">
              <p className="text-micro font-bold text-emerald-400 uppercase tracking-wider">Rata-rata Skor</p>
              <p className="font-display text-xl sm:text-2xl font-bold text-emerald-400 mt-1">{avgOverallScore}/100</p>
            </div>
            <div className="rounded-2xl border border-ember/30 bg-ember/10 p-3.5 text-center">
              <p className="text-micro font-bold text-ember uppercase tracking-wider">Total Aktivitas</p>
              <p className="font-display text-xl sm:text-2xl font-bold text-ember mt-1">{records.length} Sesi</p>
            </div>
            <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3.5 text-center">
              <p className="text-micro font-bold text-sky-400 uppercase tracking-wider">Status Level</p>
              <p className="font-display text-xl sm:text-2xl font-bold text-sky-400 mt-1 capitalize">{level}</p>
            </div>
          </div>

          {/* Personalized Weakness & Recommendations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-3">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                Kelemahan Grammar yang Sering Muncul:
              </h4>
              {topPitfalls.length > 0 ? (
                <div className="space-y-2">
                  {topPitfalls.map(([tag, count], idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-surface/50 rounded-xl p-2.5">
                      <span className="font-bold text-ink">{tag}</span>
                      <span className="font-mono text-rose-400 font-bold">{count}x Terdeteksi</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted italic">
                  Belum ada catatan kesalahan berulang. Terus latihan di Belajar 0-100% dan kerjakan kuis!
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-ember/30 bg-ember/10 p-4 space-y-3">
              <h4 className="text-xs font-bold text-ember uppercase tracking-wider">
                Rekomendasi Langkah Belajar:
              </h4>
              <ul className="text-xs text-ink space-y-2 list-disc list-inside">
                <li>
                  {masteryPercentage < 40
                    ? "Tuntaskan Tahap 1 & 2 di Belajar 0-100% untuk melatih bunyi lidah dan cara menyambung kata."
                    : masteryPercentage < 80
                    ? "Pelajari 50 Larangan Indoglish di Tahap 3 dan uji reflek bicara di Simulasi Skenario."
                    : "Lakukan sesi Ujian Kelulusan Tahap 6 untuk mengunci skor 100% Master!"}
                </li>
                <li>
                  {topPitfalls.length > 0
                    ? `Coba Kuis Kilat topik "${topPitfalls[0][0]}" untuk memperbaiki titik lemah utama.`
                    : "Lakukan sesi berbicara minimal 5 menit per hari untuk melatih reflek bicara spontan."}
                </li>
              </ul>
            </div>
          </div>

          {/* Session History Feed */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Riwayat Sesi Belajar:</h4>
            {records.length > 0 ? (
              <div className="rounded-2xl border border-hairline bg-surface-raised/40 p-4 space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar">
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-hairline bg-surface text-xs"
                  >
                    <div>
                      <span className="font-bold text-ink block">{r.title}</span>
                      <span className="text-[10px] text-muted font-mono">
                        {new Date(r.timestamp).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {r.durationSeconds ? ` • ${formatSeconds(r.durationSeconds)}` : ""}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-ember bg-ember/15 px-2.5 py-1 rounded-lg border border-ember/30">
                      {r.score}/100
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-hairline bg-surface-raised/40 p-8 text-center text-xs text-muted">
                Belum ada riwayat aktivitas. Buka Belajar 0-100%, mulai panggilan suara, atau kuis kilat untuk mencatat progres lo!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
