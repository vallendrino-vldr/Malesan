/**
 * VIBE CODING KIT
 *
 * Approved scope addition, 2026-07-29. Not in MALESAN_MASTER_PROMPT.md.
 *
 * Same thesis as the content modules — "males mikirnya, bukan bikinnya" — aimed
 * at a different blank page. A creator stares at an empty editor; someone about
 * to vibe-code stares at an empty repo and an AI agent waiting for instructions
 * they have not thought through yet.
 *
 * The output is deliberately the document set this project itself runs on,
 * because that set is what stopped this build from dissolving when it changed
 * agents mid-way. That is the product insight: the documents are not paperwork,
 * they are the thing that makes an AI agent produce something coherent.
 */

export type VibeKitInput = {
  /** What they want to build, in their own words. Can be one messy sentence. */
  idea: string;
  /** Optional. Free text — "Next.js + Supabase", "gatau, saranin aja". */
  stack?: string;
  /** Optional. Who it is for. */
  audience?: string;
};

/**
 * Six documents. Each is a complete file the user can save straight into a repo.
 *
 * They are generated in one call because they must agree with each other: a
 * roadmap that references tables the schema does not define is worse than no
 * roadmap. Separate calls would drift.
 */
/**
 * One document per call.
 *
 * The kit was generated as a single request for all six documents under one
 * strict schema. Six long Markdown files do not fit in one response: the model
 * ran out of output budget partway through, the JSON came back truncated, and
 * `parseJson` threw "incomplete kit" — the failure that showed as a progress
 * counter stalling around 2k characters and then dying with nothing to show.
 * Adding depth requirements to the prompt made it strictly worse.
 *
 * Six focused calls fit comfortably, give real per-document progress, and let
 * one document fail without losing the other five. They run concurrently, so
 * wall-clock is the slowest single document rather than the sum.
 */
export const VIBE_DOC_SPECS: {
  key: keyof VibeKitOutput["docs"];
  file: string;
  brief: string;
}[] = [
  {
    key: "prd",
    file: "PRD.md",
    brief: `Masalah yang dipecahin dan buat siapa. Positioning yang tajam.
Minimal 6 fitur fase 1, tiap fitur ada acceptance criteria yang bisa dicentang.
Sebutin juga apa yang SENGAJA gak dibikin dulu, dan kenapa.`,
  },
  {
    key: "design",
    file: "DESIGN.md",
    brief: `Sistem desain. Minimal 12 token warna lengkap hex dan kapan dipakai —
hitam/putihnya jangan netral, kasih arah suhu warna dan jelasin kenapa.
2 pasangan font dengan ukuran dan line-height. Skala spasi.
Minimal 6 contoh copy nyata: loading, empty state, error, sukses, konfirmasi, dan tombol utama.`,
  },
  {
    key: "roadmap",
    file: "ROADMAP.md",
    brief: `Urutan langkah dari nol sampai bisa dipakai orang.
Tiap step ada "definition of done" yang bisa diuji, bukan "selesai".
Tandain mana yang bikin produk hidup dan mana yang bisa ditunda.`,
  },
  {
    key: "agents",
    file: "AGENTS.md",
    brief: `Aturan keras buat AI coding agent. Minimal 10 aturan, tiap aturan ada
konsekuensi kalau dilanggar. Wajib termasuk: jangan ngarang fitur di luar roadmap,
commit tiap checkpoint, berhenti dan tanya kalau spek bentrok sama kenyataan,
dan jangan ngaku sesuatu berhasil tanpa dijalanin dulu.`,
  },
  {
    key: "schema",
    file: "SCHEMA.md",
    brief: `Skema database. SQL DDL beneran yang bisa langsung dijalanin —
CREATE TABLE lengkap dengan tipe, constraint, index, dan row-level security policy.
Bukan deskripsi tabel. Jelasin relasi antar tabel dan kenapa dibikin gitu.`,
  },
  {
    key: "master_prompt",
    file: "MASTER_PROMPT.md",
    brief: `Prompt pembuka yang tinggal di-paste ke AI agent di sesi pertama.
Harus siap tempel, gak ada placeholder yang mesti diisi manual.
Isinya: konteks project, urutan baca dokumen, aturan kerja, dan langkah pertama yang konkret.`,
  },
];

