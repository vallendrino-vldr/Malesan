"use client";

import React, { useState } from "react";
import { readErrorBody, readSSE, stripFence } from "@/lib/sse";
import { saveToPipeline } from "@/app/actions/pipeline";
import { GenerationProgress } from "./GenerationProgress";
import { VoicePreview } from "./VoicePreview";

type AffiliateScene = {
  scene: number;
  duration: string;
  spoken: string;
  visual: string;
  on_screen_text: string;
};

type AffiliateVariant = {
  angle_name: string;
  hook_spoken: string;
  hook_visual: string;
  scenes: AffiliateScene[];
  cta_fomo: string;
  caption: string;
  hashtags: string[];
};

type AffiliateOutput = {
  product_name: string;
  key_appeal: string;
  variants: AffiliateVariant[];
};

export function AffiliateEngine({ cost = 3 }: { cost?: number }) {
  const [productName, setProductName] = useState("");
  const [sellingPoints, setSellingPoints] = useState("");
  const [style, setStyle] = useState("Campuran");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [chars, setChars] = useState(0);
  const [output, setOutput] = useState<AffiliateOutput | null>(null);
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);
  const [copied, setCopied] = useState("");
  const [savedToPipeline, setSavedToPipeline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) return;

    setBusy(true);
    setError(null);
    setOutput(null);
    setSavedToPipeline(false);
    setChars(0);
    setStatusMsg("Meracik 3 varian naskah affiliate...");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "affiliate",
          input: {
            product_name: productName,
            selling_points: sellingPoints,
            style: style,
          },
        }),
      });

      if (!res.ok) {
        const err = await readErrorBody(res, "Gagal meracik naskah affiliate.");
        throw new Error(err);
      }

      let acc = "";
      let streamError: string | null = null;

      await readSSE(res, (msg) => {
        if (typeof msg.error === "string") {
          streamError = msg.error;
          return true;
        }
        if (typeof msg.status === "string") setStatusMsg(msg.status);
        if (msg.done) {
          const g = msg.generation as { id?: string; output?: AffiliateOutput } | undefined;
          if (g?.output) setOutput(g.output);
          return true;
        }
        if (typeof msg.chunk === "string") {
          acc += msg.chunk;
          setChars(acc.length);
          try {
            setOutput(JSON.parse(stripFence(acc.trim())));
          } catch {
            /* streaming JSON partial */
          }
        }
      });

      if (streamError) throw new Error(streamError);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal meracik naskah affiliate.");
    } finally {
      setBusy(false);
      setStatusMsg("");
    }
  };

  const currentVariant = output?.variants?.[activeVariantIdx] || output?.variants?.[0];

  const buildVariantReadThrough = (v: AffiliateVariant) => {
    return [
      `[Hook] ${v.hook_spoken}`,
      ...v.scenes.map((s) => s.spoken),
      `[CTA] ${v.cta_fomo}`,
    ].join("\n\n");
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("gagal");
      setTimeout(() => setCopied(""), 2000);
    }
  };

  const handleSaveToPipeline = async () => {
    if (!output || !currentVariant) return;
    try {
      const scriptScenes = currentVariant.scenes.map((s) => ({
        timestamp: s.duration,
        spoken: s.spoken,
        visual: s.visual,
        on_screen_text: s.on_screen_text,
      }));

      await saveToPipeline(
        `[Affiliate] ${output.product_name} - ${currentVariant.angle_name}`,
        {
          generated_script: {
            hook: currentVariant.hook_spoken,
            scenes: scriptScenes,
            caption: currentVariant.caption,
            hashtags: currentVariant.hashtags,
          },
          content_pillar: "soft_selling",
          format: "Video Pendek Affiliate",
          est_duration: "30-60 detik",
        },
        undefined,
        "siap",
      );
      setSavedToPipeline(true);
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan ke alur Kanban.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="rounded-2xl border border-ember/30 bg-surface p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-ember/15 border border-ember/30 text-ember">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4.5">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-ink">
                Naskah Affiliate Video Pendek
              </h2>
              <p className="text-micro text-muted">
                Bikin 3 naskah video racun belanja berkonversi tinggi untuk TikTok Shop &amp; Shopee
              </p>
            </div>
          </div>
          <span className="rounded-md bg-surface-raised px-2.5 py-0.5 font-mono text-micro font-bold text-ember border border-hairline">
            {cost} kredit
          </span>
        </div>

        {/* Input Form */}
        <form onSubmit={handleGenerate} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-micro font-bold text-muted uppercase tracking-wider mb-1">
              Nama Produk &amp; Kategori
            </label>
            <input
              type="text"
              required
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Contoh: Mic Wireless Clip-On K8 Anti Bising"
              className="w-full rounded-xl border border-hairline bg-obsidian px-3.5 py-2.5 text-xs text-ink placeholder:text-muted/40 focus:border-ember focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-micro font-bold text-muted uppercase tracking-wider mb-1">
              Keunggulan Utama / Harga Promo (Spill Racun)
            </label>
            <textarea
              rows={2}
              value={sellingPoints}
              onChange={(e) => setSellingPoints(e.target.value)}
              placeholder="Contoh: Cuma 39 ribuan, batre awet 10 jam, suara jernih tanpa noise, colok langsung nyala"
              className="w-full rounded-xl border border-hairline bg-obsidian p-3 text-xs leading-relaxed text-ink placeholder:text-muted/40 focus:border-ember focus:outline-none resize-y"
            />
          </div>

          <div>
            <label className="block text-micro font-bold text-muted uppercase tracking-wider mb-1.5">
              Gaya Pendekatan
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "Campuran", label: "3 Varian Campuran" },
                { id: "Problem-Solution", label: "Keresahan & Solusi" },
                { id: "Flash-Sale-FOMO", label: "Promo & Keranjang Kuning" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStyle(opt.id)}
                  className={`rounded-xl border py-2 px-2 text-center text-xs font-semibold transition-all ${
                    style === opt.id
                      ? "border-ember bg-ember/15 text-ember shadow-xs font-bold"
                      : "border-hairline bg-surface-raised text-muted hover:text-ink"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={busy || !productName.trim()}
            className="btn-ember mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 font-display text-sm font-bold text-obsidian shadow-md transition-transform active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? "Meracik Naskah Jualan..." : `Racik 3 Naskah Affiliate · ${cost} kredit`}
          </button>
        </form>
      </div>

      {busy && (
        <GenerationProgress
          moduleKey="affiliate"
          chars={chars}
          label="Lagi meracik 3 naskah affiliate"
          status={statusMsg}
        />
      )}

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          {error}
        </div>
      )}

      {/* Output Display */}
      {output && currentVariant && (
        <div className="surface-card rounded-2xl border border-hairline p-4 sm:p-5 space-y-4 shadow-sm">
          {/* Variant Tab Switcher */}
          <div className="flex items-center justify-between gap-2 border-b border-hairline pb-3">
            <span className="eyebrow text-ember font-bold">Pilih Varian Naskah:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {output.variants.map((v, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveVariantIdx(idx);
                    setSavedToPipeline(false);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                    activeVariantIdx === idx
                      ? "border-ember bg-ember text-obsidian font-bold shadow-xs"
                      : "border-hairline bg-surface-raised text-muted hover:text-ink"
                  }`}
                >
                  Varian #{idx + 1}: {v.angle_name.split("/")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Hook Box */}
          <div className="rounded-xl border border-ember/40 bg-ember/5 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 eyebrow text-ember font-bold">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                <span>Hook Pembuka (0-3 Detik Pertama)</span>
              </div>
              <span className="text-[10px] font-mono text-muted">Daya Henti FYP</span>
            </div>
            <p className="font-display text-sm font-bold text-ink">
              &ldquo;{currentVariant.hook_spoken}&rdquo;
            </p>
            <p className="text-micro text-muted">
              <strong className="text-ink/80">Arahan Visual:</strong> {currentVariant.hook_visual}
            </p>
          </div>

          {/* Scenes Breakdown */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 eyebrow text-muted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5"><rect width="20" height="20" x="2" y="2" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
              <span>Alur Scene Naskah:</span>
            </div>
            <div className="space-y-2">
              {currentVariant.scenes.map((s) => (
                <div
                  key={s.scene}
                  className="rounded-xl border border-hairline bg-surface-raised p-3 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-micro text-muted">
                    <span className="font-bold text-ember">Scene #{s.scene}</span>
                    <span className="font-mono">{s.duration}</span>
                  </div>
                  <p className="text-ink leading-relaxed">
                    <strong className="text-muted">Voiceover:</strong> {s.spoken}
                  </p>
                  <div className="flex flex-wrap gap-2 text-micro text-muted border-t border-hairline/60 pt-1">
                    <span>
                      <strong className="text-ink/70">Visual:</strong> {s.visual}
                    </span>
                    {s.on_screen_text && (
                      <span>
                        • <strong className="text-ember">Teks Layar:</strong> &ldquo;{s.on_screen_text}&rdquo;
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Keranjang Kuning */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 eyebrow text-emerald-400 font-bold">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                <span>Call to Action (Keranjang Kuning)</span>
              </div>
            </div>
            <p className="text-xs font-semibold text-emerald-300">
              &ldquo;{currentVariant.cta_fomo}&rdquo;
            </p>
          </div>

          {/* Audio Rehearsal / Voice Preview */}
          <VoicePreview
            text={buildVariantReadThrough(currentVariant)}
            title={`Naskah Affiliate ${output.product_name}`}
          />

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-hairline">
            <button
              type="button"
              onClick={() => handleCopy(buildVariantReadThrough(currentVariant), "full")}
              className="flex-1 cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl border border-hairline bg-surface-raised px-4 h-11 sm:h-10 text-xs font-semibold text-ink transition-colors hover:border-ember/40 hover:text-ember active:scale-[0.99]"
            >
              {copied === "full" ? (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 text-emerald-400">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Tersalin ke Clipboard!</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Salin Naskah</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={savedToPipeline}
              onClick={handleSaveToPipeline}
              className={`flex-1 cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl px-4 h-11 sm:h-10 text-xs font-bold transition-all active:scale-[0.99] ${
                savedToPipeline
                  ? "border border-success/30 bg-success/15 text-success"
                  : "border border-ember/40 bg-ember/15 text-ember hover:bg-ember hover:text-obsidian"
              }`}
            >
              {savedToPipeline ? (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Tersimpan di Alur Kanban</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 3v18M15 3v18" />
                  </svg>
                  <span>Simpan ke Alur Kanban</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
