"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    niche: "",
    target_audience: "",
    tone: "",
    platforms: [] as string[],
    banned_words: "",
    brand_notes: "",
  });

  const PLATFORMS = ["tiktok", "instagram", "youtube", "x", "threads"];

  const togglePlatform = (p: string) => {
    setFormData((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(p)
        ? prev.platforms.filter((x) => x !== p)
        : [...prev.platforms, p],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          banned_words: formData.banned_words
            .split(",")
            .map((w) => w.trim())
            .filter((w) => w.length > 0),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal nyimpen data");
      }

      const data = await res.json();
      // Store the persona summary in sessionStorage to show on the success page
      if (data.ai_persona_summary) {
        sessionStorage.setItem("ai_persona_summary", data.ai_persona_summary);
      }
      
      router.push("/app/onboarding/success");
      
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian py-12 px-5">
      <main className="mx-auto max-w-2xl">
        <div className="reveal">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ember">
            Langkah Terakhir
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-display-md text-ink">
            Setup Creator DNA
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Biar hasil AI-nya gak generik kayak ChatGPT biasa, gue butuh tau
            profil lo. Tenang, ini cuma diisi sekali aja.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="reveal mt-10 space-y-8">
          {/* Niche */}
          <div className="space-y-3">
            <label className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Niche / Topik Utama
            </label>
            <input
              type="text"
              required
              value={formData.niche}
              onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
              placeholder="Contoh: Tekno kere hore, Review makanan pinggir jalan..."
              className="w-full rounded-xl border border-hairline bg-surface p-4 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
            />
          </div>

          {/* Target Audience */}
          <div className="space-y-3">
            <label className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Target Audience
            </label>
            <input
              type="text"
              required
              value={formData.target_audience}
              onChange={(e) =>
                setFormData({ ...formData, target_audience: e.target.value })
              }
              placeholder="Contoh: Gen Z kere, bapak-bapak pecinta burung..."
              className="w-full rounded-xl border border-hairline bg-surface p-4 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
            />
          </div>

          {/* Tone */}
          <div className="space-y-3">
            <label className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Tone / Gaya Bahasa
            </label>
            <input
              type="text"
              required
              value={formData.tone}
              onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
              placeholder="Contoh: Sarkas, santai, medok jawa, ngegas..."
              className="w-full rounded-xl border border-hairline bg-surface p-4 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
            />
          </div>

          {/* Platforms */}
          <div className="space-y-3">
            <label className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Platform Utama
            </label>
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`rounded-lg border px-4 py-2 font-display text-sm font-semibold capitalize transition-colors ${
                    formData.platforms.includes(p)
                      ? "border-ember bg-ember/10 text-ember"
                      : "border-hairline bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Banned Words */}
          <div className="space-y-3">
            <label className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Kata Haram (Pisahin pakai koma)
            </label>
            <input
              type="text"
              value={formData.banned_words}
              onChange={(e) =>
                setFormData({ ...formData, banned_words: e.target.value })
              }
              placeholder="Contoh: Hallo guys, welcome back..."
              className="w-full rounded-xl border border-hairline bg-surface p-4 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
            />
          </div>

          {/* Brand Notes */}
          <div className="space-y-3">
            <label className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Catatan Khusus (Optional)
            </label>
            <textarea
              rows={3}
              value={formData.brand_notes}
              onChange={(e) =>
                setFormData({ ...formData, brand_notes: e.target.value })
              }
              placeholder="Ada pantangan lain? Atau hal yang wajib disebut di tiap video?"
              className="w-full resize-none rounded-xl border border-hairline bg-surface p-4 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger border border-danger/20">
              {error}
            </p>
          )}

          <div className="pt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full rounded-xl bg-ember px-5 py-4 font-display text-base font-bold text-obsidian transition-all duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo disabled:opacity-50 disabled:cursor-not-allowed ${
                isSubmitting ? "glow-ember" : ""
              }`}
            >
              {isSubmitting ? "Lagi ngebaca DNA lo..." : "Simpan & Lanjut (Cost: 2 Credit)"}
            </button>
            <p className="mt-4 text-center text-xs text-muted">
              Ini bakal motong 2 credit buat langsung dianalisa sama AI.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