/** Schema for a single document call. */
export const VIBE_DOC_SCHEMA = {
  type: "OBJECT",
  properties: { content: { type: "STRING" } },
  required: ["content"],
} as const;

/** Schema for the short identity pass that names the project. */
export const VIBE_IDENTITY_SCHEMA = {
  type: "OBJECT",
  properties: {
    project_name: { type: "STRING" },
    one_liner: { type: "STRING" },
    stack_summary: { type: "STRING" },
  },
  required: ["project_name", "one_liner", "stack_summary"],
} as const;

export const VIBE_KIT_SCHEMA = {
  type: "OBJECT",
  properties: {
    project_name: { type: "STRING" },
    one_liner: { type: "STRING" },
    stack_summary: { type: "STRING" },
    docs: {
      type: "OBJECT",
      properties: {
        prd: { type: "STRING" },
        design: { type: "STRING" },
        roadmap: { type: "STRING" },
        agents: { type: "STRING" },
        schema: { type: "STRING" },
        master_prompt: { type: "STRING" },
      },
      required: ["prd", "design", "roadmap", "agents", "schema", "master_prompt"],
    },
  },
  required: ["project_name", "one_liner", "stack_summary", "docs"],
} as const;

export type VibeKitOutput = {
  project_name: string;
  one_liner: string;
  stack_summary: string;
  docs: {
    prd: string;
    design: string;
    roadmap: string;
    agents: string;
    schema: string;
    master_prompt: string;
  };
};

/** Shown in the UI so the user knows what they are paying for before they pay. */
export const VIBE_KIT_DOCS = [
  {
    key: "prd" as const,
    file: "PRD.md",
    label: "PRD",
    blurb: "Masalah, buat siapa, fitur mana yang masuk fase 1 dan mana yang ditunda.",
  },
  {
    key: "design" as const,
    file: "DESIGN.md",
    label: "Design system",
    blurb: "Token warna, tipografi, motion, dan aturan copy. Biar gak tiap layar beda gaya.",
  },
  {
    key: "roadmap" as const,
    file: "ROADMAP.md",
    label: "Roadmap",
    blurb: "Urutan langkah dengan definisi selesai yang bisa diuji, bukan checklist ngambang.",
  },
  {
    key: "agents" as const,
    file: "AGENTS.md",
    label: "Aturan agent",
    blurb: "Aturan keras buat AI-nya. Ini yang bikin dia gak ngarang atau kabur dari spek.",
  },
  {
    key: "schema" as const,
    file: "SCHEMA.md",
    label: "Skema database",
    blurb: "Tabel, relasi, dan aturan akses baris. Lengkap dengan SQL-nya.",
  },
  {
    key: "master_prompt" as const,
    file: "MASTER_PROMPT.md",
    label: "Prompt pembuka",
    blurb: "Yang lo paste pertama kali ke Claude, Cursor, atau Antigravity.",
  },
];

export const VIBE_KIT_CREDIT_COST = 6;

/**
 * Creator DNA reaches the Vibe Kit too.
 *
 * It was the only generator that ignored the profile entirely — the same
 * creator got the same documents as everyone else, which is exactly the
 * "generic AI output" complaint. Someone building for a client needs a spec
 * written for a client engagement; someone at "baru mulai" needs a roadmap that
 * does not assume a team.
 */
