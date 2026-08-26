"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";

const PLATFORMS = ["tiktok", "instagram", "youtube", "x", "threads"];

const WORK_CONTEXTS = [
  {
    id: "sendiri",
    label: "Buat Diri Sendiri",
    hint: "Personal brand. Konten pakai 'gue', pengalaman pribadi boleh dipakai.",
  },
  {
    id: "klien",
    label: "Buat Klien",
    hint: "Lo di balik kamera. Konten tidak akan mengaku-ngaku pengalaman lo sebagai pemilik.",
  },
  {
    id: "brand",
    label: "Buat Bisnis / Brand",
    hint: "Cocok buat pemilik usaha & tim marketing. Konten berbicara sebagai perwakilan bisnis.",
  },
];

const PERSONA_STYLES = [
  "Santai & humble",
  "Blak-blakan",
  "Edukatif tapi ringan",
  "Sarkas / nyeleneh",
  "Rapi & profesional",
  "Hype & energik",
];

const EXPERIENCE = ["Baru mulai", "Udah jalan beberapa bulan", "Udah lama & konsisten"];
const FREQUENCY = ["Tiap hari", "3-4x seminggu", "Seminggu sekali", "Belum tentu"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [f, setF] = useState({
    niche: "",
    industry: "",
    work_context: "sendiri",
    client_brief: "",
    target_audience: "",
    goals: "",
    tone: "",
    persona_style: "",
    humor_level: 5,
    experience_level: "",
    posting_frequency: "",
    content_pillars: "",
    reference_creators: "",
    platforms: [] as string[],
    banned_words: "",
    brand_notes: "",
  });

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const togglePlatform = (p: string) =>
    setF((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(p)
        ? prev.platforms.filter((x) => x !== p)
        : [...prev.platforms, p],
    }));

  const scored = [
    f.niche,
    f.industry,
    f.target_audience,
    f.goals,
    f.tone,
    f.persona_style,
    f.experience_level,
    f.posting_frequency,
    f.content_pillars,
    f.reference_creators,
    f.platforms.length ? "y" : "",
    f.brand_notes,
    f.work_context === "sendiri" ? "y" : f.client_brief,
  ];
  const filled = scored.filter((x) => String(x).trim()).length;
  const pct = Math.round((filled / scored.length) * 100);

  const submit = async () => {
    if (!f.niche.trim()) {
      setError("Niche-nya diisi dulu ya — itu satu-satunya yang wajib.");
      setStep(0);
      return;
    }
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          humor_level: Number(f.humor_level),
          banned_words: f.banned_words.split(",").map((w) => w.trim()).filter(Boolean),
          content_pillars: f.content_pillars.split(",").map((w) => w.trim()).filter(Boolean),
        }),
      });

      const raw = await res.text();
      if (!res.ok) {
        throw new Error(
          (() => {
            try {
              return JSON.parse(raw).error || "Gagal menyimpan data profil.";
            } catch {
              return raw || "Gagal menyimpan data profil.";
            }
          })(),
        );
      }

      const data = JSON.parse(raw);
      if (data.ai_persona_summary) {
        sessionStorage.setItem("ai_persona_summary", data.ai_persona_summary);
      }
      router.push("/app/onboarding/success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ada kendala teknis.");
      setIsSubmitting(false);
    }
  };

  const steps = [
    { title: "Konteks Konten", desc: "Niche & Sasaran" },
    { title: "Gaya & Persona", desc: "Karakter & Nada" },
    { title: "Detail & Platform", desc: "Target & Eksekusi" },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#08080a] text-ink">
      {/* Top Header Navbar with Logo & Back to Studio */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0c0c0e]/80 backdrop-blur-xl px-4 py-3.5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/app" className="flex items-center gap-2">
              <Logo />
            </Link>
            <span className="hidden sm:inline-block text-xs text-muted">/</span>
            <span className="hidden sm:inline-block font-display text-xs font-bold text-muted">
              Profil Konten Utama
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.12] bg-surface px-3.5 text-xs font-semibold text-muted transition-all hover:border-ember/40 hover:text-ink active:scale-[0.98]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Kembali ke Studio</span>
            </Link>

            <Link
              href="/app"
              className="hidden sm:inline-flex h-9 items-center rounded-xl px-3 text-xs font-semibold text-ember hover:underline"
            >
              Lewati Dulu ➔
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        <div className="surface-card rounded-3xl border border-white/[0.08] bg-gradient-to-b from-surface-raised/90 via-surface to-[#0e0e11] p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Title Header */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember/15 px-3 py-1 text-micro font-bold uppercase tracking-wider text-ember">
              <span className="size-1.5 rounded-full bg-ember animate-pulse" />
              <span>Creator DNA Setup</span>
            </div>
            <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              Kenalan Dulu Bentar
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-muted max-w-xl">
              Ini yang bikin hasil generasi Malesan kerasa kayak karakter lo, bukan robot kaku. Hanya niche yang wajib, sisanya bebas lo isi kapan saja.
            </p>
          </div>

          {/* Completeness Bar */}
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#09090b] p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted">Kelengkapan Profil Karakter</span>
              <span className="font-mono font-bold text-ember">{pct}% Selesai</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full rounded-full bg-gradient-to-r from-ember to-amber-400 transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Step Progress Tabs */}
          <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-white/[0.08] bg-[#09090b] p-1.5">
            {steps.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => setStep(i)}
                className={`flex flex-col items-center justify-center rounded-xl py-2.5 text-center transition-all cursor-pointer ${
                  i === step
                    ? "border border-ember/40 bg-ember/15 text-ember shadow-xs"
                    : "text-muted hover:bg-white/[0.04] hover:text-ink"
                }`}
              >
                <span className="font-display text-xs font-bold">
                  {i + 1}. {s.title}
                </span>
                <span className="hidden sm:inline-block text-[10px] text-muted/80">
                  {s.desc}
                </span>
              </button>
            ))}
          </div>

          {/* Form Content Steps */}
          <div className="mt-7 space-y-6">
            {step === 0 && (
              <>
                <Field
                  label="Niche / Topik Utama Konten Lo?"
                  required
                  hint="Contoh: review motor bekas, tips freelance desain, resep masak hemat, bisnis skincare."
                >
                  <input
                    value={f.niche}
                    onChange={(e) => set("niche", e.target.value)}
                    placeholder="Misal: Review gadget & tips produktivitas"
                    className={inputCls}
                  />
                </Field>

                <Field label="Kontennya Dibuat Untuk Siapa?" hint="Menentukan sudut pandang narasi ('gue', 'kita', atau perwakilan bisnis).">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {WORK_CONTEXTS.map((w) => {
                      const on = f.work_context === w.id;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => set("work_context", w.id)}
                          aria-pressed={on}
                          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                            on
                              ? "border-ember/60 bg-ember/15 shadow-xs"
                              : "border-white/[0.08] bg-[#09090b] hover:border-white/[0.18]"
                          }`}
                        >
                          <div>
                            <p className={`font-display text-sm font-bold ${on ? "text-ember" : "text-ink"}`}>
                              {w.label}
                            </p>
                            <p className="mt-1.5 text-micro leading-relaxed text-muted">
                              {w.hint}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {f.work_context !== "sendiri" && (
                  <Field
                    label={f.work_context === "klien" ? "Klien Lo Bergerak di Bidang Apa?" : "Bisnis / Brand Lo Soal Apa?"}
                    hint="Biar AI tahu konteks bisnis dan target pasarnya secara akurat."
                  >
                    <textarea
                      rows={3}
                      value={f.client_brief}
                      onChange={(e) => set("client_brief", e.target.value)}
                      placeholder="Contoh: Brand sepatu lokal di Bandung, target Gen-Z, fokus kenyamanan harian."
                      className={inputCls}
                    />
                  </Field>
                )}

                <Field label="Bidang / Industri Spesifik?" hint="Misal: Kuliner, Otomotif, Finansial, Fashion, Edukasi Tech.">
                  <input
                    value={f.industry}
                    onChange={(e) => set("industry", e.target.value)}
                    placeholder="Teknologi & Kreatif"
                    className={inputCls}
                  />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <Field label="Siapa Target Audiens / Penonton Lo?" hint="Umur, profesi, masalah yang sering mereka hadapi.">
                  <input
                    value={f.target_audience}
                    onChange={(e) => set("target_audience", e.target.value)}
                    placeholder="Anak muda 20-30 tahun, first jobber yang mau cari side income"
                    className={inputCls}
                  />
                </Field>

                <Field label="Gaya Bahasa & Karakter Persona Utama?">
                  <Chips
                    options={PERSONA_STYLES}
                    value={f.persona_style}
                    onPick={(v) => set("persona_style", v)}
                  />
                </Field>

                <Field label="Tingkat Humor & Candaan (1-10)">
                  <div className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#09090b] p-4">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={f.humor_level}
                      onChange={(e) => set("humor_level", Number(e.target.value))}
                      className="h-2 flex-1 accent-ember cursor-pointer"
                    />
                    <span className="font-mono text-sm font-bold text-ember">{f.humor_level} / 10</span>
                  </div>
                </Field>

                <Field label="Apa Tujuan Utama Konten Lo?" hint="Misal: naikin followers, jualan produk affiliate, bangun reputasi pakar.">
                  <input
                    value={f.goals}
                    onChange={(e) => set("goals", e.target.value)}
                    placeholder="Edukasi audiens dan arahkan ke link bio affiliate"
                    className={inputCls}
                  />
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                <Field label="Platform Utama Tempat Lo Posting?">
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => {
                      const on = f.platforms.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => togglePlatform(p)}
                          className={`rounded-xl border px-4 py-2 text-xs font-bold capitalize transition-all cursor-pointer ${
                            on
                              ? "border-ember bg-ember/20 text-ember shadow-xs"
                              : "border-white/[0.1] bg-[#09090b] text-muted hover:text-ink"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Pengalaman Ngonten Saat Ini">
                  <Chips
                    options={EXPERIENCE}
                    value={f.experience_level}
                    onPick={(v) => set("experience_level", v)}
                  />
                </Field>

                <Field label="Target Frekuensi Posting">
                  <Chips
                    options={FREQUENCY}
                    value={f.posting_frequency}
                    onPick={(v) => set("posting_frequency", v)}
                  />
                </Field>

                <Field label="Pilar Konten Utama" hint="Tema yang lo putar terus menerus, pisahkan dengan koma.">
                  <input
                    value={f.content_pillars}
                    onChange={(e) => set("content_pillars", e.target.value)}
                    placeholder="review jujur, tips praktis, studi kasus, mitos vs fakta"
                    className={inputCls}
                  />
                </Field>

                <Field label="Kata-Kata yang HARAM Dipakai" hint="Kata yang bikin lo risih kalau muncul di tulisan. Pisahkan dengan koma.">
                  <input
                    value={f.banned_words}
                    onChange={(e) => set("banned_words", e.target.value)}
                    placeholder="sobat, guys, di era digital ini, yuk simak"
                    className={inputCls}
                  />
                </Field>
              </>
            )}
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Action Footer Navigation Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.08] pt-6">
            {step === 0 ? (
              <Link
                href="/app"
                className="w-full sm:w-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-surface px-5 text-xs font-semibold text-muted hover:text-ink active:scale-[0.98]"
              >
                <span>Batal &amp; Kembali ke Studio</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="w-full sm:w-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-surface px-5 text-xs font-semibold text-muted hover:text-ink active:scale-[0.98] cursor-pointer"
              >
                <span>← Balik ke Step Sebelumnya</span>
              </button>
            )}

            <div className="flex w-full sm:w-auto items-center gap-3">
              {step < 2 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  className="flex-1 sm:flex-none inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ember px-7 font-display text-xs sm:text-sm font-bold text-obsidian shadow-xs transition-all hover:bg-ember-lo active:scale-[0.98] cursor-pointer"
                >
                  <span>Lanjut ke Step {step + 2} ➔</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ember px-8 font-display text-xs sm:text-sm font-bold text-obsidian shadow-xs transition-all hover:bg-ember-lo active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <span className="size-3.5 rounded-full border-2 border-obsidian/30 border-t-obsidian animate-spin" />
                      <span>Menyimpan Karakter...</span>
                    </>
                  ) : (
                    <span>Selesai &amp; Simpan Profil ➔</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-white/[0.1] bg-[#09090b] px-4 py-3 text-sm text-ink placeholder:text-muted/60 transition-all focus:border-ember focus:bg-[#0c0c0e] focus:outline-none focus:ring-2 focus:ring-ember/20";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block font-display text-xs sm:text-sm font-bold text-ink">
        {label}
        {required && <span className="ml-1 text-ember font-bold">*</span>}
      </label>
      {hint && <p className="mt-1 text-micro leading-relaxed text-muted">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Chips({
  options,
  value,
  onPick,
}: {
  options: string[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onPick(on ? "" : o)}
            aria-pressed={on}
            className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
              on
                ? "border-ember bg-ember/15 text-ember shadow-xs font-bold"
                : "border-white/[0.1] bg-[#09090b] text-muted hover:border-white/[0.2] hover:text-ink"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
