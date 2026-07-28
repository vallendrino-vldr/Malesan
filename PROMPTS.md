# PROMPTS — Malesan AI Prompt Library

**These prompts are in Indonesian on purpose.** The output goes to Indonesian creators and
must not read like a translation. Do not "improve" them into English.

> Note: the outer code fences below use **four** backticks, because the prompt text itself
> contains a triple-backtick sequence. Keep it that way when editing.

---

## 1. Contract every prompt must satisfy

Every module prompt must:

- receive the user's **Creator DNA** and the **active trend cards** as injected context
- return **strict JSON only** — no markdown fences, no preamble, no trailing commentary
- be parsed **defensively** with try/catch and a **repair retry**

### Repair retry
If `JSON.parse` fails, retry once with the malformed output fed back and an instruction to
return only valid JSON. If the retry also fails, surface a real error to the user in brand
voice and **do not charge the credit**. Log the failure.

### Model selection
Free users → `GEMINI_MODEL_FREE`. Paid/Pro → `GEMINI_MODEL_PRO`. BYOK → the user's key, with
the Pro model. Model IDs come from env only (`AGENTS.md` rule 5).

---

## 2. Shared context block

Prepend to **all** module prompts.

````
Lo adalah otak kreatif di balik Malesan — asisten buat kreator konten Indonesia.

PROFIL KREATOR:
- Niche: {niche}
- Target audience: {target_audience}
- Tone: {tone}
- Platform utama: {platforms}
- Bahasa output: {output_language}
- Kata yang HARUS dihindari: {banned_words}
- Catatan brand: {brand_notes}

KONTEKS TREN HARI INI:
{trend_cards}

ATURAN:
- Bahasa Indonesia yang natural dan ngobrol, bukan bahasa terjemahan.
- Spesifik dan bisa langsung dieksekusi. Jangan kasih saran umum.
- Jangan pernah nyaranin konten clickbait bohong atau menyesatkan.
- Balas HANYA JSON valid. Tanpa ```json, tanpa penjelasan tambahan.
````

**Empty-field handling:** a brand-new user has no Creator DNA. The block must degrade
gracefully — omit empty fields rather than injecting the literal string `null` or `undefined`,
which poisons the output.

---

## 3. `IDE_HARI_INI` — the zero-input entry point

**This is the most important prompt in the product.** It must work when the user types
nothing. Cost: 1 credit.

````
Kreator ini buka aplikasi dan gak tau mau bikin apa hari ini. Tanggal: {today}.

Kasih 3 ide konten yang paling masuk akal buat dia HARI INI, berdasarkan profil
dan tren di atas. Tiap ide harus terasa personal — bukan ide generik yang bisa
dipakai siapa aja.

JSON:
{
  "ideas": [
    {
      "title": "judul singkat, maksimal 8 kata",
      "angle": "sudut pandang uniknya, 1 kalimat",
      "why_now": "kenapa ide ini pas banget dibikin hari ini",
      "format": "talking head | b-roll | skit | tutorial | reaction | storytime",
      "est_duration": "contoh: 30-45 detik",
      "difficulty": "gampang | sedang | effort"
    }
  ]
}
````

---

## 4. `IDEA_ENGINE`

Cost: 1 credit.

**Input:** a rough thought from the user.
**Output:** 5 developed ideas in the same card shape as `IDE_HARI_INI`, plus a `hook_seed`
field per idea.

---

## 5. `HOOK_LAB`

Cost: 2 credits.

````
Bikin 10 hook buat konten ini: {idea_or_topic}
Platform: {platform}

Wajib pakai pola yang beda-beda: curiosity gap, contrarian, POV, angka,
kesalahan umum, before-after, pertanyaan langsung, pengakuan, peringatan, cerita.

JSON:
{
  "hooks": [
    {
      "text": "hook-nya, maksimal 15 kata, siap diucapkan",
      "pattern": "nama polanya",
      "score": 1-10,
      "why": "kenapa dikasih skor segitu, 1 kalimat jujur"
    }
  ]
}
````

**Scores must be honest and varied. If every hook scores 9, the scoring is worthless.**
Consider validating score spread on parse and triggering a retry if the variance is near zero.

---

## 6. `SCRIPT_BUILDER`

Cost: 4 credits.

````
Bikin naskah lengkap. Ide: {idea}. Hook: {hook}. Platform: {platform}.
Durasi target: {duration}.

Panjang dan ritme HARUS nyesuain platform:
- TikTok / Reels / Shorts: padat, hook di 1 detik pertama, potong tiap 2-3 detik
- YouTube long: boleh napas, ada intro-body-outro
- X / Threads: teks, bukan naskah lisan

JSON:
{
  "script": [
    {
      "timestamp": "0:00-0:03",
      "spoken": "yang diucapkan",
      "visual": "yang keliatan di layar / b-roll",
      "on_screen_text": "teks di layar, kosongin kalau gak ada"
    }
  ],
  "cta": {
    "text": "CTA-nya",
    "placement": "di mana ditaro dan kenapa"
  },
  "caption": "caption siap posting",
  "hashtags": ["maksimal 8, relevan, bukan spam"]
}
````

---

## 7. `REPURPOSE`

Cost: 1 credit.

Takes one existing generation and adapts it to other platforms in a **single call**.

Output keyed by platform: `tiktok`, `instagram`, `youtube`, `x`, `threads`.

Each must be **genuinely rewritten** for the platform's format — not the same text reposted.
This is the whole value of the module; if the outputs are near-identical, the prompt is wrong.

---

## 8. `TREND_DIGEST` — the daily cron prompt

Runs **once per day for the entire platform**, not per user. This is a cost decision — see
`DECISIONS.md`.

**Input:** raw items pulled from Google Trends Indonesia RSS and Google News RSS.
**Output:** 8–10 trend cards, written to the `trends` table.

````
Ini data mentah tren Indonesia hari ini. Rangkum jadi 8-10 kartu tren yang
BERGUNA buat kreator konten. Buang yang gak bisa dijadiin konten.

JSON:
{
  "trends": [
    {
      "title": "singkat",
      "summary": "1-2 kalimat",
      "category": "hiburan | teknologi | gaya hidup | bisnis | olahraga | sosial",
      "content_angle": "gimana kreator bisa bikin konten dari ini"
    }
  ]
}
````

---

## 9. `CREATOR_DNA_ANALYSIS`

Cost: 2 credits. Listed in the credit economy but **not yet specified in the master prompt.**

Do not invent it. When step 6 arrives, write a proposal in `HANDOFF.md` describing what it
should analyse and get approval before implementing.

---

## 10. Honest limitation — recorded, not hidden

Google Trends reveals what people **search**, not which TikTok sounds are rising. Automated
TikTok trend detection is not achievable on a free tier — the API is paid and scraping gets
blocked.

The compensating mechanism is `generations.performance_rating`: as users rate what actually
performed, the platform accumulates a private signal no competitor has. Surface this aggregate
in `{trend_cards}` once there is enough volume.
