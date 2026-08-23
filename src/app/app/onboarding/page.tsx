"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Creator DNA setup.
 *
 * The old form asked six questions and never asked the one that changes
 * everything: who the content is for. A creator posting for themselves and a
 * creator producing for a client write from different points of view, and
 * without that every generation defaulted to first-person-owner.
 *
 * Split into three steps so the depth does not read as a wall. Every field is
 * optional except the niche — a form that blocks on completeness gets abandoned
 * — but the completeness meter makes the trade visible, because the honest
 * answer is that a thin profile produces thin output.
 */

const PLATFORMS = ["tiktok", "instagram", "youtube", "x", "threads"];

const WORK_CONTEXTS = [
  {
    id: "sendiri",
    label: "Buat diri sendiri",
    hint: "Personal brand. Konten pakai “gue”, pengalaman pribadi boleh dipakai.",
  },
  {
    id: "klien",
    label: "Buat klien",
    hint: "Lo yang di balik kamera. Konten gak bakal ngaku-ngaku pengalaman lo sebagai pemilik usahanya.",
  },
  {
    id: "brand",
    label: "Buat bisnis atau brand",
    hint: "Cocok buat pemilik usaha dan tim brand. Kontennya ngomong sebagai bisnis.",
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

  // Completeness is honest, not decorative: these are the fields that actually
  // reach the prompt, so the number reflects how much the model has to work with.
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

      // One read, then parse. The old code called res.json() in the error path
      // and again for the success payload.
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(
          (() => {
            try {
              return JSON.parse(raw).error || "Gagal nyimpen data.";
            } catch {
              return raw || "Gagal nyimpen data.";
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
      setError(err instanceof Error ? err.message : "Ada yang error.");
      setIsSubmitting(false);
    }
  };

  const steps = ["Lo ngapain", "Gaya lo", "Detail"];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-obsidian">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-8">
        <header>
          <p className="eyebrow text-ember">Profil konten utama</p>
          <h1 className="mt-2 font-display text-2xl font-bold leading-tight text-ink">
            Kenalan dulu bentar
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Ini yang bikin hasilnya kerasa kayak lo, bukan kayak robot. Makin
            lengkap, makin nyambung — tapi gak ada yang wajib selain niche.
          </p>
        </header>

        {/* completeness */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-micro">
            <span className="text-muted">Kelengkapan profil</span>
            <span className="font-mono text-ember">{pct}%</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-ember transition-[width] duration-[var(--duration-standard)] ease-heat"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* step tabs */}
        <div className="mt-5 flex gap-1 rounded-xl border border-hairline bg-surface/60 p-1">
          {steps.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className={`flex-1 cursor-pointer rounded-lg py-2 text-mini font-semibold transition-colors duration-[var(--duration-standard)] ease-heat ${
                i === step ? "bg-ember/15 text-ember" : "text-muted hover:text-ink"
              }`}
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>

        <div className="mt-5 flex-1 space-y-5">
          {step === 0 && (
            <>
              <Field
                label="Niche lo apa?"
                required
                hint="Contoh: review motor bekas, masak rumahan hemat, tips freelance desain."
              >
                <input
                  value={f.niche}
                  onChange={(e) => set("niche", e.target.value)}
                  placeholder="Review motor bekas"
                  className={inputCls}
                />
              </Field>

              <Field label="Kontennya buat siapa?" hint="Ini yang paling ngaruh ke sudut pandang tulisannya.">
                <div className="space-y-2">
                  {WORK_CONTEXTS.map((w) => {
                    const on = f.work_context === w.id;
                    return (
                      <button
                        key={w.id}
                        onClick={() => set("work_context", w.id)}
                        aria-pressed={on}
                        className={`block w-full cursor-pointer rounded-xl border p-3 text-left transition-colors duration-[var(--duration-standard)] ease-heat ${
                          on ? "border-ember/45 bg-ember/10" : "border-hairline bg-surface hover:border-ember/25"
                        }`}
                      >
                        <p className={`text-sm font-semibold ${on ? "text-ember" : "text-ink"}`}>
                          {w.label}
                        </p>
                        <p className="mt-1 text-micro leading-relaxed text-muted">{w.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </Field>

              {f.work_context !== "sendiri" && (
                <Field
                  label={f.work_context === "klien" ? "Kliennya jualan apa?" : "Bisnis atau brand-nya soal apa?"}
                  hint="Makin jelas, makin gak ngarang."
                >
                  <textarea
                    rows={3}
                    value={f.client_brief}
                    onChange={(e) => set("client_brief", e.target.value)}
                    placeholder="Bengkel motor di Bandung, spesialis matic, target anak kuliahan."
                    className={inputCls}
                  />
                </Field>
              )}

              <Field label="Bidang / industrinya apa?" hint="Otomotif, F&B, kecantikan, edukasi, properti...">
                <input
                  value={f.industry}
                  onChange={(e) => set("industry", e.target.value)}
                  placeholder="Otomotif"
                  className={inputCls}
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Cara ngomong lo gimana?">
                <Chips
                  options={PERSONA_STYLES}
                  value={f.persona_style}
                  onPick={(v) => set("persona_style", v)}
                />
              </Field>

              <Field
                label={`Level humor · ${f.humor_level}/10`}
                hint="0 = serius dan edukatif. 10 = komedi duluan, informasi belakangan."
              >
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={f.humor_level}
                  onChange={(e) => set("humor_level", Number(e.target.value))}
                  className="w-full accent-[var(--color-ember)]"
                  aria-label="Level humor"
                />
              </Field>

              <Field label="Tone ngomongnya kayak gimana?" hint="Tulis bebas. Contoh: kayak lagi ngobrol sama temen di warung kopi.">
                <textarea
                  rows={2}
                  value={f.tone}
                  onChange={(e) => set("tone", e.target.value)}
                  placeholder="Santai, suka nyeletuk, gak sok pinter"
                  className={inputCls}
                />
              </Field>

              <Field label="Target audiens lo siapa?">
                <input
                  value={f.target_audience}
                  onChange={(e) => set("target_audience", e.target.value)}
                  placeholder="Cowok 18-27, anak kuliahan, motor matic"
                  className={inputCls}
                />
              </Field>

              <Field label="Lo pengennya gimana?" hint="Nambah followers? Jualan? Dikenal sebagai ahli di bidang lo?">
                <textarea
                  rows={2}
                  value={f.goals}
                  onChange={(e) => set("goals", e.target.value)}
                  placeholder="Pengen dikenal sebagai orang yang jujur soal motor bekas, ujungnya jualan jasa inspeksi"
                  className={inputCls}
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Platform utama">
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => {
                    const on = f.platforms.includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() => togglePlatform(p)}
                        aria-pressed={on}
                        className={`cursor-pointer rounded-full border px-3.5 py-2 text-xs font-semibold capitalize transition-colors duration-[var(--duration-standard)] ease-heat ${
                          on
                            ? "border-ember/45 bg-ember/10 text-ember"
                            : "border-hairline text-muted hover:text-ink"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Jam terbang">
                <Chips options={EXPERIENCE} value={f.experience_level} onPick={(v) => set("experience_level", v)} />
              </Field>

              <Field label="Seberapa sering posting">
                <Chips options={FREQUENCY} value={f.posting_frequency} onPick={(v) => set("posting_frequency", v)} />
              </Field>

              <Field label="Pilar konten" hint="Pisahin pakai koma. Tema yang lo puter-puter terus.">
                <input
                  value={f.content_pillars}
                  onChange={(e) => set("content_pillars", e.target.value)}
                  placeholder="review jujur, tips hemat, bongkar mitos"
                  className={inputCls}
                />
              </Field>

              <Field label="Kreator yang lo suka gayanya" hint="Buat kalibrasi rasa, bukan buat ditiru mentah.">
                <input
                  value={f.reference_creators}
                  onChange={(e) => set("reference_creators", e.target.value)}
                  placeholder="Contoh: gaya bicaranya si A, editing-nya si B"
                  className={inputCls}
                />
              </Field>

              <Field label="Kata yang haram dipakai" hint="Pisahin pakai koma.">
                <input
                  value={f.banned_words}
                  onChange={(e) => set("banned_words", e.target.value)}
                  placeholder="guys, sobat, di era digital ini"
                  className={inputCls}
                />
              </Field>

              <Field label="Ada lagi yang perlu gue tau?">
                <textarea
                  rows={3}
                  value={f.brand_notes}
                  onChange={(e) => set("brand_notes", e.target.value)}
                  placeholder="Pantangan, aturan brand, hal yang gak boleh disinggung..."
                  className={inputCls}
                />
              </Field>
            </>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2 pb-[env(safe-area-inset-bottom)]">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="cursor-pointer rounded-xl border border-hairline px-5 py-3 text-sm font-semibold text-muted hover:text-ink"
            >
              Balik
            </button>
          )}
          {step < 2 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex-1 cursor-pointer rounded-xl bg-ember px-5 py-3 font-display text-sm font-bold text-obsidian transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo"
            >
              Lanjut
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={isSubmitting}
              className="flex-1 cursor-pointer rounded-xl bg-ember px-5 py-3 font-display text-sm font-bold text-obsidian transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo disabled:opacity-60"
            >
              {isSubmitting ? "Lagi ngerangkum gaya lo..." : "Simpan · 2 kredit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full resize-none rounded-xl border border-hairline bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember";

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
      <label className="block text-sm font-semibold text-ink">
        {label}
        {required && <span className="ml-1 text-ember">*</span>}
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
            onClick={() => onPick(on ? "" : o)}
            aria-pressed={on}
            className={`cursor-pointer rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors duration-[var(--duration-standard)] ease-heat ${
              on ? "border-ember/45 bg-ember/10 text-ember" : "border-hairline text-muted hover:text-ink"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