export function buildVibeKitPrompt(
  input: VibeKitInput,
  outputLanguage = "id",
  dna?: {
    industry?: string | null;
    experience_level?: string | null;
    work_context?: string | null;
    client_brief?: string | null;
    goals?: string | null;
    ai_persona_summary?: string | null;
  } | null,
): string {
  const lang =
    outputLanguage === "en"
      ? "English"
      : "Bahasa Indonesia yang natural dan ngobrol, bukan bahasa terjemahan";

  let who = "";
  if (dna) {
    const bits: string[] = [];
    if (dna.ai_persona_summary) bits.push(`Persona: ${dna.ai_persona_summary}`);
    if (dna.industry) bits.push(`Bidang: ${dna.industry}`);
    if (dna.experience_level) bits.push(`Jam terbang: ${dna.experience_level}`);
    if (dna.goals) bits.push(`Yang dia kejar: ${dna.goals}`);
    if (dna.work_context === "klien" || dna.work_context === "brand") {
      bits.push(
        `Dia bikin ini buat ${dna.work_context === "klien" ? "klien" : "brand tempat dia kerja"}${
          dna.client_brief ? ` — ${dna.client_brief}` : ""
        }`,
      );
    }
    if (bits.length) {
      who =
        `\nSIAPA YANG BAKAL PAKE DOKUMEN INI:\n- ${bits.join("\n- ")}\n` +
        `Sesuaikan kedalaman dan asumsinya. Kalau dia baru mulai, jangan asumsiin` +
        ` dia punya tim atau budget. Kalau dia udah lama, jangan jelasin hal dasar.\n`;
    }
  }

  return `Lo adalah engineer senior yang udah sering mimpin project dari nol sampai launch,
dan sekarang lagi bantu orang yang mau bikin aplikasi pakai AI coding agent
(Claude Code, Cursor, Antigravity, dan sejenisnya).

IDE DIA:
${input.idea}

${input.stack ? `STACK YANG DIA MAU: ${input.stack}` : "STACK: belum ditentuin. Lo yang pilihin, dan jelasin alasannya singkat."}
${input.audience ? `TARGET USER: ${input.audience}` : ""}
${who}

Tugas lo: bikin SATU SET dokumen spesifikasi lengkap yang siap ditaruh di root repo.
Dokumen ini yang bakal dibaca AI agent sebelum dia nulis baris kode pertama.

KENAPA INI PENTING — pahami ini dulu sebelum nulis:
Agent AI kehabisan konteks, sesi mati, orangnya ganti tool di tengah jalan.
Kalau dokumennya gak akurat, kerjaan hilang dan agent berikutnya ngarang.
Dokumen ini bukan formalitas — ini memori project.

ATURAN NULIS:
- Bahasa: ${lang}. Tapi nama tabel, kolom, tipe, dan semua identifier kode tetap bahasa Inggris.
- SPESIFIK. Jangan nulis "bikin autentikasi yang aman" — tulis metode apa, kenapa itu, dan apa konsekuensinya.
- Tiap keputusan harus ada ALASANNYA. Yang bikin dokumen ini berguna itu "kenapa", bukan "apa".
- Jujur soal batasan. Kalau sesuatu gak realistis di free tier, bilang, jangan pura-pura bisa.
- Format Markdown yang rapi. Pakai tabel kalau memang lebih jelas dari paragraf.

LANTAI KEDALAMAN — dokumen yang gak nyampe sini dianggap gagal:
- PRD: minimal 6 fitur fase 1, tiap fitur ada acceptance criteria yang bisa dicentang.
- DESIGN: minimal 12 token warna lengkap hex, 2 pasangan font dengan ukuran dan
  line-height, dan minimal 6 contoh copy nyata (loading, empty, error, sukses).
- SCHEMA: SQL DDL beneran yang bisa langsung dijalanin — CREATE TABLE lengkap
  dengan tipe, constraint, index, dan policy row-level security. Bukan deskripsi tabel.
- ROADMAP: tiap step ada "definition of done" yang bisa diuji, bukan "selesai".
- AGENTS: minimal 10 aturan keras, tiap aturan ada konsekuensi kalau dilanggar.
- MASTER_PROMPT: siap tempel, gak ada placeholder yang harus diisi manual.
- Sebutin daftar environment variable yang dibutuhin, lengkap sama fungsinya.
- Sebutin struktur folder yang disaranin sampai 2 level.

JANGAN KEDENGERAN KAYAK AI:
- Haram: "di era digital ini", "mari kita", "tak dapat dipungkiri", "sangatlah penting",
  "dalam dunia yang serba cepat", "solusi yang komprehensif".
- Jangan buka dokumen pakai definisi atau basa-basi. Kalimat pertama langsung ke inti.
- Jangan bikin daftar yang tiap poinnya cuma satu frasa tanpa isi. Poin kosong lebih
  buruk daripada gak ada poin.
- Angka, nama tool, versi, dan batas konkret. Vague itu yang bikin dokumen kerasa murah.
- Jangan menggurui dan jangan muji-muji idenya. Langsung kerja.

ISI TIAP DOKUMEN:

1. PRD.md
   Masalah yang dipecahin dan buat siapa. Positioning yang tajam.
   Fitur fase 1 (maksimal 8, yang bener-bener perlu buat produk ini hidup).
   Yang SENGAJA gak masuk fase 1, plus alasannya.
   Cara ngukur berhasil atau nggak.

2. DESIGN.md
   Konsep visualnya dalam satu kalimat yang bisa dipegang.
   Token warna lengkap dengan hex dan kapan dipakai. Hitam/putihnya jangan netral — kasih arah suhu warna dan jelasin kenapa.
   Tipografi: font display, body, dan mono, plus kapan masing-masing dipakai.
   Motion: durasi dan easing yang konkret.
   Aturan copy: nada bicara, dan contoh nyata buat loading, empty state, sama pesan error.
   Lantai kualitas: responsif sampai 360px, focus state keyboard kelihatan, prefers-reduced-motion dihormati.

3. ROADMAP.md
   Langkah bernomor dari nol sampai bisa dipakai orang. Tiap langkah punya deliverable dan
   DEFINISI SELESAI YANG BISA DIUJI — sesuatu yang bisa dijalanin dan diliat hasilnya,
   bukan "auth selesai".
   Tandain langkah mana yang paling berisiko dan kenapa.

4. AGENTS.md
   Aturan keras buat AI agent. Yang paling penting:
   - rahasia gak boleh masuk ke bundle browser atau ke git
   - jangan ngarang fitur di luar roadmap, tulis usulan lalu tunggu persetujuan
   - "berhasil" artinya udah dijalanin dan diliat jalan, bukan cuma build hijau
   - commit tiap checkpoint, jangan numpuk kerjaan gak ke-commit
   - kalau spek bentrok sama kenyataan, berhenti dan tanya, jangan nebak
   Plus protokol serah terima: file apa yang wajib diupdate sebelum sesi berakhir.

5. SCHEMA.md
   Tabel-tabelnya dalam SQL beneran yang bisa langsung dijalanin.
   Relasi antar tabel.
   Aturan akses per baris: siapa boleh baca dan tulis baris mana.
   Kalau ada operasi yang rawan balapan (saldo, kuota, stok), tulis fungsi database-nya
   dan jelasin kenapa gak boleh dikerjain dari kode aplikasi.

6. MASTER_PROMPT.md
   Prompt yang dia paste pertama kali ke AI agent-nya.
   Harus berdiri sendiri: siapa agent-nya, baca file mana dulu, mulai dari mana,
   dan kapan dia harus berhenti buat lapor.

Balas HANYA JSON valid sesuai skema. Isi tiap dokumen adalah string Markdown utuh.`;
}

