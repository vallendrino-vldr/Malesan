"use client";

import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

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

interface VoiceValidationResponse {
  score: number;
  isPassed: boolean;
  transcribedText: string;
  targetSentence: string;
  phoneticBreakdown: Array<{
    word: string;
    isCorrect: boolean;
    feedback: string;
  }>;
  humorRoast: string;
  recommendation: string;
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

const PERSONAS: Array<{ id: Persona; name: string; tag: string; desc: string; accent: string; gender: "male" | "female" }> = [
  { id: "sarah", name: "Sarah", tag: "British Casual", accent: "London", desc: "Ramah, sopan, aksen British wanita mengalir alami", gender: "female" },
  { id: "alex", name: "Alex", tag: "American Slang", accent: "California", desc: "Santai, aksen pria Amerika modern & gaul", gender: "male" },
  { id: "david", name: "David", tag: "Tech Recruiter", accent: "Executive", desc: "Wawancara kerja profesional, suara pria berwibawa", gender: "male" },
  { id: "emma", name: "Emma", tag: "IELTS Coach", accent: "Academic", desc: "Melatih struktur berpikir kritis & aksen akademis wanita", gender: "female" },
];

interface PersonaVoiceProfile {
  name: string;
  gender: "male" | "female";
  lang: string;
  pitch: number;
  rateMultiplier: number;
  preferredKeywords: string[];
}

const PERSONA_VOICE_PROFILES: Record<Persona, PersonaVoiceProfile> = {
  david: {
    name: "David",
    gender: "male",
    lang: "en-US",
    pitch: 0.88, // Confident, masculine executive resonance
    rateMultiplier: 1.0, // Natural 1.0x tempo
    preferredKeywords: [
      "david",
      "microsoft david",
      "google us english male",
      "en-us-x-sfg#male",
      "en-us-x-tpd#male",
      "en-us-x-iol#male",
      "en-us-x-iob#male",
      "guy",
      "male",
      "daniel",
      "george",
      "james",
      "mark",
      "alex",
      "en-us",
    ],
  },
  alex: {
    name: "Alex",
    gender: "male",
    lang: "en-US",
    pitch: 0.98, // Upbeat modern American male
    rateMultiplier: 1.0,
    preferredKeywords: [
      "alex",
      "mark",
      "christopher",
      "guy",
      "male",
      "google us english",
      "en-us",
    ],
  },
  sarah: {
    name: "Sarah",
    gender: "female",
    lang: "en-GB",
    pitch: 1.05, // Refined British female
    rateMultiplier: 1.0,
    preferredKeywords: [
      "sarah",
      "hazel",
      "google uk english female",
      "susan",
      "libby",
      "sonia",
      "female",
      "en-gb",
    ],
  },
  emma: {
    name: "Emma",
    gender: "female",
    lang: "en-US",
    pitch: 1.02, // Crisp articulate academic female
    rateMultiplier: 1.0,
    preferredKeywords: [
      "emma",
      "zira",
      "google us english female",
      "samantha",
      "victoria",
      "female",
      "en-us",
    ],
  },
};

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
  {
    id: "pitch_5k_client",
    title: "Closing Klien Remote $5,000 USD",
    partner: "david",
    partnerRole: "US Client Executive",
    context: "Kamu sedang pitching via Zoom untuk project digital senilai $5,000 USD dengan klien korporat asal New York.",
    missions: [
      "Pitch keunggulan portofoliomu & value proposition",
      "Justifikasi harga $5,000 dengan ROI nyata",
      "Amankan pembayaran uang muka 50% deposit",
    ],
  },
  {
    id: "angry_client_diplomacy",
    title: "Menghadapi Klien Luar Negeri Komplain",
    partner: "sarah",
    partnerRole: "Frustrated Foreign Client",
    context: "Klien komplain tentang revisi di luar kesepakatan awal dan kamu harus bersikap diplomatis & tegas.",
    missions: [
      "Tenangkan situasi dengan empati profesional",
      "Jelaskan batasan scope kontrak awal dengan santun",
      "Tawarkan solusi biaya tambahan untuk scope baru",
    ],
  },
  {
    id: "creator_livestream_intro",
    title: "Opening Live Stream & YouTube Hook",
    partner: "alex",
    partnerRole: "Global Content Creator Co-host",
    context: "Latihan opening live stream / video YouTube berbahasa Inggris yang energik, interaktif, dan memikat penonton global.",
    missions: [
      "Sampaikan hook 3 detik pertama yang nendang",
      "Sapa viewers internasional dan baca chat",
      "Ajak subscribe & sebutkan sponsor",
    ],
  },
  {
    id: "faang_behavioral_interview",
    title: "Interview Silicon Valley (STAR Method)",
    partner: "emma",
    partnerRole: "Global Principal Interviewer",
    context: "Latihan menjawab pertanyaan behavioral interview tech company global menggunakan metode Situation-Task-Action-Result.",
    missions: [
      "Jelaskan situasi konflik teknis / bug kritis",
      "Jabarkan aksi solutif dan kepemimpinanmu",
      "Tutup dengan dampak kuantitatif nyata (Result)",
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
// BEGINNER-FRIENDLY DUAL-AUDIO DATA STRUCTURE & VOICE CHALLENGES
// =========================================================================
interface AudioDrillOption {
  text: string;
  subtext: string;
  soundSample: string;
  isCorrect: boolean;
}

interface StepVoiceChallenge {
  targetSentence: string;
  easyPronunciation: string;
  focusTips: string;
  sampleAudio: string;
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
  stepVoiceChallenge: StepVoiceChallenge;
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
  voiceChallenge: StepVoiceChallenge;
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
        easyPhonetic: "Ejaan Santai: H dibaca 'EITCH' (Bukan Hek) • R dibaca 'AR' lembut tanpa getar",
        explanation: "Orang Indonesia sering membaca huruf H menjadi 'Hek'. Huruf H murni dibaca 'Eitch'. Huruf R dibaca dengan menarik lidah ke belakang tanpa bergetar keras.",
        wrongAudio: {
          label: "BUNYI SALAH (Lidah Kaku Indo):",
          text: "H dibaca 'Hek' / R getar keras 'Rrr'",
          sampleText: "Hek, hek, abjad H dibaca hek. Rrr, getar keras rrr.",
          explanation: "Menambahkan letupan H kasar dan getaran lidah berlebihan.",
        },
        correctAudio: {
          label: "BUNYI BENAR (Native Bule):",
          text: "H dibaca 'Eitch' / R dibaca 'Ar' lembut",
          sampleText: "The letter H is pronounced aitch, and the letter R is smooth.",
          explanation: "Murni melafalkan vokal 'ei' diikuti desisan halus 'tch'.",
        },
        tongueTip: "Tarik ujung lidah ke belakang menjauhi gigi seri saat menyebut huruf R.",
        audioDrill: {
          prompt: "Dengarkan kedua rekaman di bawah. Manakah pelafalan abjad 'H' yang benar?",
          options: [
            {
              text: "Pelafalan 'Eitch' murni",
              subtext: "Ejaan: 'EITCH' (Tanpa huruf H di depan)",
              soundSample: "The letter H is pronounced aitch.",
              isCorrect: true,
            },
            {
              text: "Pelafalan 'Hek'",
              subtext: "Ejaan: 'HEK' (Dengan bunyi H kasar di awal)",
              soundSample: "Hek, abjad H dibaca hek.",
              isCorrect: false,
            },
          ],
          explanation: "Abjad H dalam bahasa Inggris dibaca murni 'Eitch'.",
        },
        stepVoiceChallenge: {
          targetSentence: "The letter H is pronounced as aitch and R is smooth.",
          easyPronunciation: "D-HI LE-TER EITCH IZ PRO-NAUNST EZ EITCH END AR IZ SMUT-H.",
          focusTips: "Lafalkan kata 'Eitch' murni tanpa H di awal, dan huruf R lembut.",
          sampleAudio: "The letter H is pronounced as aitch and R is smooth.",
        },
      },
      {
        title: "Bunyi Lidah 'TH' (Tebal vs Tipis)",
        focusHighlight: "This = 'D-HIS' • Think = 'T-HINGK'",
        easyPhonetic: "Ejaan Santai: This/That (Tebal) • Think/Thank (Tipis) dengan ujung lidah digigit lembut",
        explanation: "Lidah dijepit lembut di antara gigi seri atas dan bawah. Jangan dibaca 'D' (bukan 'De') dan jangan dibaca 'T' (bukan 'Tingk').",
        wrongAudio: {
          label: "BUNYI SALAH (Indoglish D/T):",
          text: "Dis, Dat, Dey • Tingk, Tengkyu",
          sampleText: "Dis and dat, dey tingk and tengkyu.",
          explanation: "Lidah tertahan di dalam mulut.",
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
        stepVoiceChallenge: {
          targetSentence: "I think that this is very good, thank you.",
          easyPronunciation: "AI T-HINGK DET D-HIS IZ VE-RI GUD, T-HENGK YU.",
          focusTips: "Keluarkan ujung lidah di antara gigi seri untuk think, that, this, dan thank you.",
          sampleAudio: "I think that this is very good, thank you.",
        },
      },
      {
        title: "Bunyi 'V' vs 'P'",
        focusHighlight: "Favorite Video = 'FE-VE-RIT VI-DI-O'",
        easyPhonetic: "Ejaan Santai: Huruf V wajib menghasilkan getaran di bibir bawah",
        explanation: "Huruf V bergetar pada bibir bawah (Voice Vibration). Jangan pernah sebut 'Pavorite' atau 'Pideo'!",
        wrongAudio: {
          label: "BUNYI SALAH (Tertukar P):",
          text: "Pavorite pideo, pery good",
          sampleText: "My pavorite pideo is pery good.",
          explanation: "Kedua bibir menutup rapat menghasilkan P.",
        },
        correctAudio: {
          label: "BUNYI BENAR (Vibrating V):",
          text: "Favorite video, very good",
          sampleText: "My favorite video is very good.",
          explanation: "Gigi seri atas menyentuh bibir bawah bagian dalam dengan getaran suara.",
        },
        tongueTip: "Sentuhkan gigi atas ke bibir bawah bagian dalam, rasakan getaran suara saat bunyi V keluar.",
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
        stepVoiceChallenge: {
          targetSentence: "This is my favorite video and it is very nice.",
          easyPronunciation: "D-HIS IZ MAI FE-VE-RIT VI-DI-O END IT IZ VE-RI NAIS.",
          focusTips: "Getarkan bibir bawah dengan gigi atas pada kata favorite, video, dan very.",
          sampleAudio: "This is my favorite video and it is very nice.",
        },
      },
      {
        title: "Huruf Bisu S pada kata 'Island' (Pulau)",
        focusHighlight: "Island = 'AI-LEND' (Huruf S Jangan Dibaca)",
        easyPhonetic: "Ejaan Santai: Dibaca murni 'AI-LEND' (Huruf S adalah Silent Letter)",
        explanation: "Huruf S pada kata 'Island' (pulau) berstatus bisu (silent letter) dan HARAM disuarakan!",
        wrongAudio: {
          label: "BUNYI SALAH (S Dibaca):",
          text: "Is-land (s bersuara)",
          sampleText: "We visit the is-land.",
          explanation: "Membaca huruf S seperti 'Es-land'.",
        },
        correctAudio: {
          label: "BUNYI BENAR (S Bisu):",
          text: "Eye-land (s tidak bersuara)",
          sampleText: "We visit the island.",
          explanation: "Murni melafalkan kata 'Eye' disambung 'land'.",
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
        stepVoiceChallenge: {
          targetSentence: "We will visit the beautiful island tomorrow.",
          easyPronunciation: "WI WIL VI-ZIT D-HI BYU-TI-FUL AI-LEND TU-MO-RO.",
          focusTips: "Huruf S pada island WAJIB bisu: 'AI-LEND' (bukan Is-land).",
          sampleAudio: "We will visit the beautiful island tomorrow.",
        },
      },
      {
        title: "Huruf Bisu B pada kata 'Doubt' (Ragu)",
        focusHighlight: "Doubt = 'DA-UT' (Huruf B Jangan Dibaca)",
        easyPhonetic: "Ejaan Santai: Dibaca murni 'DA-UT' (Huruf B tidak berbunyi)",
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
        stepVoiceChallenge: {
          targetSentence: "I have no doubt that they will pay the debt.",
          easyPronunciation: "AI HEV NO DA-UT DET D-HEI WIL PEI D-HI DET.",
          focusTips: "Huruf B pada doubt ('DA-UT') dan debt ('DET') sama sekali tidak boleh dibunyikan.",
          sampleAudio: "I have no doubt that they will pay the debt.",
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
    voiceChallenge: {
      targetSentence: "I have no doubt that this island is my favorite, thank you.",
      easyPronunciation: "AI HEV NO DA-UT DET D-HIS AI-LEND IZ MAI FE-VE-RIT, T-HENGK YU.",
      focusTips: "Huruf S di island dan B di doubt JANGAN disuarakan. TH berdesis di gigi seri.",
      sampleAudio: "I have no doubt that this island is my favorite, thank you.",
    },
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
        easyPhonetic: "Ejaan Santai: Huruf mati di ujung kata pertama langsung menyambung ke huruf hidup kata berikutnya",
        explanation: "Konsonan di akhir kata pertama langsung disambungkan ke huruf vokal kata berikutnya tanpa jeda.",
        wrongAudio: {
          label: "BUNYI SALAH (Terputus):",
          text: "Hold... On • Pick... It... Up",
          sampleText: "Hold... on... please pick... it... up.",
          explanation: "Membaca kata satu per satu seperti robot.",
        },
        correctAudio: {
          label: "BUNYI BENAR (Mengalir):",
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
        stepVoiceChallenge: {
          targetSentence: "Hold on, please pick it up right now.",
          easyPronunciation: "HOL-DON, PLIZ PI-KI-TAP RAIT NAU.",
          focusTips: "Sambungkan Hold on jadi 'HOL-DON' dan Pick it up jadi 'PI-KI-TAP'.",
          sampleAudio: "Hold on, please pick it up right now.",
        },
      },
      {
        title: "Reduksi Percakapan: 'Gonna' & 'Wanna'",
        focusHighlight: "Going to = 'GONNA' • Want to = 'WANNA'",
        easyPhonetic: "Ejaan Santai: 'AI'M GONNA TEL YU WHAT AI WANNA DU'",
        explanation: "Reduksi ini dipakai secara alami oleh penutur asli saat mengobrol santai dan mengalir cepat.",
        wrongAudio: {
          label: "BUNYI KAKU (Terlalu Formal):",
          text: "I am going to want to go",
          sampleText: "I am going to want to go now.",
          explanation: "Terlalu kaku untuk percakapan harian.",
        },
        correctAudio: {
          label: "BUNYI NATIVE (Luwes):",
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
        stepVoiceChallenge: {
          targetSentence: "I am gonna tell you what I wanna do.",
          easyPronunciation: "AI'M GONNA TEL YU WHAT AI WANNA DU.",
          focusTips: "Lafalkan 'gonna' dan 'wanna' dengan santai dan mengalir.",
          sampleAudio: "I am gonna tell you what I wanna do.",
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
    voiceChallenge: {
      targetSentence: "Hold on, I am gonna pick it up because I wanna see it.",
      easyPronunciation: "HOL-DON, AI'M GONNA PI-KI-TAP BI-KOS AI WANNA SI IT.",
      focusTips: "Sambungkan Hold on jadi HOL-DON, Pick it up jadi PI-KI-TAP, gunakan GONNA & WANNA.",
      sampleAudio: "Hold on, I am gonna pick it up because I wanna see it.",
    },
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
        easyPhonetic: "Ejaan Santai: Langsung ucapkan 'I agree' (Tanpa kata 'am')",
        explanation: "'Agree' adalah kata kerja (verb), bukan kata sifat. Jadi TIDAK BOLEH memakai to be 'am'!",
        wrongAudio: {
          label: "BUNYI SALAH (Indoglish):",
          text: "I am agree with your opinion",
          sampleText: "I am agree with your opinion.",
          explanation: "Menambahkan 'am' sebelum kata kerja.",
        },
        correctAudio: {
          label: "BUNYI BENAR (Standard):",
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
        stepVoiceChallenge: {
          targetSentence: "I agree with your proposal completely.",
          easyPronunciation: "AI E-GRI WIT-H YUR PRO-PO-ZAL KOM-PLIT-LI.",
          focusTips: "Langsung 'I agree' tanpa kata 'am'!",
          sampleAudio: "I agree with your proposal completely.",
        },
      },
      {
        title: "Larangan Keras: 'Thanks before'",
        focusHighlight: "JANGAN: 'Thanks before' → GUNAKAN: 'Thanks in advance'",
        easyPhonetic: "Ejaan Santai: 'TENGKS IN ED-VANS' (Standar Baku Terima Kasih di Awal)",
        explanation: "Penutur asli tidak mengenal frasa 'thanks before'. Untuk ucapan terima kasih di awal bantuan, gunakan 'Thanks in advance'.",
        wrongAudio: {
          label: "BUNYI SALAH (Harfiah):",
          text: "Thanks before for your help",
          sampleText: "Thanks before for your help.",
          explanation: "Menerjemahkan 'terima kasih sebelumnya' kata per kata.",
        },
        correctAudio: {
          label: "BUNYI BENAR (Professional):",
          text: "Thanks in advance for your help",
          sampleText: "Thanks in advance for your support and feedback.",
          explanation: "Standar baku dalam komunikasi internasional.",
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
        stepVoiceChallenge: {
          targetSentence: "Thanks in advance for your support and feedback.",
          easyPronunciation: "TENGKS IN ED-VANS FOR YUR SE-PORT END FID-BEK.",
          focusTips: "Gunakan 'thanks in advance' (jangan sebut thanks before).",
          sampleAudio: "Thanks in advance for your support and feedback.",
        },
      },
      {
        title: "Larangan Keras: 'Join with us'",
        focusHighlight: "JANGAN: 'Join with us' → GUNAKAN: 'Join us' = 'JOIN AS'",
        easyPhonetic: "Ejaan Santai: Langsung ucapkan 'Join us' (Tanpa kata 'with')",
        explanation: "Kata kerja 'Join' sudah otomatis berarti 'bergabung dengan'. Jangan menambahkan kata 'with'!",
        wrongAudio: {
          label: "BUNYI SALAH (Boros Kata):",
          text: "Please join with our community",
          sampleText: "Please join with our community today.",
          explanation: "Menambahkan kata 'with' yang berlebihan.",
        },
        correctAudio: {
          label: "BUNYI BENAR (Tepat):",
          text: "Please join our community / Join us",
          sampleText: "Please join our community and join us for lunch today.",
          explanation: "Langsung sebutkan objek setelah kata join: 'Join us'.",
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
        stepVoiceChallenge: {
          targetSentence: "Please join our team for lunch today.",
          easyPronunciation: "PLIZ JOIN AUR TIM FOR LANCH TU-DEI.",
          focusTips: "Langsung 'join our team' tanpa kata 'with'.",
          sampleAudio: "Please join our team for lunch today.",
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
    voiceChallenge: {
      targetSentence: "I agree with you, please join us and thanks in advance.",
      easyPronunciation: "AI E-GRI WIT-H YU, PLIZ JOIN AS END TENGKS IN ED-VANS.",
      focusTips: "Ucapkan 'I agree' (bukan I am agree), 'join us' (tanpa with), dan 'thanks in advance' (bukan thanks before).",
      sampleAudio: "I agree with you, please join us and thanks in advance.",
    },
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
        easyPhonetic: "Ejaan Santai: Cerita masa lalu langsung reflek pakai kata kerja lampau",
        explanation: "Saat menceritakan apa yang terjadi tadi pagi atau kemarin, ubah kata kerja ke bentuk lampau secara otomatis.",
        wrongAudio: {
          label: "BUNYI SALAH (Tenses):",
          text: "Yesterday I go to office and buy lunch",
          sampleText: "Yesterday I go to office and buy lunch.",
          explanation: "Memakai kata kerja waktu sekarang (V1).",
        },
        correctAudio: {
          label: "BUNYI BENAR (Past Tense):",
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
        stepVoiceChallenge: {
          targetSentence: "Yesterday I went to the office and met the client.",
          easyPronunciation: "YES-TER-DEI AI WENT TU D-HI OFIS END MET D-HI KLAI-ENT.",
          focusTips: "Pastikan bentuk lampau went dan met terucap jelas.",
          sampleAudio: "Yesterday I went to the office and met the client.",
        },
      },
      {
        title: "Pola Bertanya & Meminta Sangat Sopan",
        focusHighlight: "Could you please...? = 'KUD YU PLIZ...?'",
        easyPhonetic: "Ejaan Santai: Gunakan 'Could you please...' untuk meminta tolong dengan anggun",
        explanation: "Hindari kalimat perintah langsung 'I want' atau 'Give me'. Gunakan modal verbs yang anggun.",
        wrongAudio: {
          label: "BUNYI KASAR (Perintah):",
          text: "Give me that report / I want your help",
          sampleText: "Give me that report right now.",
          explanation: "Terdengar kasar dan menuntut.",
        },
        correctAudio: {
          label: "BUNYI ANGGUN (Polite):",
          text: "Could you please share that report when you have time?",
          sampleText: "Could you please share that report whenever you have a moment?",
          explanation: "Membuat lawan bicara merasa dihargai.",
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
        stepVoiceChallenge: {
          targetSentence: "Could you please share the report when you have time?",
          easyPronunciation: "KUD YU PLIZ SHER D-HI RE-PORT WEN YU HEV TAIM?",
          focusTips: "Gunakan 'Could you please' dengan lembut dan sopan.",
          sampleAudio: "Could you please share the report when you have time?",
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
    voiceChallenge: {
      targetSentence: "Could you please help me? Yesterday I went to the office and bought lunch.",
      easyPronunciation: "KUD YU PLIZ HELP MI? YES-TER-DEI AI WENT TU D-HI OFIS END BOT LANCH.",
      focusTips: "Gunakan 'Could you please' dengan lembut, dan pastikan bentuk lampau 'went' dan 'bought' terucap jelas.",
      sampleAudio: "Could you please help me? Yesterday I went to the office and bought lunch.",
    },
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
        easyPhonetic: "Ejaan Santai: 'KEN EV-RI-WAN SI MAI SKRIN? YU AR ON MYUT'",
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
        stepVoiceChallenge: {
          targetSentence: "Can everyone see my screen? You are currently on mute.",
          easyPronunciation: "KEN EV-RI-WAN SI MAI SKRIN? YU AR KA-RENT-LI ON MYUT.",
          focusTips: "Lafalkan frasa 'see my screen' dan 'on mute' dengan intonasi jelas.",
          sampleAudio: "Can everyone see my screen? You are currently on mute.",
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
    voiceChallenge: {
      targetSentence: "Can everyone see my screen? Please give me an iced latte to go.",
      easyPronunciation: "KEN EV-RI-WAN SI MAI SKRIN? PLIZ GIV MI EN AIST LA-TEI TU GO.",
      focusTips: "Ucapkan 'to go' untuk pesanan bawa pulang dan 'see my screen' secara jelas.",
      sampleAudio: "Can everyone see my screen? Please give me an iced latte to go.",
    },
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
        easyPhonetic: "Ejaan Santai: Dengarkan dengan saksama dan buktikan pelafalan suara aslimu",
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
        stepVoiceChallenge: {
          targetSentence: "Could you please lend me the report? Thanks in advance.",
          easyPronunciation: "KUD YU PLIZ LEND MI D-HI RE-PORT? TENGKS IN ED-VANS.",
          focusTips: "Lafalkan 'lend me' dan 'thanks in advance' secara sempurna.",
          sampleAudio: "Could you please lend me the report? Thanks in advance.",
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
    voiceChallenge: {
      targetSentence: "I have no doubt that I will visit this island, could you please join us?",
      easyPronunciation: "AI HEV NO DA-UT DET AI WIL VI-ZIT D-HIS AI-LEND, KUD YU PLIZ JOIN AS?",
      focusTips: "Silent B di doubt, silent S di island, desisan TH, modal polite 'could you please', dan 'join us' tanpa with.",
      sampleAudio: "I have no doubt that I will visit this island, could you please join us?",
    },
  },
];

export function LancarBahasa({ cost = 2, credits = 0 }: { cost?: number; credits?: number }) {
  // 1. Active Mode Persistence
  const [mode, setModeState] = useState<Mode>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("malesan_english_active_mode");
        if (saved && ["academy", "voice", "scenario", "quiz", "essay", "progress"].includes(saved)) {
          return saved as Mode;
        }
      } catch {}
    }
    return "academy";
  });

  const setMode = useCallback((newMode: Mode) => {
    setModeState(newMode);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("malesan_english_active_mode", newMode);
      } catch {}
    }
  }, []);

  // User Level Selection: Defaults to "beginner" (Pemula A1-A2) and persists user choice in localStorage
  const [level, setLevelState] = useState<Level>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("malesan_lancar_level");
        if (saved === "beginner" || saved === "intermediate" || saved === "advanced") {
          return saved as Level;
        }
      } catch {}
    }
    return "beginner"; // Default to Pemula (A1-A2) as natural starting point
  });

  const setLevel = useCallback((newLvl: Level) => {
    setLevelState(newLvl);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("malesan_lancar_level", newLvl);
      } catch {}
    }
  }, []);

  // Voice Persona Selection: Defaults to "david" (US Male) and persists user choice in localStorage
  const [persona, setPersonaState] = useState<Persona>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("malesan_lancar_persona");
        if (saved === "david" || saved === "alex" || saved === "sarah" || saved === "emma") {
          return saved as Persona;
        }
      } catch {}
    }
    return "david";
  });

  const setPersona = useCallback((newP: Persona) => {
    setPersonaState(newP);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("malesan_lancar_persona", newP);
      } catch {}
    }
  }, []);

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string>("Otomatis");

  // Audio Gated Academy States with Auto-Save Persistence
  const [activeStageId, setActiveStageIdState] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("malesan_english_current_stage");
        const num = Number(saved);
        if (num >= 1 && num <= AUDIO_GATED_STAGES.length) return num;
      } catch {}
    }
    return 1;
  });

  const setActiveStageId = useCallback((val: React.SetStateAction<number>) => {
    setActiveStageIdState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("malesan_english_current_stage", String(next));
        } catch {}
      }
      return next;
    });
  }, []);

  const [activeStepIndex, setActiveStepIndexState] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("malesan_english_current_step");
        const num = Number(saved);
        if (num >= 0 && num < 10) return num;
      } catch {}
    }
    return 0;
  });

  const setActiveStepIndex = useCallback((val: React.SetStateAction<number>) => {
    setActiveStepIndexState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("malesan_english_current_step", String(next));
        } catch {}
      }
      return next;
    });
  }, []);

  const [isExamMode, setIsExamMode] = useState<boolean>(false);
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [drillAnswer, setDrillAnswer] = useState<number | null>(null);
  const [currentlyPlayingAudioText, setCurrentlyPlayingAudioText] = useState<string | null>(null);

  // Step-by-Step AI Voice Validation States with Persistence
  const [stepVoiceResults, setStepVoiceResults] = useState<Record<string, VoiceValidationResponse>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("malesan_english_step_results");
        return saved ? JSON.parse(saved) : {};
      } catch {}
    }
    return {};
  });

  const [isRecordingStepVoice, setIsRecordingStepVoice] = useState<boolean>(false);
  const [stepVoiceTranscribing, setStepVoiceTranscribing] = useState<boolean>(false);
  const [stepVoiceRecordedText, setStepVoiceRecordedText] = useState<string>("");

  // Pop-up Window (Modal Dialog) State
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [modalType, setModalType] = useState<"step" | "exam">("step");
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Exam Real Voice Recording Validation States
  const [isRecordingVoiceExam, setIsRecordingVoiceExam] = useState<boolean>(false);
  const [voiceExamTranscribing, setVoiceExamTranscribing] = useState<boolean>(false);
  const [voiceExamResult, setVoiceExamResult] = useState<VoiceValidationResponse | null>(null);
  const [voiceExamRecordedText, setVoiceExamRecordedText] = useState<string>("");

  const [completedStages, setCompletedStages] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("malesan_english_completed_stages");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Lazy recovery from localStorage for chat session
  const initialChatSession = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem("malesan_english_active_chat");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.messages && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return null;
  }, []);

  // Voice & Roleplay Call States with Auto-Resume
  const [isCalling, setIsCalling] = useState(() => initialChatSession?.isCalling || false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [callDuration, setCallDuration] = useState(() => initialChatSession?.callDuration || 0);
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialChatSession?.messages || []);
  const [activeTip, setActiveTip] = useState<string | null>(null);
  const [activeRoast, setActiveRoast] = useState<string | null>(null);
  const [showCallSummary, setShowCallSummary] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});

  // Active Roleplay Scenario State
  const [activeScenario, setActiveScenario] = useState<ScenarioItem | null>(() => initialChatSession?.activeScenario || null);

  // Save active chat on every message update
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        if (messages.length > 0) {
          localStorage.setItem(
            "malesan_english_active_chat",
            JSON.stringify({
              isCalling,
              activeScenario,
              messages,
              callDuration,
              persona,
            })
          );
        }
      } catch {}
    }
  }, [messages, isCalling, activeScenario, callDuration, persona]);

  // Manual Trigger: Simpan Progres Sekarang
  const triggerManualSave = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("malesan_english_current_stage", String(activeStageId));
        localStorage.setItem("malesan_english_current_step", String(activeStepIndex));
        localStorage.setItem("malesan_english_active_mode", mode);
        localStorage.setItem("malesan_english_step_results", JSON.stringify(stepVoiceResults));
        localStorage.setItem("malesan_english_completed_stages", JSON.stringify(completedStages));
        if (messages.length > 0) {
          localStorage.setItem(
            "malesan_english_active_chat",
            JSON.stringify({ isCalling, activeScenario, messages, callDuration, persona })
          );
        }
        const timeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setLastSavedTimestamp(timeStr);
        setSaveNotice("Progres belajar dan riwayat tersimpan aman di perangkat!");
        setTimeout(() => setSaveNotice(null), 3500);
      } catch {
        setSaveNotice("Gagal menyimpan ke penyimpanan lokal");
        setTimeout(() => setSaveNotice(null), 3500);
      }
    }
  }, [activeStageId, activeStepIndex, mode, stepVoiceResults, completedStages, messages, isCalling, activeScenario, callDuration, persona]);

  // Reset Progres ke Tahap 1
  const resetAllProgress = useCallback(() => {
    if (typeof window !== "undefined") {
      if (window.confirm("Apakah kamu yakin ingin mengulang progres belajar dari Tahap 1? Seluruh riwayat nilai akan direset.")) {
        localStorage.removeItem("malesan_english_current_stage");
        localStorage.removeItem("malesan_english_current_step");
        localStorage.removeItem("malesan_english_step_results");
        localStorage.removeItem("malesan_english_completed_stages");
        localStorage.removeItem("malesan_english_active_chat");
        setActiveStageIdState(1);
        setActiveStepIndexState(0);
        setStepVoiceResults({});
        setCompletedStages([]);
        setMessages([]);
        setIsCalling(false);
        setFeedbackNotice("Progres berhasil direset ke Tahap 1. Selamat memulai latihan!");
        setTimeout(() => setFeedbackNotice(null), 4000);
      }
    }
  }, []);

  // Audio Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const stepMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceExamMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const stepSpeechRecRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const voiceExamSpeechRecRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const stepChunksRef = useRef<Blob[]>([]);
  const voiceExamChunksRef = useRef<Blob[]>([]);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drillChamberRef = useRef<HTMLDivElement | null>(null);
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

  // Slangify & Native Polish States
  const [slangifyData, setSlangifyData] = useState<
    Record<string, { original: string; casual: string; executive: string; creator: string; explanation: string }>
  >({});
  const [slangifyLoading, setSlangifyLoading] = useState<Record<string, boolean>>({});
  const [openSlangify, setOpenSlangify] = useState<Record<string, boolean>>({});

  // Slangify API Trigger
  const triggerSlangify = async (messageId: string, text: string, context?: string) => {
    if (slangifyData[messageId]) {
      setOpenSlangify((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
      return;
    }
    setSlangifyLoading((prev) => ({ ...prev, [messageId]: true }));
    setOpenSlangify((prev) => ({ ...prev, [messageId]: true }));

    try {
      const res = await fetch("/api/speaking/slangify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, context: context || activeScenario?.context || "General English" }),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setSlangifyData((prev) => ({ ...prev, [messageId]: json.data }));
      } else {
        setFeedbackNotice(json.error || "Gagal memproses Slangify.");
      }
    } catch {
      setFeedbackNotice("Gagal terhubung ke server Slangify.");
    } finally {
      setSlangifyLoading((prev) => ({ ...prev, [messageId]: false }));
    }
  };

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

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isVoiceModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isVoiceModalOpen]);

  // Warm up SpeechSynthesis Voices for Instant Native Playback
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      const onVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      };
    }
  }, []);

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

  // Explicit helper to smoothly scroll back to top of lesson card only when navigating steps
  const scrollToDrillTop = useCallback(() => {
    if (drillChamberRef.current) {
      drillChamberRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Play Speech Audio with Authentic Human Neural Voice (David = Real US Male, Alex = Real US Male, Sarah = UK Female, Emma = US Female, indonesian = Stiff Indo accent)
  const playSpeechAudio = useCallback(
    async (
      text: string,
      customPersona?: Persona | "indonesian",
      directAudioUrl?: string | null,
      customLang?: string
    ) => {
      const activeP = customPersona || persona;
      const isIndoVoice = activeP === "indonesian" || customLang === "id" || customLang === "id-ID";
      const profile = isIndoVoice
        ? { lang: "id-ID", pitch: 1.0, preferredKeywords: ["Indonesian", "id-ID", "Gadis", "Andika", "Indonesia"] }
        : PERSONA_VOICE_PROFILES[activeP as Persona] || PERSONA_VOICE_PROFILES.david;
      setCurrentlyPlayingAudioText(text);

      // Stop any existing HTML audio playback
      if (currentAudioElementRef.current) {
        currentAudioElementRef.current.pause();
        currentAudioElementRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      setIsPlayingAudio(true);

      // 1. Direct Audio URL playback (Instant 0ms audio sync from converse API - Zero Delay)
      if (directAudioUrl) {
        try {
          const audio = new Audio(directAudioUrl);
          audio.playbackRate = playbackSpeed;
          currentAudioElementRef.current = audio;
          audio.onended = () => {
            setIsPlayingAudio(false);
            setCurrentlyPlayingAudioText(null);
          };
          audio.onerror = () => {
            setIsPlayingAudio(false);
            setCurrentlyPlayingAudioText(null);
          };
          await audio.play();
          return;
        } catch (e) {
          console.warn("Direct audio URL play error:", e);
        }
      }

      // 2. Server-Side Authentic Neural Human Voice (Polly for Native US/UK, Google TTS for Indonesian)
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            persona: isIndoVoice ? "indonesian" : activeP,
            lang: isIndoVoice ? "id" : (customLang || profile.lang),
          }),
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
        console.warn("Server TTS playback error, attempting local fallback:", err);
      }

      // 3. Fallback: Native Web Speech Synthesis
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = isIndoVoice ? "id-ID" : profile.lang;
          utterance.pitch = profile.pitch;
          utterance.rate = playbackSpeed * (isIndoVoice ? 1.0 : 1.12);

          const voices = window.speechSynthesis.getVoices();
          if (voices && voices.length > 0) {
            const langPrefix = (isIndoVoice ? "id" : profile.lang.split("-")[0]).toLowerCase();
            const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
            const pool = langVoices.length > 0 ? langVoices : voices;

            let matchedVoice: SpeechSynthesisVoice | null = null;
            for (const kw of profile.preferredKeywords) {
              const found = pool.find((v) => v.name.toLowerCase().includes(kw.toLowerCase()));
              if (found) {
                matchedVoice = found;
                break;
              }
            }
            if (matchedVoice) {
              utterance.voice = matchedVoice;
            }
          }

          utterance.onend = () => {
            setIsPlayingAudio(false);
            setCurrentlyPlayingAudioText(null);
          };
          utterance.onerror = () => {
            setIsPlayingAudio(false);
            setCurrentlyPlayingAudioText(null);
          };

          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn("Local speech synthesis fallback error:", err);
          setIsPlayingAudio(false);
          setCurrentlyPlayingAudioText(null);
        }
      } else {
        setIsPlayingAudio(false);
        setCurrentlyPlayingAudioText(null);
      }
    },
    [persona, playbackSpeed]
  );

  // =========================================================================
  // STEP-BY-STEP VOICE RECORDING VALIDATION HANDLER
  // =========================================================================
  const toggleStepVoiceRecording = async (stage: AudioGatedStage, step: AudioLessonStep, stepKey: string) => {
    if (stepVoiceTranscribing) return;

    if (isRecordingStepVoice) {
      setIsRecordingStepVoice(false);

      if (stepSpeechRecRef.current) {
        try {
          stepSpeechRecRef.current.stop();
        } catch {}
      }

      if (stepMediaRecorderRef.current && stepMediaRecorderRef.current.state !== "inactive") {
        try {
          stepMediaRecorderRef.current.stop();
        } catch {}
      }
    } else {
      setStepVoiceRecordedText("");
      setFeedbackNotice(null);

      const SpeechRecognition =
        typeof window !== "undefined"
          ? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstanceLike; webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike }).SpeechRecognition ||
            (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstanceLike; webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike }).webkitSpeechRecognition
          : null;

      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = "en-US";
          rec.onresult = (event: SpeechRecognitionEventLike) => {
            let tr = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              tr += event.results[i][0].transcript;
            }
            if (tr.trim()) {
              setStepVoiceRecordedText(tr.trim());
            }
          };
          rec.start();
          stepSpeechRecRef.current = rec;
        } catch (e) {
          console.warn("SpeechRec step voice exam failed to start:", e);
        }
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

        const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        stepMediaRecorderRef.current = mediaRecorder;
        stepChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            stepChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const audioBlob = new Blob(stepChunksRef.current, {
            type: mediaRecorder.mimeType || "audio/webm",
          });
          await submitStepVoiceValidation(stage, step, stepKey, audioBlob, stepVoiceRecordedText);
        };

        mediaRecorder.start(200);
        setIsRecordingStepVoice(true);
      } catch (err) {
        console.warn("Mic getUserMedia failed:", err);
        setIsRecordingStepVoice(true);
      }
    }
  };

  const submitStepVoiceValidation = async (
    stage: AudioGatedStage,
    step: AudioLessonStep,
    stepKey: string,
    blobParam?: Blob | null,
    textParam?: string,
  ) => {
    setStepVoiceTranscribing(true);
    setFeedbackNotice(null);

    try {
      const activeBlob = blobParam;
      const activeText = textParam || stepVoiceRecordedText;

      let res: Response;

      if (activeBlob && activeBlob.size > 100) {
        const formData = new FormData();
        formData.append("audio", activeBlob, "user_step_voice.webm");
        formData.append("targetSentence", step.stepVoiceChallenge.targetSentence);
        formData.append("stageId", String(stage.id));
        formData.append("stageTitle", `${stage.title} - ${step.title}`);
        formData.append("focusPhonetics", step.stepVoiceChallenge.focusTips);
        if (activeText) formData.append("text", activeText);

        res = await fetch("/api/speaking/validate-voice", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/speaking/validate-voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: activeText || step.stepVoiceChallenge.targetSentence,
            targetSentence: step.stepVoiceChallenge.targetSentence,
            stageId: stage.id,
            stageTitle: `${stage.title} - ${step.title}`,
            focusPhonetics: step.stepVoiceChallenge.focusTips,
          }),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal memvalidasi suara pelafalan.");
      }

      const payload = await res.json();
      const valResult: VoiceValidationResponse = payload.data;

      setStepVoiceResults((prev) => ({
        ...prev,
        [stepKey]: valResult,
      }));

      if (valResult.isPassed) {
        saveSessionRecord({
          type: "academy",
          title: `Lulus Suara: ${step.title}`,
          score: valResult.score,
        });
      }
    } catch (err) {
      setFeedbackNotice(err instanceof Error ? err.message : "Terjadi kesalahan saat memvalidasi suara.");
    } finally {
      setStepVoiceTranscribing(false);
    }
  };

  // =========================================================================
  // STAGE EXAM REAL VOICE VALIDATION
  // =========================================================================
  const toggleVoiceExamRecording = async (stage: AudioGatedStage) => {
    if (voiceExamTranscribing) return;

    if (isRecordingVoiceExam) {
      setIsRecordingVoiceExam(false);

      if (voiceExamSpeechRecRef.current) {
        try {
          voiceExamSpeechRecRef.current.stop();
        } catch {}
      }

      if (voiceExamMediaRecorderRef.current && voiceExamMediaRecorderRef.current.state !== "inactive") {
        try {
          voiceExamMediaRecorderRef.current.stop();
        } catch {}
      }
    } else {
      setVoiceExamResult(null);
      setVoiceExamRecordedText("");
      setFeedbackNotice(null);

      const SpeechRecognition =
        typeof window !== "undefined"
          ? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstanceLike; webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike }).SpeechRecognition ||
            (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstanceLike; webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike }).webkitSpeechRecognition
          : null;

      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = "en-US";
          rec.onresult = (event: SpeechRecognitionEventLike) => {
            let tr = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              tr += event.results[i][0].transcript;
            }
            if (tr.trim()) {
              setVoiceExamRecordedText(tr.trim());
            }
          };
          rec.start();
          voiceExamSpeechRecRef.current = rec;
        } catch (e) {
          console.warn("SpeechRec voice exam failed to start:", e);
        }
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

        const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        voiceExamMediaRecorderRef.current = mediaRecorder;
        voiceExamChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            voiceExamChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const audioBlob = new Blob(voiceExamChunksRef.current, {
            type: mediaRecorder.mimeType || "audio/webm",
          });
          await submitVoiceExamValidation(stage, audioBlob, voiceExamRecordedText);
        };

        mediaRecorder.start(200);
        setIsRecordingVoiceExam(true);
      } catch (err) {
        console.warn("Mic getUserMedia failed:", err);
        setIsRecordingVoiceExam(true);
      }
    }
  };

  const submitVoiceExamValidation = async (stage: AudioGatedStage, blobParam?: Blob | null, textParam?: string) => {
    setVoiceExamTranscribing(true);
    setFeedbackNotice(null);

    try {
      const activeBlob = blobParam;
      const activeText = textParam || voiceExamRecordedText;

      let res: Response;

      if (activeBlob && activeBlob.size > 100) {
        const formData = new FormData();
        formData.append("audio", activeBlob, "user_voice_exam.webm");
        formData.append("targetSentence", stage.voiceChallenge.targetSentence);
        formData.append("stageId", String(stage.id));
        formData.append("stageTitle", stage.title);
        formData.append("focusPhonetics", stage.voiceChallenge.focusTips);
        if (activeText) formData.append("text", activeText);

        res = await fetch("/api/speaking/validate-voice", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/speaking/validate-voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: activeText || stage.voiceChallenge.targetSentence,
            targetSentence: stage.voiceChallenge.targetSentence,
            stageId: stage.id,
            stageTitle: stage.title,
            focusPhonetics: stage.voiceChallenge.focusTips,
          }),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal memvalidasi suara pelafalan.");
      }

      const payload = await res.json();
      const valResult: VoiceValidationResponse = payload.data;
      setVoiceExamResult(valResult);

      if (valResult.isPassed) {
        if (!completedStages.includes(stage.id)) {
          const updated = [...completedStages, stage.id];
          setCompletedStages(updated);
          try {
            localStorage.setItem("malesan_english_completed_stages", JSON.stringify(updated));
          } catch {}
        }

        saveSessionRecord({
          type: "academy",
          title: `Lulus Ujian Suara: ${stage.title}`,
          score: valResult.score,
        });
      }
    } catch (err) {
      setFeedbackNotice(err instanceof Error ? err.message : "Terjadi kesalahan saat memvalidasi suara.");
    } finally {
      setVoiceExamTranscribing(false);
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
    if (!isCalling && !isRecordingVoiceExam && !isRecordingStepVoice) return;

    let animId: number;

    const renderWaveform = () => {
      const canvas = modalCanvasRef.current || canvasRef.current;
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
            const barHeight = isRecording || isRecordingVoiceExam || isRecordingStepVoice
              ? Math.max(8, freq * (height * 0.9))
              : isPlayingAudio
              ? Math.max(6, Math.sin(time * 3 + i * 0.4) * (height * 0.75))
              : isProcessing || voiceExamTranscribing || stepVoiceTranscribing
              ? Math.max(4, Math.sin(time * 2 + i * 0.2) * (height * 0.45))
              : 4;

            const x = i * (barWidth + gap);
            const y = (height - barHeight) / 2;

            ctx.fillStyle = isRecording || isRecordingVoiceExam || isRecordingStepVoice
              ? "#ef4444"
              : isPlayingAudio
              ? "#10b981"
              : isProcessing || voiceExamTranscribing || stepVoiceTranscribing
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
  }, [isCalling, isRecording, isProcessing, isPlayingAudio, isRecordingVoiceExam, voiceExamTranscribing, isRecordingStepVoice, stepVoiceTranscribing, isVoiceModalOpen]);

  // Start Voice Call or Scenario Chamber
  const startCall = (scenarioItem?: ScenarioItem) => {
    if (credits < cost) {
      setFeedbackNotice(`Kredit lo kurang (${credits} tersisa). Butuh minimal ${cost} kredit.`);
      return;
    }
    const chosenPersona = scenarioItem ? scenarioItem.partner : persona;
    if (scenarioItem) {
      setActiveScenario(scenarioItem);
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

  // Toggle Recording for Free Speaking Call
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

  // Submit Audio Blob for Free Speaking Call
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

      playSpeechAudio(data.replyEn, activeP, data.audioUrl);
    } catch (err) {
      setFeedbackNotice(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit Text Input Message for Free Speaking Call
  const submitTextMessage = async (explicitText?: string) => {
    const userText = (explicitText || textInput).trim();
    if (!userText || isProcessing) return;

    setTextInput("");
    capturedTextRef.current = "";
    setIsProcessing(true);
    setFeedbackNotice(null);

    const activeP = activeScenario ? activeScenario.partner : persona;
    const activeScenTitle = activeScenario ? activeScenario.title : "daily";

    // Optimistic UI: immediately show user's message in the chat
    const userMsg: ChatMessage = {
      id: makeId("usr"),
      role: "user",
      text: userText,
    };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);

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

      const assistantMsg: ChatMessage = {
        id: makeId("ast"),
        role: "assistant",
        text: data.replyEn,
        translateId: data.translateId,
        suggestedReplies: data.suggestedReplies,
        tip: data.correctionTip,
        pitfallTag: data.pitfallTag,
        roast: data.roastComment,
        score: data.fluencyScore,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (data.correctionTip) setActiveTip(data.correctionTip);
      if (data.roastComment) setActiveRoast(data.roastComment);

      playSpeechAudio(data.replyEn, activeP, data.audioUrl);
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

  const activeStage = AUDIO_GATED_STAGES.find((s) => s.id === activeStageId) || AUDIO_GATED_STAGES[0];
  const activeStep = activeStage.steps[activeStepIndex] || activeStage.steps[0];
  const currentStepKey = `stage_${activeStage.id}_step_${activeStepIndex}`;
  const currentStepVoiceResult = stepVoiceResults[currentStepKey] || null;

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-3 sm:space-y-4">
      {/* GLOBAL NOTIFICATION NOTICE */}
      {feedbackNotice && (
        <div className="rounded-2xl border border-ember/40 bg-ember/15 p-3 sm:p-4 text-xs sm:text-sm font-medium text-ember flex items-center justify-between animate-in fade-in duration-200">
          <span className="min-w-0 pr-2">{feedbackNotice}</span>
          <button
            onClick={() => setFeedbackNotice(null)}
            className="text-micro font-bold underline hover:opacity-80 shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* TOP HEADER CONTAINER */}
      <div className="surface-card rounded-2xl sm:rounded-3xl border border-hairline/80 bg-surface/85 p-3.5 sm:p-5 backdrop-blur-xl shadow-lg space-y-3 sm:space-y-4 w-full min-w-0">
        {/* Title & Level Selector Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full border border-ember/35 bg-ember/15 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-ember uppercase tracking-wider">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3 text-ember shrink-0">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
                AI English Studio
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono font-bold text-muted bg-surface-raised px-2 py-0.5 rounded-md border border-hairline">
                {cost} Kredit / Sesi
              </span>
            </div>

            <h1 className="font-display text-base sm:text-xl font-bold text-ink tracking-tight truncate">
              Lancar Inggris
            </h1>
            <p className="text-[11px] sm:text-xs text-muted leading-relaxed line-clamp-2 sm:line-clamp-none">
              Validasi suara asli per langkah, ear-training salah vs benar, speaking partner native, &amp; esai.
            </p>
          </div>

          {/* 100% FLEXIBLE ANTI-OFFSIDE LEVEL SELECTOR */}
          <div className="w-full lg:w-auto shrink-0 min-w-0">
            <div className="grid grid-cols-3 w-full gap-1 rounded-2xl border border-hairline bg-surface-raised/90 p-1 shadow-xs min-w-0">
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
                    className={`h-8 sm:h-9 px-1.5 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 min-w-0 truncate cursor-pointer ${
                      isActive
                        ? "bg-ember text-obsidian shadow-sm ring-1 ring-ember/50 font-display"
                        : "text-muted hover:text-ink hover:bg-surface"
                    }`}
                  >
                    <span className="truncate">{lvl.name}</span>
                    <span
                      className={`hidden xs:inline-block text-[9px] sm:text-[10px] font-mono px-1 py-0.2 rounded ${
                        isActive ? "bg-obsidian/20 text-obsidian font-bold" : "bg-surface text-muted/70 border border-hairline/60"
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

        {/* 🛡️ AUTO-SAVE STATUS & QUICK SYNC STRIP */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-raised/40 px-3 py-1.5 rounded-xl border border-hairline/70 text-[10px] sm:text-[11px]">
          <div className="flex items-center gap-1.5 text-muted min-w-0 truncate">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-medium text-ink truncate">Progres Otomatis Tersimpan</span>
            <span className="text-muted/70 hidden xs:inline">• Terakhir: {lastSavedTimestamp}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saveNotice && (
              <span className="text-emerald-400 font-bold text-[10px] animate-in fade-in">
                ✓ {saveNotice}
              </span>
            )}
            <button
              type="button"
              onClick={triggerManualSave}
              className="h-6 px-2 rounded-lg border border-ember/30 bg-ember/10 hover:bg-ember/20 text-ember text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Simpan status belajar dan riwayat chat ke memori browser sekarang"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>Simpan Progres</span>
            </button>
          </div>
        </div>

        {/* 6 COMPACT STREAMLINED SUB-MODULE TABS */}
        <div className="border-t border-hairline/60 pt-2.5 sm:pt-3">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
            {[
              {
                id: "academy",
                label: "Belajar 0-100%",
                sub: "Uji Suara Pop-up",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 sm:size-4">
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 sm:size-4">
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 sm:size-4">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                ),
              },
              {
                id: "quiz",
                label: "Kuis",
                sub: "Kuis Kilat Pro",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 sm:size-4">
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 sm:size-4">
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 sm:size-4">
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
                  className={`h-10 sm:h-12 rounded-xl sm:rounded-2xl border p-1.5 sm:p-2 transition-all text-left flex items-center gap-1.5 sm:gap-2 w-full min-w-0 cursor-pointer ${
                    isCurrent
                      ? "border-ember/70 bg-ember/15 text-ink shadow-sm ring-1 ring-ember/30"
                      : "border-hairline bg-surface hover:border-hairline/90 hover:bg-surface-raised text-muted"
                  }`}
                >
                  <div
                    className={`size-6 sm:size-7 shrink-0 rounded-lg sm:rounded-xl flex items-center justify-center ${
                      isCurrent ? "bg-ember text-obsidian font-bold" : "bg-surface-raised border border-hairline text-muted"
                    }`}
                  >
                    {tab.icon}
                  </div>
                  <div className="min-w-0 flex-1 truncate">
                    <span className={`text-[11px] sm:text-xs font-bold block truncate ${isCurrent ? "text-ember" : "text-ink"}`}>
                      {tab.label}
                    </span>
                    <span className="hidden sm:block text-[10px] text-muted truncate">{tab.sub}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 0: BELAJAR 0-100% (CLEAN COMPACT STEP ARENA + ISOLATED POP-UP MODAL) */}
      {/* ========================================================================= */}
      <div className={mode === "academy" ? "w-full min-w-0" : "hidden"}>
        <div className="surface-card rounded-2xl sm:rounded-3xl border border-hairline/80 bg-surface/90 p-3.5 sm:p-6 backdrop-blur-xl shadow-xl space-y-4 sm:space-y-5 w-full min-w-0">
          {/* COMPACT STAGE PROGRESSION HEADER */}
          <div className="space-y-2.5">
            {/* Header Title + Mastery Ring */}
            <div className="flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] font-bold text-ember uppercase tracking-wider block truncate">
                  Belajar 0% → 100% (Uji Suara Pop-up)
                </span>
                <h2 className="font-display text-sm sm:text-base font-bold text-ink truncate mt-0.5">
                  {activeStage.title}
                </h2>
              </div>

              {/* Progress Metric Pill */}
              <div className="flex items-center gap-2 rounded-xl sm:rounded-2xl border border-ember/30 bg-ember/10 px-2.5 py-1.5 shrink-0">
                <div className="size-7 sm:size-8 rounded-lg sm:rounded-xl bg-ember flex items-center justify-center text-obsidian font-display font-bold text-[11px] sm:text-xs">
                  {masteryPercentage}%
                </div>
                <div className="hidden xs:block text-right">
                  <p className="text-[9px] font-bold text-muted uppercase">Penguasaan</p>
                  <p className="text-[11px] font-bold text-ink">{completedStages.length}/6 Selesai</p>
                </div>
              </div>
            </div>

            {/* RESPONSIVE STAGE STEPPER */}
            <div className="grid grid-cols-6 gap-1 sm:gap-2 w-full min-w-0">
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
                      setExamAnswers({});
                      setDrillAnswer(null);
                      setVoiceExamResult(null);
                      setVoiceExamRecordedText("");
                      scrollToDrillTop();
                    }}
                    className={`rounded-xl sm:rounded-2xl border p-1.5 sm:p-2.5 text-center transition-all relative flex flex-col items-center justify-center h-12 sm:h-16 cursor-pointer min-w-0 ${borderStyle}`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[9px] sm:text-[10px] font-mono font-bold text-muted">T{stg.id}</span>
                      {isCompleted ? (
                        <span className="size-3 sm:size-4 rounded-full bg-emerald-400 text-obsidian text-[8px] sm:text-[10px] font-bold flex items-center justify-center">
                          ✓
                        </span>
                      ) : !isUnlocked ? (
                        <span className="text-[9px] sm:text-[10px] text-muted">🔒</span>
                      ) : isCurrent ? (
                        <span className="size-1.5 sm:size-2 rounded-full bg-ember animate-ping" />
                      ) : null}
                    </div>
                    <span className="text-[9px] sm:text-[11px] font-bold text-ink mt-0.5 truncate w-full">
                      {stg.percentage}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTIVE STAGE DRILL CHAMBER */}
          <div ref={drillChamberRef} className="border-t border-hairline/60 pt-3 sm:pt-4 space-y-3 sm:space-y-4 scroll-mt-20 sm:scroll-mt-24">
            {!isExamMode ? (
              /* CLEAN COMPACT LESSON STEP VIEW (NO BLOATED INLINE CARDS) */
              <div className="space-y-3 sm:space-y-4 animate-in fade-in duration-200">
                {/* Step Progress Pill */}
                <div className="flex items-center justify-between bg-surface-raised/70 px-3 py-2 rounded-xl border border-hairline">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-ember bg-ember/15 px-2 py-0.5 rounded-md shrink-0">
                      Langkah {activeStepIndex + 1}/{activeStage.steps.length}
                    </span>
                    <span className="text-xs font-bold text-ink truncate">{activeStep.title}</span>
                  </div>

                  {currentStepVoiceResult?.isPassed && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
                      ✓ Suara Lulus ({currentStepVoiceResult.score})
                    </span>
                  )}
                </div>

                {/* Big Interactive Focus Arena */}
                <div className="rounded-2xl sm:rounded-3xl border border-ember/30 bg-gradient-to-b from-surface-raised to-surface p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 shadow-md w-full min-w-0">
                  {/* Focus Sound Banner */}
                  <div className="space-y-1 border-b border-hairline/60 pb-3">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Fokus Bunyi:</p>
                    <h3 className="font-display text-sm sm:text-lg font-bold text-ember leading-snug">
                      {activeStep.focusHighlight}
                    </h3>
                    <p className="text-[11px] sm:text-xs font-medium text-ink bg-surface-raised px-2.5 py-1 rounded-lg border border-hairline inline-block mt-0.5">
                      {activeStep.easyPhonetic}
                    </p>
                    <p className="text-[11px] sm:text-xs text-muted mt-1 leading-relaxed">{activeStep.explanation}</p>
                  </div>

                  {/* DUAL-AUDIO SIDE-BY-SIDE */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
                      Dengarkan Perbandingan Suara:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {/* WRONG AUDIO BUTTON */}
                      <div className="rounded-xl sm:rounded-2xl border border-rose-500/30 bg-rose-500/10 p-2.5 sm:p-3.5 flex flex-col justify-between space-y-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] sm:text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                              {activeStep.wrongAudio.label}
                            </span>
                            <span className="size-1.5 sm:size-2 rounded-full bg-rose-500" />
                          </div>
                          <p className="text-[11px] sm:text-xs font-bold text-ink truncate">{activeStep.wrongAudio.text}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => playSpeechAudio(activeStep.wrongAudio.sampleText, "indonesian" as unknown as Persona, null, "id")}
                          className="h-9 sm:h-10 px-3 rounded-xl border border-rose-500/40 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer w-full"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </svg>
                          <span className="truncate">{currentlyPlayingAudioText === activeStep.wrongAudio.sampleText ? "Memutar..." : "Putar Bunyi Salah"}</span>
                        </button>
                      </div>

                      {/* CORRECT AUDIO BUTTON */}
                      <div className="rounded-xl sm:rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 sm:p-3.5 flex flex-col justify-between space-y-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                              {activeStep.correctAudio.label}
                            </span>
                            <span className="size-1.5 sm:size-2 rounded-full bg-emerald-400" />
                          </div>
                          <p className="text-[11px] sm:text-xs font-bold text-ink truncate">{activeStep.correctAudio.text}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => playSpeechAudio(activeStep.correctAudio.sampleText, "david", null, "en-US")}
                          className="btn-ember h-9 sm:h-10 px-3 rounded-xl text-obsidian text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md hover:brightness-105 cursor-pointer w-full"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </svg>
                          <span className="truncate">{currentlyPlayingAudioText === activeStep.correctAudio.sampleText ? "Memutar..." : "Putar Bunyi Benar (Bule)"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tongue Tip */}
                  <div className="rounded-xl border border-hairline bg-surface-raised p-2.5 text-[11px] sm:text-xs text-muted flex items-start gap-2">
                    <span className="text-ember font-bold shrink-0">💡</span>
                    <p><b>Posisi Lidah:</b> {activeStep.tongueTip}</p>
                  </div>

                  {/* UJI PEMAHAMAN TELINGA (PILIHAN GANDA) */}
                  <div className="rounded-2xl sm:rounded-3xl border border-ember/35 bg-surface-raised/80 p-3 sm:p-4 space-y-3 shadow-sm w-full min-w-0">
                    <div>
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-ember uppercase tracking-wider">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3 text-ember">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        Uji Pemahaman Suara:
                      </span>
                      <p className="font-display text-xs sm:text-sm font-bold text-ink mt-0.5 leading-snug">
                        {activeStep.audioDrill.prompt}
                      </p>
                    </div>

                    {/* Choice Cards */}
                    <div className="space-y-2">
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
                              if (drillAnswer === null) {
                                setDrillAnswer(optIdx);
                                if (opt.isCorrect && !currentStepVoiceResult?.isPassed) {
                                  // Automatically open the voice validation modal!
                                  setModalType("step");
                                  setIsVoiceModalOpen(true);
                                }
                              }
                            }}
                            className={`rounded-xl sm:rounded-2xl border p-2.5 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all cursor-pointer group w-full min-w-0 ${cardStyle}`}
                          >
                            <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                              <div
                                className={`size-7 sm:size-8 rounded-full flex items-center justify-center font-display font-bold text-xs shrink-0 transition-all ${
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
                                <p className="text-xs sm:text-sm font-bold text-ink group-hover:text-ember transition-colors leading-snug">
                                  {opt.text}
                                </p>
                                <p className="text-[10px] sm:text-[11px] text-muted leading-tight">
                                  {opt.subtext}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playSpeechAudio(
                                  opt.soundSample,
                                  opt.isCorrect ? "david" : ("indonesian" as unknown as Persona),
                                  null,
                                  opt.isCorrect ? "en-US" : "id"
                                );
                              }}
                              className="btn-ember h-8 sm:h-9 px-3 rounded-lg sm:rounded-xl text-obsidian text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto shadow-sm hover:brightness-105"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3">
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
                      <div className="rounded-xl sm:rounded-2xl border border-hairline bg-surface p-3 sm:p-3.5 text-xs leading-relaxed animate-in fade-in duration-200 space-y-1">
                        <p className={`font-display text-xs sm:text-sm font-bold ${activeStep.audioDrill.options[drillAnswer].isCorrect ? "text-emerald-400" : "text-rose-400"}`}>
                          {activeStep.audioDrill.options[drillAnswer].isCorrect ? "Jawaban 100% Tepat!" : "Jawaban Kurang Tepat!"}
                        </p>
                        <p className="text-muted text-[11px] sm:text-xs">
                          <b>Penjelasan:</b> {activeStep.audioDrill.explanation}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* CLEAN NAVIGATION & POPUP TRIGGER BAR */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-hairline/60 gap-2">
                    <button
                      disabled={activeStepIndex === 0}
                      onClick={() => {
                        setActiveStepIndex((prev) => prev - 1);
                        setDrillAnswer(null);
                        setStepVoiceRecordedText("");
                        scrollToDrillTop();
                      }}
                      className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl border border-hairline bg-surface text-xs font-bold text-ink hover:bg-surface-raised disabled:opacity-30 cursor-pointer shrink-0"
                    >
                      ← Sebelumnya
                    </button>

                    {/* Step Navigation or Voice Popup Trigger */}
                    {drillAnswer === null || !activeStep.audioDrill.options[drillAnswer]?.isCorrect ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] sm:text-[11px] font-mono font-bold text-muted bg-surface-raised px-2.5 sm:px-3 py-1.5 rounded-xl border border-hairline">
                          {drillAnswer === null ? "Pilih jawaban kuis di atas" : "Pilih opsi yang benar"}
                        </span>
                      </div>
                    ) : !currentStepVoiceResult?.isPassed ? (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setModalType("step");
                            setIsVoiceModalOpen(true);
                          }}
                          className="btn-ember h-9 sm:h-10 px-4 sm:px-5 rounded-xl font-display text-xs font-bold text-obsidian shadow-md animate-pulse cursor-pointer shrink-0 flex items-center gap-1.5"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" x2="12" y1="19" y2="22" />
                          </svg>
                          <span>🎙️ Uji Rekam Suara (Wajib)</span>
                        </button>
                        <span className="text-[9px] text-amber-400 font-bold">
                          {currentStepVoiceResult
                            ? `Skor suara ${currentStepVoiceResult.score}/100 — Buka pop-up rekam ulang`
                            : "Buka pop-up rekam suara untuk lanjut"}
                        </span>
                      </div>
                    ) : activeStepIndex < activeStage.steps.length - 1 ? (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setActiveStepIndex((prev) => prev + 1);
                            setDrillAnswer(null);
                            setStepVoiceRecordedText("");
                            scrollToDrillTop();
                          }}
                          className="btn-ember h-9 sm:h-10 px-4 sm:px-5 rounded-xl font-display text-xs font-bold text-obsidian shadow-md cursor-pointer shrink-0"
                        >
                          Langkah Berikutnya →
                        </button>
                        <span className="text-[9px] text-emerald-400 font-bold">✓ Lolos Uji Suara</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setIsExamMode(true);
                            setExamAnswers({});
                            setVoiceExamResult(null);
                            setVoiceExamRecordedText("");
                            scrollToDrillTop();
                          }}
                          className="btn-ember h-9 sm:h-10 px-4 sm:px-6 rounded-xl font-display text-xs font-bold text-obsidian shadow-md animate-pulse cursor-pointer shrink-0"
                        >
                          Ujian Kelulusan Tahap Ini →
                        </button>
                        <span className="text-[9px] text-emerald-400 font-bold">✓ Lolos Uji Suara</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* STAGE GATEKEEPER EXAM VIEW (WITH POPUP VOICE VALIDATION TRIGGER) */
              <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-300">
                <div className="flex items-center justify-between bg-surface-raised/50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-hairline">
                  <div className="min-w-0 pr-2">
                    <span className="text-[10px] font-mono font-bold text-ember uppercase">Ujian Akhir {activeStage.badge}</span>
                    <h3 className="font-display text-xs sm:text-base font-bold text-ink truncate mt-0.5">
                      Validasi Suara Asli: {activeStage.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setIsExamMode(false);
                      setVoiceExamResult(null);
                      scrollToDrillTop();
                    }}
                    className="h-8 px-2.5 sm:px-3 rounded-lg border border-hairline bg-surface text-[11px] sm:text-xs font-bold text-muted hover:text-ink cursor-pointer shrink-0"
                  >
                    Kembali ke Materi
                  </button>
                </div>

                {/* Bagian 1: Uji Teori Pilihan Ganda */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-ember" />
                    <h4 className="font-display text-xs sm:text-sm font-bold text-ink uppercase tracking-wider">
                      Bagian 1: Uji Teori &amp; Telinga (Pilihan Ganda)
                    </h4>
                  </div>

                  {activeStage.exam.map((q, qIdx) => (
                    <div key={qIdx} className="rounded-xl sm:rounded-2xl border border-hairline bg-surface-raised p-3 sm:p-4 space-y-2.5">
                      <h4 className="font-display text-xs sm:text-sm font-bold text-ink leading-snug">
                        {qIdx + 1}. {q.question}
                      </h4>
                      <div className="space-y-1.5 sm:space-y-2">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = examAnswers[qIdx] === optIdx;

                          let style = "border-hairline/90 bg-surface hover:border-ember/70 hover:bg-surface-raised";
                          if (isSelected) {
                            style = "border-ember bg-ember/15 text-ember font-bold ring-1 ring-ember/50";
                          }

                          return (
                            <div
                              key={optIdx}
                              onClick={() => {
                                setExamAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
                              }}
                              className={`rounded-xl sm:rounded-2xl border p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all cursor-pointer w-full min-w-0 ${style}`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div
                                  className={`size-6 sm:size-7 rounded-full flex items-center justify-center font-display font-bold text-xs shrink-0 ${
                                    isSelected ? "bg-ember text-obsidian" : "bg-surface-raised border border-hairline text-muted"
                                  }`}
                                >
                                  {String.fromCharCode(65 + optIdx)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-ink leading-snug">{opt.text}</p>
                                  {opt.subtext && <p className="text-[10px] text-muted">{opt.subtext}</p>}
                                </div>
                              </div>

                              {opt.soundSample && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    playSpeechAudio(
                                      opt.soundSample || opt.text,
                                      optIdx === q.correctIndex ? "david" : ("indonesian" as unknown as Persona),
                                      null,
                                      optIdx === q.correctIndex ? "en-US" : "id"
                                    );
                                  }}
                                  className="btn-ember h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg text-obsidian text-[10px] sm:text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 self-start sm:self-auto shadow-xs"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                  </svg>
                                  Dengar
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bagian 2: POP-UP TRIGGER FOR STAGE EXAM VOICE VALIDATION */}
                <div className="rounded-2xl sm:rounded-3xl border-2 border-ember/50 bg-gradient-to-b from-surface-raised via-surface to-ember/10 p-4 sm:p-5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="size-3 rounded-full bg-rose-500 animate-pulse shrink-0" />
                      <h4 className="font-display text-xs sm:text-sm font-bold text-ink uppercase tracking-wider truncate">
                        Bagian 2: Tantangan Rekam Suara Akhir Tahap
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-ember bg-ember/20 px-2 py-0.5 rounded-full border border-ember/30 shrink-0">
                      AI Gate
                    </span>
                  </div>

                  <p className="text-[11px] sm:text-xs text-muted leading-relaxed">
                    Buka jendela pop-up untuk melafalkan kalimat target dan memvalidasi getaran fonetik lo ke AI Malesan.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    {voiceExamResult?.isPassed ? (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        ✓ Ujian Suara Tahap {activeStage.id} LULUS (Skor: {voiceExamResult.score}/100)
                      </span>
                    ) : (
                      <span className="text-xs text-muted">
                        Status: Belum lolos ujian suara tahap ini.
                      </span>
                    )}

                    <button
                      onClick={() => {
                        setModalType("exam");
                        setIsVoiceModalOpen(true);
                      }}
                      className="btn-ember h-10 sm:h-11 px-6 rounded-xl font-display text-xs font-bold text-obsidian shadow-md animate-pulse cursor-pointer w-full sm:w-auto flex items-center justify-center gap-2"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                      </svg>
                      <span>{voiceExamResult?.isPassed ? "🎙️ Buka Pop-up Uji Suara (Lulus)" : "🎙️ Buka Pop-up Uji Suara"}</span>
                    </button>
                  </div>
                </div>

                {/* Final Exam Completion Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-hairline/60">
                  <div className="text-xs text-muted">
                    {completedStages.includes(activeStage.id) ? (
                      <span className="text-emerald-400 font-bold">✓ Tahap {activeStage.id} telah lulus &amp; tersimpan di Rapor.</span>
                    ) : (
                      <span>Selesaikan kuis &amp; loloskan rekaman suara di pop-up untuk membuka tahap berikutnya.</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {completedStages.includes(activeStage.id) && activeStage.id < 6 ? (
                      <button
                        onClick={() => {
                          setActiveStageId(activeStage.id + 1);
                          setActiveStepIndex(0);
                          setIsExamMode(false);
                          setExamAnswers({});
                          setDrillAnswer(null);
                          setVoiceExamResult(null);
                          scrollToDrillTop();
                        }}
                        className="btn-ember h-10 sm:h-11 px-6 rounded-xl font-display text-xs font-bold text-obsidian shadow-md cursor-pointer w-full sm:w-auto"
                      >
                        Lanjut ke Tahap {activeStage.id + 1} →
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* ========================================================================= */}
      {/* HIGH-END ISOLATED VOICE VALIDATION POP-UP WINDOW (DIALOG PORTAL) */}
      {/* ========================================================================= */}
      {isMounted && isVoiceModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-obsidian/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface-raised/95 border border-hairline/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto custom-scrollbar relative ring-1 ring-ember/25 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-2 border-b border-hairline/60 pb-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-ember/35 bg-ember/15 px-2 py-0.5 text-[10px] font-mono font-bold text-ember uppercase">
                    <span className="size-1.5 rounded-full bg-ember" />
                    {modalType === "step" ? `Langkah ${activeStepIndex + 1}/${activeStage.steps.length}` : `Ujian ${activeStage.badge}`}
                  </span>
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Validasi Suara AI</span>
                </div>
                <h3 className="font-display text-xs sm:text-sm font-bold text-ink truncate mt-1">
                  {modalType === "step" ? activeStep.title : activeStage.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsVoiceModalOpen(false)}
                className="size-7 rounded-full bg-surface border border-hairline/80 flex items-center justify-center hover:bg-surface-raised hover:border-ember text-muted hover:text-ink transition-colors cursor-pointer shrink-0 mt-0.5"
                title="Tutup jendela"
              >
                ✕
              </button>
            </div>

            {/* Target Sentence Box */}
            {(() => {
              const currentChallenge = modalType === "step" ? activeStep.stepVoiceChallenge : activeStage.voiceChallenge;
              const currentResult = modalType === "step" ? currentStepVoiceResult : voiceExamResult;
              const isRec = modalType === "step" ? isRecordingStepVoice : isRecordingVoiceExam;
              const isTranscribing = modalType === "step" ? stepVoiceTranscribing : voiceExamTranscribing;
              const recText = modalType === "step" ? stepVoiceRecordedText : voiceExamRecordedText;

              return (
                <div className="space-y-3">
                  {/* Hero Sentence Target Card */}
                  <div className="rounded-2xl border border-ember/30 bg-gradient-to-b from-ember/10 via-surface to-surface p-3.5 sm:p-4 space-y-2.5 text-center shadow-xs">
                    <span className="text-[10px] font-bold text-ember uppercase tracking-widest block">
                      Ucapkan Kalimat Target:
                    </span>
                    <h4 className="font-display text-sm sm:text-base font-bold text-ink leading-snug">
                      &ldquo;{currentChallenge.targetSentence}&rdquo;
                    </h4>

                    <div className="w-full">
                      <p className="text-[10px] sm:text-[11px] font-mono font-medium text-muted bg-surface-raised/90 px-3 py-1.5 rounded-xl border border-hairline/80 whitespace-normal break-words leading-relaxed text-center">
                        🗣️ {currentChallenge.easyPronunciation}
                      </p>
                    </div>

                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => playSpeechAudio(currentChallenge.sampleAudio)}
                        className="btn-ember h-8 px-3.5 rounded-xl text-obsidian text-[11px] font-bold transition-all inline-flex items-center gap-1.5 mx-auto shadow-sm hover:brightness-105 cursor-pointer"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                        <span>{currentlyPlayingAudioText === currentChallenge.sampleAudio ? "Memutar..." : "Dengarkan Contoh Native"}</span>
                      </button>
                    </div>

                    <p className="text-[10px] sm:text-[11px] text-muted border-t border-hairline/50 pt-2 text-center leading-tight">
                      💡 <b>Kunci:</b> {currentChallenge.focusTips}
                    </p>
                  </div>

                  {/* Waveform Visualizer */}
                  <div className="rounded-xl border border-hairline bg-surface p-2 flex flex-col items-center justify-center space-y-1">
                    <canvas ref={modalCanvasRef} width={380} height={32} className="w-full h-6" />
                    <div className="text-[10px] font-mono text-center">
                      {isRec ? (
                        <span className="text-rose-400 font-bold flex items-center justify-center gap-1">
                          <span className="size-1.5 rounded-full bg-rose-500 animate-ping" />
                          Mendengarkan... Tekan tombol merah untuk selesai &amp; kirim
                        </span>
                      ) : isTranscribing ? (
                        <span className="text-amber-400 font-bold flex items-center justify-center gap-1">
                          <span className="size-1.5 rounded-full bg-amber-400 animate-spin" />
                          AI sedang membedah fonetik suara lo...
                        </span>
                      ) : (
                        <span className="text-muted">Tekan tombol di bawah lalu ucapkan kalimat di atas</span>
                      )}
                    </div>
                  </div>

                  {/* Big Glowing Mic Recorder Button */}
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      disabled={isTranscribing}
                      onClick={() => {
                        if (modalType === "step") {
                          toggleStepVoiceRecording(activeStage, activeStep, currentStepKey);
                        } else {
                          toggleVoiceExamRecording(activeStage);
                        }
                      }}
                      className={`h-11 sm:h-12 px-6 rounded-xl font-display text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg w-full cursor-pointer ${
                        isRec
                          ? "bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/40"
                          : isTranscribing
                          ? "bg-surface text-muted border border-hairline cursor-not-allowed opacity-60"
                          : "btn-ember text-obsidian hover:brightness-105 active:scale-95"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                      </svg>
                      <span>
                        {isRec
                          ? "Selesai Rekam (Kirim ke AI) ⏹"
                          : isTranscribing
                          ? "AI Sedang Menganalisis Suara..."
                          : "Tekan & Rekam Pelafalan Suara Lo"}
                      </span>
                    </button>

                    {recText && (
                      <p className="text-[10px] font-mono text-muted text-center truncate animate-in fade-in px-1">
                        Terdengar: &ldquo;{recText}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Validation Result Box */}
                  {currentResult && (
                    <div className={`rounded-xl sm:rounded-2xl border p-3 sm:p-3.5 space-y-2 animate-in fade-in duration-200 ${
                      currentResult.isPassed
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-rose-500/40 bg-rose-500/10"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            currentResult.isPassed ? "bg-emerald-400 text-obsidian" : "bg-rose-500 text-white"
                          }`}>
                            {currentResult.isPassed ? "✓" : "✕"}
                          </span>
                          <span className={`font-display text-xs font-bold ${
                            currentResult.isPassed ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {currentResult.isPassed ? "LULUS UJI SUARA!" : "BELUM LULUS — REKAM ULANG"}
                          </span>
                        </div>
                        <span className="font-display text-xs sm:text-sm font-bold text-ink font-mono">
                          Skor: {currentResult.score}/100
                        </span>
                      </div>

                      <div className="rounded-lg bg-surface/90 p-2 text-[11px] space-y-0.5 border border-hairline/60">
                        <p className="text-muted">
                          <b>Terdengar:</b> &ldquo;{currentResult.transcribedText}&rdquo;
                        </p>
                      </div>

                      <div className="rounded-lg bg-surface p-2 text-[11px] border border-hairline">
                        <p className="font-bold text-ember uppercase text-[9px] tracking-wider mb-0.5">
                          Catatan Humor Malesan AI:
                        </p>
                        <p className="text-ink font-medium leading-relaxed italic">
                          &ldquo;{currentResult.humorRoast}&rdquo;
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Symmetrical Modal Action Controls */}
                  <div className="pt-2 border-t border-hairline/60">
                    {currentResult?.isPassed ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsVoiceModalOpen(false);
                          if (modalType === "step") {
                            if (activeStepIndex < activeStage.steps.length - 1) {
                              setActiveStepIndex((prev) => prev + 1);
                              setDrillAnswer(null);
                              setStepVoiceRecordedText("");
                              scrollToDrillTop();
                            } else {
                              setIsExamMode(true);
                              setExamAnswers({});
                              setVoiceExamResult(null);
                              setVoiceExamRecordedText("");
                              scrollToDrillTop();
                            }
                          }
                        }}
                        className="btn-ember h-11 w-full rounded-xl font-display text-xs sm:text-sm font-bold text-obsidian shadow-md cursor-pointer flex items-center justify-center gap-1.5 hover:brightness-105"
                      >
                        <span>
                          {modalType === "step" && activeStepIndex === activeStage.steps.length - 1
                            ? "Selesai & Buka Ujian Tahap →"
                            : "Selesai & Lanjut Langkah Berikutnya →"}
                        </span>
                      </button>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setIsVoiceModalOpen(false)}
                          className="h-10 rounded-xl border border-hairline bg-surface text-xs font-bold text-muted hover:text-ink hover:bg-surface-raised cursor-pointer transition-colors"
                        >
                          Tutup
                        </button>

                        {currentResult && !currentResult.isPassed ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (modalType === "step") {
                                setStepVoiceRecordedText("");
                                toggleStepVoiceRecording(activeStage, activeStep, currentStepKey);
                              } else {
                                setVoiceExamRecordedText("");
                                toggleVoiceExamRecording(activeStage);
                              }
                            }}
                            className="h-10 rounded-xl border border-rose-500/40 bg-rose-500/20 text-rose-300 text-xs font-bold hover:bg-rose-500/30 cursor-pointer transition-colors"
                          >
                            🔄 Rekam Ulang
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="h-10 rounded-xl border border-hairline bg-surface-raised text-xs font-bold text-muted/40 cursor-not-allowed opacity-50"
                          >
                            Rekam Suara Dulu
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: BICARA AI (LIVE SPEAKING CALL) */}
      {/* ========================================================================= */}
      <div className={mode === "voice" ? "w-full min-w-0" : "hidden"}>
        <div className="surface-card rounded-2xl sm:rounded-3xl border border-hairline/80 bg-surface/90 p-3.5 sm:p-6 backdrop-blur-xl shadow-xl space-y-4 sm:space-y-5 w-full min-w-0">
          {!isCalling && !showCallSummary ? (
            <div className="space-y-4 sm:space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
                <div className="min-w-0">
                  <h3 className="font-display text-sm sm:text-base font-bold text-ink truncate">
                    Pilih Partner Bicara AI
                  </h3>
                  <p className="text-[11px] sm:text-xs text-muted mt-0.5">
                    Setiap partner memiliki dialek native dan tempo bicara yang unik.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-hairline bg-surface-raised px-2.5 py-1 self-start sm:self-auto shrink-0">
                  <span className="text-[10px] font-bold text-muted whitespace-nowrap">Tempo:</span>
                  {[
                    { val: 0.75, label: "0.75x" },
                    { val: 1.0, label: "1.0x" },
                  ].map((s) => (
                    <button
                      key={s.val}
                      onClick={() => setPlaybackSpeed(s.val)}
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all whitespace-nowrap ${
                        playbackSpeed === s.val ? "bg-ember text-obsidian" : "text-muted hover:text-ink"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Persona Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
                {PERSONAS.map((p) => {
                  const isSelected = persona === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPersona(p.id)}
                      className={`rounded-xl sm:rounded-2xl border p-3 sm:p-4 text-left transition-all relative overflow-hidden flex flex-col justify-between h-28 sm:h-36 cursor-pointer min-w-0 ${
                        isSelected
                          ? "border-ember bg-ember/10 shadow-md ring-1 ring-ember/30"
                          : "border-hairline bg-surface-raised/60 hover:border-hairline/90"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-display text-xs sm:text-sm font-bold text-ink truncate">{p.name}</span>
                          <span className="text-[9px] sm:text-[10px] font-mono font-bold text-ember bg-ember/15 px-1.5 py-0.5 rounded shrink-0">
                            {p.accent}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted mt-1 leading-tight line-clamp-2">{p.desc}</p>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-hairline/40">
                        <span className="text-[9px] sm:text-[10px] font-medium text-muted truncate">{p.tag}</span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-ember shrink-0">
                            <span className="size-1 rounded-full bg-ember" /> OK
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Action Banner */}
              <div className="rounded-xl sm:rounded-2xl border border-hairline/60 bg-surface-raised/40 p-3.5 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                <div className="space-y-0.5 text-center sm:text-left min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-ink truncate">Bebas Bicara Tanpa Takut Salah</h4>
                  <p className="text-[10px] sm:text-xs text-muted">
                    Tersedia tombol terjemahan &amp; contekan kalimat pintar jika lo bingung mau merespons apa.
                  </p>
                </div>
                <button
                  onClick={() => startCall()}
                  className="btn-ember shrink-0 h-10 sm:h-11 px-6 rounded-xl font-display text-xs font-bold text-obsidian shadow-md hover:brightness-105 w-full sm:w-auto"
                >
                  Mulai Bicara →
                </button>
              </div>
            </div>
          ) : isCalling ? (
            /* ACTIVE PHONE CALL SCREEN */
            <div className="space-y-4 sm:space-y-5">
              <div className="flex items-center justify-between border-b border-hairline/60 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-9 rounded-full border border-ember/40 bg-ember/20 flex items-center justify-center text-ember font-display font-bold text-xs shrink-0">
                    {persona.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-xs sm:text-sm font-bold text-ink truncate">
                      {persona} ({PERSONAS.find((p) => p.id === persona)?.tag})
                    </h3>
                    <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                      {formatSeconds(callDuration)}
                      {isPlayingAudio && <span className="text-ember font-bold ml-1">• Bersuara</span>}
                    </p>
                  </div>
                </div>

                <button
                  onClick={endCall}
                  className="h-8 px-3 rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-400 text-[11px] font-bold hover:bg-rose-500/25 transition-all shrink-0"
                >
                  Akhiri
                </button>
              </div>

              {(activeTip || activeRoast) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in duration-200">
                  {activeTip && (
                    <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5 text-xs">
                      <p className="font-bold text-sky-400 text-[10px] uppercase tracking-wider">Koreksi Grammar:</p>
                      <p className="text-ink mt-0.5 font-medium">{activeTip}</p>
                    </div>
                  )}
                  {activeRoast && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
                      <p className="font-bold text-amber-400 text-[10px] uppercase tracking-wider">Catatan Malesan:</p>
                      <p className="text-ink mt-0.5 font-medium italic">&ldquo;{activeRoast}&rdquo;</p>
                    </div>
                  )}
                </div>
              )}

              {/* Chat / Transcript Stream */}
              <div className="h-56 sm:h-72 overflow-y-auto rounded-2xl border border-hairline/60 bg-surface-raised/40 p-3 sm:p-4 space-y-2.5 custom-scrollbar">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed space-y-1.5 ${
                        m.role === "user"
                          ? "bg-ember text-obsidian font-medium rounded-tr-xs"
                          : "border border-hairline/80 bg-surface text-ink rounded-tl-xs shadow-xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <span>{m.text}</span>
                        {m.role === "assistant" && (
                          <button
                            type="button"
                            onClick={() => playSpeechAudio(m.text, activeScenario?.partner || persona)}
                            title="Putar suara"
                            className="shrink-0 text-muted hover:text-ember transition-colors p-0.5 cursor-pointer"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {m.role === "assistant" && m.translateId && (
                        <div className="border-t border-hairline/50 pt-1">
                          {showTranslations[m.id] ? (
                            <p className="text-[10px] sm:text-[11px] text-muted font-normal italic">
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

                      {/* ⚡ SLANGIFY DRAWER */}
                      <div className="mt-2 pt-1.5 border-t border-hairline/40 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => triggerSlangify(m.id, m.text)}
                          disabled={slangifyLoading[m.id]}
                          className="h-6 px-2.5 rounded-lg border border-ember/30 bg-ember/10 hover:bg-ember/20 text-ember text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                          </svg>
                          {slangifyLoading[m.id] ? "Menganalisis Gaya..." : openSlangify[m.id] ? "Tutup Versi Native" : "⚡ Versi Native (Casual & Executive)"}
                        </button>
                      </div>

                      {openSlangify[m.id] && slangifyData[m.id] && (
                        <div className="mt-2.5 rounded-2xl border border-ember/40 bg-surface-raised/95 p-3 sm:p-4 space-y-2.5 text-xs text-left animate-in fade-in duration-200 shadow-md">
                          <div className="flex items-center justify-between border-b border-hairline/50 pb-2">
                            <span className="text-[10px] font-bold text-ember uppercase tracking-wider flex items-center gap-1">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                                <circle cx="12" cy="12" r="10" />
                                <path d="m4.93 4.93 4.24 4.24" />
                                <path d="m14.83 9.17 4.24-4.24" />
                                <path d="m14.83 14.83 4.24 4.24" />
                                <path d="m9.17 14.83-4.24 4.24" />
                              </svg>
                              3 Variasi Penutur Asli (Native Speaker):
                            </span>
                            <button
                              type="button"
                              onClick={() => setOpenSlangify((prev) => ({ ...prev, [m.id]: false }))}
                              className="text-[10px] text-muted hover:text-ink font-bold cursor-pointer"
                            >
                              Tutup
                            </button>
                          </div>

                          <div className="space-y-2">
                            {/* Casual */}
                            <div className="rounded-xl border border-hairline bg-surface p-2.5 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-ink uppercase tracking-wider text-muted">
                                  Casual &amp; Natural (Sehari-hari):
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => playSpeechAudio(slangifyData[m.id].casual)}
                                    className="text-[10px] font-bold text-ember hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    </svg>
                                    Dengar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(slangifyData[m.id].casual);
                                      setFeedbackNotice("Teks Casual berhasil disalin.");
                                    }}
                                    className="text-[10px] font-bold text-muted hover:text-ink cursor-pointer"
                                  >
                                    Salin
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-ink font-medium leading-relaxed">
                                &ldquo;{slangifyData[m.id].casual}&rdquo;
                              </p>
                            </div>

                            {/* Executive */}
                            <div className="rounded-xl border border-hairline bg-surface p-2.5 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-ink uppercase tracking-wider text-muted">
                                  Global Executive (Karier &amp; Klien USD):
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => playSpeechAudio(slangifyData[m.id].executive, "david")}
                                    className="text-[10px] font-bold text-ember hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    </svg>
                                    Dengar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(slangifyData[m.id].executive);
                                      setFeedbackNotice("Teks Executive berhasil disalin.");
                                    }}
                                    className="text-[10px] font-bold text-muted hover:text-ink cursor-pointer"
                                  >
                                    Salin
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-ink font-medium leading-relaxed">
                                &ldquo;{slangifyData[m.id].executive}&rdquo;
                              </p>
                            </div>

                            {/* Creator */}
                            <div className="rounded-xl border border-hairline bg-surface p-2.5 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-ink uppercase tracking-wider text-muted">
                                  Creator Hook (Punchy &amp; Tajam):
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => playSpeechAudio(slangifyData[m.id].creator, "alex")}
                                    className="text-[10px] font-bold text-ember hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    </svg>
                                    Dengar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(slangifyData[m.id].creator);
                                      setFeedbackNotice("Teks Creator berhasil disalin.");
                                    }}
                                    className="text-[10px] font-bold text-muted hover:text-ink cursor-pointer"
                                  >
                                    Salin
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-ink font-medium leading-relaxed">
                                &ldquo;{slangifyData[m.id].creator}&rdquo;
                              </p>
                            </div>

                            {/* Explanation */}
                            <div className="p-2.5 rounded-xl bg-ember/10 border border-ember/20 text-[11px] text-muted leading-relaxed">
                              <strong className="text-ember font-bold">Kenapa Versi Ini Lebih Baik: </strong>
                              {slangifyData[m.id].explanation}
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                ))}

                {/* Animated Typing Indicator */}
                {isProcessing && (
                  <div className="flex flex-col items-start animate-in fade-in duration-200">
                    <div className="rounded-2xl border border-hairline/80 bg-surface px-3.5 py-2 text-xs text-muted flex items-center gap-2 shadow-xs">
                      <span className="flex gap-1 items-center">
                        <span className="size-1.5 rounded-full bg-ember animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="size-1.5 rounded-full bg-ember animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="size-1.5 rounded-full bg-ember animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                      <span className="text-[11px] font-mono text-muted/90 font-medium">
                        {PERSONAS.find((p) => p.id === (activeScenario?.partner || persona))?.name || "Partner"} is thinking...
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Smart Hint Suggestion Pills */}
              {messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].suggestedReplies && (
                <div className="space-y-1 animate-in fade-in duration-200">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                    Contekan Cepat (Klik untuk kirim):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {messages[messages.length - 1].suggestedReplies?.map((hint, idx) => (
                      <button
                        key={idx}
                        onClick={() => submitTextMessage(hint.en)}
                        disabled={isProcessing}
                        className="rounded-xl border border-hairline bg-surface p-2 text-left hover:border-ember/60 hover:bg-surface-raised transition-all group min-w-0"
                      >
                        <span className="font-bold text-xs text-ink group-hover:text-ember block truncate">{hint.en}</span>
                        <span className="text-[10px] text-muted block truncate">{hint.id}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Kinetic Waveform Canvas */}
              <div className="rounded-xl sm:rounded-2xl border border-hairline/60 bg-surface-raised p-2.5 flex flex-col items-center justify-center">
                <canvas ref={canvasRef} width={400} height={38} className="w-full h-8" />
                <p className="text-[10px] font-mono text-muted mt-0.5 text-center">
                  {isRecording
                    ? "Mendengarkan... Klik tombol merah untuk kirim"
                    : isPlayingAudio
                    ? "Partner AI sedang berbicara..."
                    : isProcessing
                    ? "Memproses suara..."
                    : "Tekan tombol bicara atau ketik pesan"}
                </p>
              </div>

              {/* Controls Bar */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={isProcessing}
                    className={`h-11 sm:h-13 px-6 sm:px-8 rounded-2xl font-display text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-lg w-full sm:w-auto justify-center cursor-pointer ${
                      isRecording
                        ? "bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/30"
                        : isProcessing
                        ? "bg-surface-raised text-muted cursor-not-allowed border border-hairline"
                        : "bg-ember text-obsidian hover:brightness-105 active:scale-95"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                    {isRecording
                      ? "Selesai Bicara (Kirim)"
                      : isProcessing
                      ? "Memproses..."
                      : "Tekan untuk Bicara"}
                  </button>
                </div>

                {/* Instant Text Input Alternative */}
                <div className="flex items-center gap-1.5 rounded-xl sm:rounded-2xl border border-hairline bg-surface-raised p-1 focus-within:border-ember/60 transition-all">
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
                    placeholder="Atau ketik bahasa Inggris di sini..."
                    disabled={isProcessing}
                    className="flex-1 bg-transparent px-2.5 text-xs sm:text-sm text-ink placeholder:text-muted/60 focus:outline-none min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => submitTextMessage()}
                    disabled={!textInput.trim() || isProcessing}
                    className="btn-ember h-8 sm:h-9 px-3.5 rounded-lg sm:rounded-xl font-display text-xs font-bold text-obsidian disabled:opacity-50 shrink-0"
                  >
                    Kirim
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* POST-CALL SCORECARD */
            <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
              <div className="border-b border-hairline/60 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-ink">
                    Rapor Selesai Percakapan
                  </h3>
                  <p className="text-xs text-muted">Durasi: {formatSeconds(callDuration)}</p>
                </div>
                <button
                  onClick={() => setShowCallSummary(false)}
                  className="btn-ember h-8 sm:h-9 px-3.5 rounded-xl text-xs font-bold text-obsidian"
                >
                  Panggilan Baru
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                <div className="rounded-xl border border-hairline bg-surface-raised p-3 text-center">
                  <p className="text-[10px] font-bold text-muted uppercase">Kalimat</p>
                  <p className="font-display text-lg sm:text-2xl font-bold text-ink mt-0.5">
                    {messages.filter((m) => m.role === "user").length}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase">Skor</p>
                  <p className="font-display text-lg sm:text-2xl font-bold text-emerald-400 mt-0.5">
                    {messages.filter((m) => m.score).length
                      ? Math.round(
                          messages.filter((m) => m.score).reduce((a, b) => a + (b.score || 0), 0) /
                            messages.filter((m) => m.score).length,
                        )
                      : 80}
                  </p>
                </div>
                <div className="rounded-xl border border-ember/30 bg-ember/10 p-3 text-center">
                  <p className="text-[10px] font-bold text-ember uppercase">Koreksi</p>
                  <p className="font-display text-lg sm:text-2xl font-bold text-ember mt-0.5">
                    {messages.filter((m) => m.tip).length}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 2: SIMULASI SKENARIO (ROLEPLAY CHAMBER) */}
      {/* ========================================================================= */}
      <div className={mode === "scenario" ? "w-full min-w-0" : "hidden"}>
        <div className="surface-card rounded-2xl sm:rounded-3xl border border-hairline/80 bg-surface/90 p-3.5 sm:p-6 backdrop-blur-xl shadow-xl space-y-4 sm:space-y-5 w-full min-w-0">
          {!isCalling ? (
            <div className="space-y-4 sm:space-y-5">
              <div>
                <h3 className="font-display text-sm sm:text-base font-bold text-ink">
                  Simulasi Skenario Dunia Nyata
                </h3>
                <p className="text-[11px] sm:text-xs text-muted mt-0.5">
                  Latihan situasi spesifik dengan misi objektif dan partner AI realistis.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {SCENARIOS.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl sm:rounded-2xl border border-hairline bg-surface-raised p-3.5 sm:p-4 flex flex-col justify-between space-y-3 hover:border-ember/40 transition-all group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-display text-xs sm:text-sm font-bold text-ink group-hover:text-ember transition-colors">
                          {s.title}
                        </h4>
                        <span className="text-[9px] font-mono font-bold text-ember bg-ember/15 px-1.5 py-0.5 rounded shrink-0 capitalize">
                          {s.partner}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted leading-relaxed line-clamp-2">{s.context}</p>
                    </div>

                    <button
                      onClick={() => startCall(s)}
                      className="btn-ember w-full h-9 rounded-xl text-xs font-bold text-obsidian shadow-sm hover:brightness-105 cursor-pointer"
                    >
                      Mulai Simulasi →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-ember/30 bg-ember/10 p-3 flex items-center justify-between gap-2">
                <h3 className="font-display text-xs sm:text-sm font-bold text-ink truncate">
                  Skenario: {activeScenario?.title}
                </h3>
                <button
                  onClick={endCall}
                  className="h-7 px-2.5 rounded-lg border border-rose-500/40 bg-rose-500/15 text-rose-400 text-[10px] font-bold shrink-0"
                >
                  Selesai
                </button>
              </div>

              <div className="h-56 sm:h-72 overflow-y-auto rounded-2xl border border-hairline/60 bg-surface-raised/40 p-3 sm:p-4 space-y-2.5 custom-scrollbar">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed space-y-1.5 ${
                        m.role === "user"
                          ? "bg-ember text-obsidian font-medium rounded-tr-xs"
                          : "border border-hairline/80 bg-surface text-ink rounded-tl-xs shadow-xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <span>{m.text}</span>
                        {m.role === "assistant" && (
                          <button
                            type="button"
                            onClick={() => playSpeechAudio(m.text, activeScenario?.partner || persona)}
                            title="Putar suara"
                            className="shrink-0 text-muted hover:text-ember transition-colors p-0.5 cursor-pointer"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {m.role === "assistant" && m.translateId && (
                        <div className="border-t border-hairline/50 pt-1">
                          {showTranslations[m.id] ? (
                            <p className="text-[10px] sm:text-[11px] text-muted font-normal italic">
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

                      {/* ⚡ SLANGIFY DRAWER */}
                      <div className="mt-2 pt-1.5 border-t border-hairline/40 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => triggerSlangify(m.id, m.text)}
                          disabled={slangifyLoading[m.id]}
                          className="h-6 px-2.5 rounded-lg border border-ember/30 bg-ember/10 hover:bg-ember/20 text-ember text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                          </svg>
                          {slangifyLoading[m.id] ? "Menganalisis Gaya..." : openSlangify[m.id] ? "Tutup Versi Native" : "⚡ Versi Native (Casual & Executive)"}
                        </button>
                      </div>

                      {openSlangify[m.id] && slangifyData[m.id] && (
                        <div className="mt-2.5 rounded-2xl border border-ember/40 bg-surface-raised/95 p-3 sm:p-4 space-y-2.5 text-xs text-left animate-in fade-in duration-200 shadow-md">
                          <div className="flex items-center justify-between border-b border-hairline/50 pb-2">
                            <span className="text-[10px] font-bold text-ember uppercase tracking-wider flex items-center gap-1">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                                <circle cx="12" cy="12" r="10" />
                                <path d="m4.93 4.93 4.24 4.24" />
                                <path d="m14.83 9.17 4.24-4.24" />
                                <path d="m14.83 14.83 4.24 4.24" />
                                <path d="m9.17 14.83-4.24 4.24" />
                              </svg>
                              3 Variasi Penutur Asli (Native Speaker):
                            </span>
                            <button
                              type="button"
                              onClick={() => setOpenSlangify((prev) => ({ ...prev, [m.id]: false }))}
                              className="text-[10px] text-muted hover:text-ink font-bold cursor-pointer"
                            >
                              Tutup
                            </button>
                          </div>

                          <div className="space-y-2">
                            {/* Casual */}
                            <div className="rounded-xl border border-hairline bg-surface p-2.5 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-ink uppercase tracking-wider text-muted">
                                  Casual &amp; Natural (Sehari-hari):
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => playSpeechAudio(slangifyData[m.id].casual)}
                                    className="text-[10px] font-bold text-ember hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    </svg>
                                    Dengar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(slangifyData[m.id].casual);
                                      setFeedbackNotice("Teks Casual berhasil disalin.");
                                    }}
                                    className="text-[10px] font-bold text-muted hover:text-ink cursor-pointer"
                                  >
                                    Salin
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-ink font-medium leading-relaxed">
                                &ldquo;{slangifyData[m.id].casual}&rdquo;
                              </p>
                            </div>

                            {/* Executive */}
                            <div className="rounded-xl border border-hairline bg-surface p-2.5 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-ink uppercase tracking-wider text-muted">
                                  Global Executive (Karier &amp; Klien USD):
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => playSpeechAudio(slangifyData[m.id].executive, "david")}
                                    className="text-[10px] font-bold text-ember hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    </svg>
                                    Dengar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(slangifyData[m.id].executive);
                                      setFeedbackNotice("Teks Executive berhasil disalin.");
                                    }}
                                    className="text-[10px] font-bold text-muted hover:text-ink cursor-pointer"
                                  >
                                    Salin
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-ink font-medium leading-relaxed">
                                &ldquo;{slangifyData[m.id].executive}&rdquo;
                              </p>
                            </div>

                            {/* Creator */}
                            <div className="rounded-xl border border-hairline bg-surface p-2.5 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-ink uppercase tracking-wider text-muted">
                                  Creator Hook (Punchy &amp; Tajam):
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => playSpeechAudio(slangifyData[m.id].creator, "alex")}
                                    className="text-[10px] font-bold text-ember hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    </svg>
                                    Dengar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(slangifyData[m.id].creator);
                                      setFeedbackNotice("Teks Creator berhasil disalin.");
                                    }}
                                    className="text-[10px] font-bold text-muted hover:text-ink cursor-pointer"
                                  >
                                    Salin
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-ink font-medium leading-relaxed">
                                &ldquo;{slangifyData[m.id].creator}&rdquo;
                              </p>
                            </div>

                            {/* Explanation */}
                            <div className="p-2.5 rounded-xl bg-ember/10 border border-ember/20 text-[11px] text-muted leading-relaxed">
                              <strong className="text-ember font-bold">Kenapa Versi Ini Lebih Baik: </strong>
                              {slangifyData[m.id].explanation}
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                ))}

                {/* Animated Typing Indicator */}
                {isProcessing && (
                  <div className="flex flex-col items-start animate-in fade-in duration-200">
                    <div className="rounded-2xl border border-hairline/80 bg-surface px-3.5 py-2 text-xs text-muted flex items-center gap-2 shadow-xs">
                      <span className="flex gap-1 items-center">
                        <span className="size-1.5 rounded-full bg-ember animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="size-1.5 rounded-full bg-ember animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="size-1.5 rounded-full bg-ember animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                      <span className="text-[11px] font-mono text-muted/90 font-medium">
                        {PERSONAS.find((p) => p.id === (activeScenario?.partner || persona))?.name || "Partner"} is thinking...
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Smart Hint Suggestion Pills */}
              {messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].suggestedReplies && (
                <div className="space-y-1 animate-in fade-in duration-200">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                    Contekan Cepat (Klik untuk kirim):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {messages[messages.length - 1].suggestedReplies?.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => submitTextMessage(item.en)}
                        disabled={isProcessing}
                        className="text-left px-2.5 py-1 rounded-xl border border-ember/30 bg-ember/10 hover:bg-ember/20 text-ink text-[11px] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <span className="font-semibold text-ember">&ldquo;{item.en}&rdquo;</span>
                        <span className="text-muted text-[10px] block font-normal">{item.id}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5 rounded-xl border border-hairline bg-surface-raised p-1 focus-within:border-ember/60 transition-all">
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
                  placeholder="Ketik balasan untuk skenario ini..."
                  disabled={isProcessing}
                  className="flex-1 bg-transparent px-2.5 text-xs text-ink placeholder:text-muted/60 focus:outline-none min-w-0"
                />
                <button
                  type="button"
                  onClick={() => submitTextMessage()}
                  disabled={!textInput.trim() || isProcessing}
                  className="btn-ember h-8 px-3 rounded-lg font-display text-xs font-bold text-obsidian disabled:opacity-50 shrink-0"
                >
                  Kirim
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 3: KUIS KILAT PRO */}
      {/* ========================================================================= */}
      <div className={mode === "quiz" ? "w-full min-w-0" : "hidden"}>
        <div className="surface-card rounded-2xl sm:rounded-3xl border border-hairline/80 bg-surface/90 p-3.5 sm:p-6 backdrop-blur-xl shadow-xl space-y-4 sm:space-y-5 w-full min-w-0">
          {quizQuestions.length === 0 ? (
            <div className="space-y-4 sm:space-y-5">
              <div>
                <h3 className="font-display text-sm sm:text-base font-bold text-ink">
                  Kuis Kilat Bahasa Inggris Pro
                </h3>
                <p className="text-[11px] sm:text-xs text-muted mt-0.5">
                  Uji pemahaman tenses, idiom, dan perbaikan kalimat secara segar.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {[
                  { id: "grammar_tenses", title: "Grammar & Tenses", desc: "Past, Present, Perfect" },
                  { id: "idioms_phrases", title: "Idioms & Phrases", desc: "Ungkapan native" },
                  { id: "error_spotting", title: "Error Spotting", desc: "Cari letak kesalahan" },
                  { id: "business_pro", title: "Business English", desc: "Email & meeting" },
                  { id: "slang_pop", title: "Slang Pop", desc: "Bahasa gaul internet" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setQuizTopic(t.id)}
                    className={`rounded-xl border p-2.5 sm:p-3 text-left transition-all h-18 sm:h-22 flex flex-col justify-between cursor-pointer min-w-0 ${
                      quizTopic === t.id
                        ? "border-ember bg-ember/10 shadow-sm ring-1 ring-ember/30"
                        : "border-hairline bg-surface-raised/60 hover:border-hairline/90"
                    }`}
                  >
                    <p className="font-display text-xs sm:text-sm font-bold text-ink truncate">{t.title}</p>
                    <p className="text-[10px] text-muted truncate">{t.desc}</p>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-hairline/60 pt-3">
                <div className="flex items-center gap-1.5">
                  {[5, 10].map((cnt) => (
                    <button
                      key={cnt}
                      onClick={() => setQuizCount(cnt)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                        quizCount === cnt ? "bg-ember text-obsidian" : "text-muted bg-surface border border-hairline"
                      }`}
                    >
                      {cnt} Soal
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleGenerateQuiz}
                  disabled={quizLoading}
                  className="btn-ember h-9 sm:h-10 px-5 rounded-xl font-display text-xs font-bold text-obsidian shadow-md hover:brightness-105"
                >
                  {quizLoading ? "Menyiapkan..." : "Mulai Kuis →"}
                </button>
              </div>
            </div>
          ) : !quizFinished ? (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-hairline/60 pb-2.5">
                <span className="text-[11px] font-bold text-ember uppercase">
                  Soal {currentQuestionIdx + 1}/{quizQuestions.length}
                </span>
                <span className="text-[10px] text-muted font-mono">{level.toUpperCase()}</span>
              </div>

              {quizQuestions[currentQuestionIdx] && (
                <div className="space-y-3">
                  <h4 className="font-display text-xs sm:text-base font-bold text-ink leading-snug">
                    {quizQuestions[currentQuestionIdx].question}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                          className={`rounded-xl border p-2.5 sm:p-3 text-left text-xs transition-all cursor-pointer ${btnStyle}`}
                        >
                          <span className="font-mono font-bold mr-1.5 text-muted">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    {currentQuestionIdx < quizQuestions.length - 1 ? (
                      <button
                        disabled={selectedAnswers[currentQuestionIdx] === undefined}
                        onClick={() => setCurrentQuestionIdx((prev) => prev + 1)}
                        className="btn-ember h-9 px-4 rounded-xl text-xs font-bold text-obsidian disabled:opacity-50"
                      >
                        Berikutnya →
                      </button>
                    ) : (
                      <button
                        disabled={selectedAnswers[currentQuestionIdx] === undefined}
                        onClick={finishQuiz}
                        className="btn-ember h-9 px-4 rounded-xl text-xs font-bold text-obsidian disabled:opacity-50"
                      >
                        Selesai Kuis →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 text-center py-4">
              <h3 className="font-display text-lg font-bold text-ink">Hasil Kuis Lo</h3>
              <button
                onClick={handleGenerateQuiz}
                className="btn-ember h-9 px-4 rounded-xl text-xs font-bold text-obsidian"
              >
                Mulai Kuis Baru
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 4: UJIAN ESAI */}
      {/* ========================================================================= */}
      <div className={mode === "essay" ? "w-full min-w-0" : "hidden"}>
        <div className="surface-card rounded-2xl sm:rounded-3xl border border-hairline/80 bg-surface/90 p-3.5 sm:p-6 backdrop-blur-xl shadow-xl space-y-4 w-full min-w-0">
          <div>
            <h3 className="font-display text-sm sm:text-base font-bold text-ink">
              Ujian Esai &amp; Evaluasi IELTS
            </h3>
            <p className="text-[11px] sm:text-xs text-muted mt-0.5">
              Tulis paragraf bahasa Inggris lo, AI akan membedah grammar dan memberikan skor setara IELTS.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {ESSAY_TOPICS.map((t, idx) => (
              <button
                key={idx}
                onClick={() => setEssayTopic(t)}
                className={`rounded-lg px-2.5 py-1 text-[11px] transition-all text-left ${
                  essayTopic === t
                    ? "bg-ember text-obsidian font-bold"
                    : "bg-surface-raised border border-hairline text-muted hover:text-ink"
                }`}
              >
                {t.slice(0, 30)}...
              </button>
            ))}
          </div>

          <textarea
            rows={4}
            value={essayText}
            onChange={(e) => setEssayText(e.target.value)}
            placeholder="Write your English essay here (minimum 20 characters)..."
            className="w-full rounded-xl border border-hairline bg-surface-raised p-3 text-xs sm:text-sm text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none transition-all leading-relaxed"
          />

          <button
            onClick={handleEvaluateEssay}
            disabled={essayLoading}
            className="btn-ember h-10 px-5 rounded-xl font-display text-xs font-bold text-obsidian shadow-md hover:brightness-105 disabled:opacity-50 w-full sm:w-auto"
          >
            {essayLoading ? "Menganalisis..." : "Evaluasi Esai →"}
          </button>

          {essayResult && (
            <div className="rounded-xl border border-hairline bg-surface-raised p-3.5 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ember uppercase">Estimasi IELTS: Band {essayResult.overallBandScore}</span>
                <span className="font-mono font-bold text-emerald-400 text-xs">{essayResult.overallScore100}/100</span>
              </div>
              <p className="text-xs text-ink leading-relaxed font-medium">{essayResult.roastReview}</p>
              {essayResult.perfectedDraft && (
                <div className="p-3 rounded-lg bg-surface border border-hairline text-xs text-ink leading-relaxed">
                  <p className="font-bold text-ember mb-1">Versi Sempurna:</p>
                  <p className="italic">{essayResult.perfectedDraft}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 5: RAPOR & RIWAYAT BELAJAR */}
      {/* ========================================================================= */}
      <div className={mode === "progress" ? "w-full min-w-0" : "hidden"}>
        <div className="surface-card rounded-2xl sm:rounded-3xl border border-hairline/80 bg-surface/90 p-3.5 sm:p-6 backdrop-blur-xl shadow-xl space-y-4 w-full min-w-0">
          <div>
            <h3 className="font-display text-sm sm:text-base font-bold text-ink">
              Rapor Belajar Lo
            </h3>
            <p className="text-[11px] sm:text-xs text-muted mt-0.5">
              Pantau progres 0-100%, total durasi latihan bicara, dan riwayat aktivitas.
            </p>
          </div>

          <div className="rounded-2xl border border-ember/40 bg-gradient-to-r from-surface-raised via-surface to-ember/15 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-xs sm:text-sm font-bold text-ink">
                Penguasaan: {masteryPercentage}% (100% Master)
              </h4>
              <button
                onClick={() => setMode("academy")}
                className="btn-ember h-7 px-2.5 rounded-lg text-[10px] font-bold text-obsidian"
              >
                Belajar →
              </button>
            </div>
            <div className="h-2.5 w-full rounded-full bg-surface-raised border border-hairline overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-ember transition-all duration-500 shadow-sm"
                style={{ width: `${Math.max(4, masteryPercentage)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl border border-hairline bg-surface-raised p-3 text-center">
              <p className="text-[10px] font-bold text-muted uppercase">Menit Bicara</p>
              <p className="font-display text-lg font-bold text-ink mt-0.5">{totalMinutesSpoken} Menit</p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
              <p className="text-[10px] font-bold text-emerald-400 uppercase">Rata-rata Skor</p>
              <p className="font-display text-lg font-bold text-emerald-400 mt-0.5">{avgOverallScore}/100</p>
            </div>
            <div className="rounded-xl border border-ember/30 bg-ember/10 p-3 text-center col-span-2 sm:col-span-1">
              <p className="text-[10px] font-bold text-ember uppercase">Total Sesi</p>
              <p className="font-display text-lg font-bold text-ember mt-0.5">{records.length} Sesi</p>
            </div>
          </div>

          {/* 🔄 RESET PROGRESS CONTROL */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-hairline/60 pt-3">
            <div>
              <h5 className="font-display text-xs font-bold text-ink">Mulai Ulang / Reset Progres</h5>
              <p className="text-[10px] sm:text-[11px] text-muted">Ingin mengulang materi dan latihan dari Tahap 1?</p>
            </div>
            <button
              type="button"
              onClick={resetAllProgress}
              className="h-8 px-3 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span>Reset ke Tahap 1</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