// ---------------------------------------------------------------------------
// Per-document generation
// ---------------------------------------------------------------------------

type VibeDna = {
  industry?: string | null;
  experience_level?: string | null;
  work_context?: string | null;
  client_brief?: string | null;
  goals?: string | null;
  ai_persona_summary?: string | null;
} | null;

/** Shared preamble. Identical for every document so the six stay consistent. */
function vibeContext(input: VibeKitInput, lang: string, dna: VibeDna): string {
  let who = "";
  if (dna) {
    const bits: string[] = [];
    if (dna.ai_persona_summary) bits.push(`Persona: ${dna.ai_persona_summary}`);
    if (dna.industry) bits.push(`Bidang: ${dna.industry}`);
    if (dna.experience_level) bits.push(`Jam terbang: ${dna.experience_level}`);
    if (dna.goals) bits.push(`Yang dia kejar: ${dna.goals}`);
    if (dna.work_context === "klien" || dna.work_context === "brand") {
      bits.push(
        `Dia bikin ini buat ${dna.work_context === "klien" ? "klien" : "brand tempat dia kerja"}${
          dna.client_brief ? ` — ${dna.client_brief}` : ""
        }`,
      );
    }
    if (bits.length) {
      who =
        `\nSIAPA YANG BAKAL PAKE DOKUMEN INI:\n- ${bits.join("\n- ")}\n` +
        `Sesuaikan kedalaman dan asumsinya. Kalau dia baru mulai, jangan asumsiin` +
        ` dia punya tim atau budget. Kalau dia udah lama, jangan jelasin hal dasar.\n`;
    }
  }

  return `Lo engineer senior yang udah sering mimpin project dari nol sampai launch,
sekarang lagi bantu orang bikin aplikasi pakai AI coding agent (Claude Code, Cursor, dsb).

IDE DIA:
${input.idea}

${input.stack ? `STACK YANG DIA MAU: ${input.stack}` : "STACK: belum ditentuin. Lo yang pilihin, jelasin alasannya singkat."}
${input.audience ? `TARGET USER: ${input.audience}` : ""}
${who}
ATURAN NULIS:
- Bahasa: ${lang}. Nama tabel, kolom, tipe, dan identifier kode tetap bahasa Inggris.
- SPESIFIK. Jangan "bikin autentikasi yang aman" — tulis metodenya apa, kenapa, dan konsekuensinya.
- Tiap keputusan ada ALASANNYA. Yang bikin dokumen ini berguna itu "kenapa", bukan "apa".
- Jujur soal batasan. Kalau sesuatu gak realistis di free tier, bilang.
- Markdown rapi. Pakai tabel kalau lebih jelas dari paragraf.

JANGAN KEDENGERAN KAYAK AI:
- Haram: "di era digital ini", "mari kita", "tak dapat dipungkiri", "sangatlah penting",
  "dalam dunia yang serba cepat", "solusi yang komprehensif".
- Jangan buka pakai definisi atau basa-basi. Kalimat pertama langsung ke inti.
- Jangan bikin poin yang cuma satu frasa tanpa isi. Poin kosong lebih buruk dari gak ada poin.
- Angka, nama tool, versi, dan batas konkret. Vague bikin dokumen kerasa murah.
- Jangan menggurui dan jangan muji-muji idenya. Langsung kerja.`;
}

/** Short first pass: names the project so all six documents agree on it. */
export function buildVibeIdentityPrompt(
  input: VibeKitInput,
  lang = "id",
  dna: VibeDna = null,
): string {
  return `${vibeContext(input, lang, dna)}

Tugas lo sekarang CUMA tiga hal pendek:
1. project_name — nama project yang enak disebut, maksimal 3 kata.
2. one_liner — satu kalimat yang jelasin produknya ke orang awam.
3. stack_summary — stack yang dipakai dan alasannya, maksimal 2 kalimat.

Balas HANYA JSON valid sesuai skema. Tanpa \`\`\`json.`;
}

/** One document. Called six times concurrently. */
export function buildVibeDocPrompt(
  input: VibeKitInput,
  doc: (typeof VIBE_DOC_SPECS)[number],
  identity: { project_name: string; one_liner: string; stack_summary: string },
  lang = "id",
  dna: VibeDna = null,
): string {
  return `${vibeContext(input, lang, dna)}

PROJECT INI UDAH DINAMAIN:
- Nama: ${identity.project_name}
- Ringkasan: ${identity.one_liner}
- Stack: ${identity.stack_summary}
Pakai nama dan stack itu konsisten. Jangan bikin nama atau stack baru.

Tugas lo sekarang: tulis SATU dokumen — ${doc.file}.

ISI YANG DIMINTA:
${doc.brief}

KENAPA INI PENTING:
Agent AI kehabisan konteks, sesi mati, orangnya ganti tool di tengah jalan.
Kalau dokumennya gak akurat, kerjaan hilang dan agent berikutnya ngarang.
Ini bukan formalitas — ini memori project.

Tulis isi ${doc.file} lengkap sebagai Markdown, di field "content".
Jangan tulis dokumen lain. Balas HANYA JSON valid sesuai skema. Tanpa \`\`\`json.`;
}

// ---------------------------------------------------------------------------
// Clarifying questions
// ---------------------------------------------------------------------------

/**
 * Five questions, asked before anything is generated.
 *
 * A one-sentence idea produces a one-sentence-deep specification. No amount of
 * prompt engineering fixes missing information — the model has to invent the
 * user, the constraint and the priority, and invented context is exactly what
 * "generic AI output" is made of.
 *
 * The questions are generated from the idea rather than fixed, because the right
 * questions for a cashier app are not the right questions for a habit tracker.
 * Each comes with suggested answers so the whole step is tappable: a required
 * form of five open text boxes gets abandoned, and an abandoned form teaches the
 * model nothing.
 *
 * Free of charge on purpose. Charging to improve the thing they already paid for
 * would be hostile, and the answers make the paid output measurably better.
 */
export const VIBE_QUESTIONS_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          q: { type: "STRING" },
          why: { type: "STRING" },
          suggestions: { type: "ARRAY", items: { type: "STRING" } },
          multi: { type: "BOOLEAN" },
        },
        required: ["q", "why", "suggestions", "multi"],
      },
    },
  },
  required: ["questions"],
} as const;

export type VibeQuestion = {
  q: string;
  why: string;
  suggestions: string[];
  multi: boolean;
};

export function buildVibeQuestionsPrompt(idea: string, lang = "id"): string {
  const language =
    lang === "en" ? "English" : "Bahasa Indonesia yang santai dan gampang dipahami orang awam";

  return `Lo product manager senior. Orang ini mau bikin aplikasi tapi idenya masih terlalu umum:

"${idea}"

Tugas lo: bikin TEPAT 5 pertanyaan yang paling nentuin bentuk produknya.

Yang bikin pertanyaan bagus:
- Jawabannya ngubah keputusan nyata di produk, bukan cuma nambah info.
- Spesifik ke ide DIA, bukan pertanyaan template yang bisa ditempel ke aplikasi apa pun.
- Bisa dijawab orang yang bukan programmer. Jangan tanya soal database atau framework.

Wajib ada minimal satu pertanyaan tentang:
1. Siapa orangnya dan sekarang dia ngatasin masalah ini pakai apa.
2. Satu hal yang paling penting kelar di pemakaian pertama.
3. Fitur mana yang WAJIB ada versus yang bisa nanti.

Buat tiap pertanyaan:
- "q": pertanyaannya, satu kalimat, bahasa ${language}.
- "why": kenapa ini ngaruh, maksimal 12 kata. Ini dipajang ke user biar dia tau pertanyaannya bukan iseng.
- "suggestions": 4-5 jawaban singkat yang masuk akal buat ide DIA, biar bisa tinggal ditap.
  Bikin yang beneran nyambung sama idenya — jangan generik.
- "multi": true kalau boleh pilih beberapa, false kalau satu aja.

Balas HANYA JSON valid sesuai skema. Tanpa \`\`\`json.`;
}

/** Folds the answers into the shared context for every document. */
export function formatVibeAnswers(
  answers: { q: string; a: string }[],
): string {
  const filled = answers.filter((x) => x.a.trim());
  if (!filled.length) return "";
  return (
    `\nJAWABAN DIA ATAS PERTANYAAN KLARIFIKASI:\n` +
    filled.map((x) => `- ${x.q}\n  → ${x.a}`).join("\n") +
    `\nIni informasi langsung dari dia. Pakai ini, jangan ngarang asumsi sendiri` +
    ` yang bertentangan sama jawaban di atas.\n`
  );
}
