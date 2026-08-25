"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { PipelineCard } from "@/lib/supabase/database.types";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;
import {
  updateCardStatus,
  updateCardContentAndStatus,
  deletePipelineCard,
} from "@/app/actions/pipeline";
import { todayPlatformLabel, normalizeTodayPlatform } from "@/lib/content-options";
import { completeStudioProcessing } from "./studio/AIProcessingOverlay";
import { NetizenSimulatorModal } from "./NetizenSimulatorModal";
import { ScriptFullViewModal } from "./ScriptFullViewModal";
import { haptic } from "@/lib/haptics";

type Column = "ide" | "draft" | "siap" | "posted";

interface PipelineCardModalProps {
  card: PipelineCard | null;
  isOpen: boolean;
  onClose: () => void;
  onCardUpdated: (updatedCard: PipelineCard) => void;
  onCardDeleted: (cardId: string) => void;
}

type HookOutput = {
  hooks?: Array<{ hook?: string; text?: string; score?: number; type?: string }>;
};

type Scene = {
  scene?: number;
  duration?: string;
  voiceover?: string;
  visual?: string;
  overlay_text?: string;
};

type ScriptOutput = {
  hook?: string;
  scenes?: Scene[];
  caption?: string;
  hashtags?: string[];
};

export function PipelineCardModal({
  card,
  isOpen,
  onClose,
  onCardUpdated,
  onCardDeleted,
}: PipelineCardModalProps) {
  const isMounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"detail" | "rubric">("detail");
  const [pickedHookIndex, setPickedHookIndex] = useState<number>(0);
  const [showNetizenSimulator, setShowNetizenSimulator] = useState(false);
  const [showFullViewScript, setShowFullViewScript] = useState(false);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !card || !isMounted) return null;

  const content = card.content as Record<string, unknown> | null;
  const status = card.status as Column;
  const aiScore = card.ai_score ?? (typeof content?.ai_score === "number" ? content.ai_score : undefined);
  const breakdown = content?.score_breakdown as
    | {
        pattern?: number;
        curiosity?: number;
        pain?: number;
        specificity?: number;
        emotion?: number;
      }
    | undefined;
  const scoreReason = typeof content?.score_reason === "string" ? content.score_reason : undefined;

  const pillar = typeof content?.content_pillar === "string" ? content.content_pillar : undefined;
  const pillarLabel =
    pillar === "edukasi"
      ? "Edukasi & Otoritas"
      : pillar === "storytelling"
        ? "Storytelling & Relate"
        : pillar === "engagement"
          ? "Diskusi & Interaksi"
          : pillar === "soft_selling"
            ? "Soft Selling & Solusi"
            : null;

  const rawHooks = (content?.generated_hook as HookOutput | undefined)?.hooks ?? [];
  const hookList = rawHooks
    .map((h) => ({
      text: h.hook || h.text || "",
      score: h.score ?? 0,
      type: h.type || "",
    }))
    .filter((h) => Boolean(h.text));

  const generatedScript = content?.generated_script as ScriptOutput | undefined;

  const handleGenerateHook = async () => {
    haptic.impact();
    setIsGenerating(true);
    setError("");
    setGeneratingLabel("Meracik 10 opsi hook tajam...");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature: "hook",
          topic: card.title,
          angle: content?.angle,
          platform: content?.platform,
          why_now: content?.why_now,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Gagal membuat hook.");
      }

      const json = await res.json();
      const newContent = {
        ...content,
        generated_hook: json.data || json,
        chosen_hook: 0,
      };

      const updated = await updateCardContentAndStatus(card.id, newContent, "draft");
      haptic.success();
      onCardUpdated(updated);
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : "Ada kendala saat membuat hook.");
    } finally {
      setIsGenerating(false);
      setGeneratingLabel("");
      completeStudioProcessing();
    }
  };

  const handlePickHook = async (index: number) => {
    haptic.selection();
    setPickedHookIndex(index);
    const newContent = {
      ...content,
      chosen_hook: index,
    };
    try {
      const updated = await updateCardContentAndStatus(card.id, newContent, status);
      onCardUpdated(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateScript = async () => {
    haptic.impact();
    setIsGenerating(true);
    setError("");
    setGeneratingLabel("Menyusun naskah scene-by-scene...");

    try {
      const chosenText = hookList[pickedHookIndex]?.text || card.title;
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature: "script",
          topic: card.title,
          hook: chosenText,
          angle: content?.angle,
          format: content?.format,
          platform: content?.platform,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Gagal membuat naskah.");
      }

      const json = await res.json();
      const newContent = {
        ...content,
        generated_script: json.data || json,
      };

      const updated = await updateCardContentAndStatus(card.id, newContent, "siap");
      haptic.success();
      onCardUpdated(updated);
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : "Ada kendala saat membuat naskah.");
    } finally {
      setIsGenerating(false);
      setGeneratingLabel("");
      completeStudioProcessing();
    }
  };

  const handleMarkAsPosted = async () => {
    haptic.success();
    try {
      const updated = await updateCardStatus(card.id, "posted");
      onCardUpdated(updated);
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : "Gagal mengubah status.");
    }
  };

  const handleChangeSchedule = async (newDate: string | null, newTime: string | null) => {
    haptic.selection();
    try {
      const dateVal = newDate ? newDate : null;
      const timeVal = newTime ? newTime : null;
      const { updateCardSchedule } = await import("@/app/actions/pipeline");
      const updated = await updateCardSchedule(card.id, dateVal, timeVal);
      onCardUpdated(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    haptic.warning();
    setIsDeleting(true);
    try {
      await deletePipelineCard(card.id);
      onCardDeleted(card.id);
      onClose();
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : "Gagal menghapus kartu.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const modalContent = (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
        className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 animate-fade-in"
      >
        {/* Backdrop */}
        <div
          onClick={onClose}
          className="fixed inset-0 bg-obsidian/85 backdrop-blur-xs transition-opacity"
        />

      {/* Main Modal Card */}
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-hairline/80 p-4 sm:p-5">
          <div className="min-w-0 flex-1 pr-3">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {/* Status Badge */}
              <span
                className={`rounded-md px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider ${
                  status === "siap"
                    ? "bg-success/15 text-success border border-success/30"
                    : status === "draft"
                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                      : status === "posted"
                        ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                        : "bg-surface-raised text-muted border border-hairline"
                }`}
              >
                Tahap: {status}
              </span>

              {/* Pillar Badge */}
              {Boolean(pillarLabel) && (
                <span className="rounded-md border border-hairline bg-surface-raised px-2 py-0.5 text-[10px] font-medium text-ink/80">
                  {pillarLabel}
                </span>
              )}

              {/* Platform */}
              {Boolean(content?.platform) && (
                <span className="rounded-md border border-hairline bg-surface-raised px-2 py-0.5 text-[10px] text-muted">
                  {todayPlatformLabel(normalizeTodayPlatform(String(content?.platform)))}
                </span>
              )}

              {/* AI Score Badge */}
              {Boolean(aiScore) && (
                <span className="inline-flex items-center gap-1 rounded-md border border-ember/30 bg-ember/10 px-2 py-0.5 font-mono text-[10px] font-bold text-ember">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-2.5 text-ember">
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z" />
                  </svg>
                  Potensi {aiScore}/100
                </span>
              )}
            </div>

            <h3 id="card-modal-title" className="font-display text-base font-bold text-ink sm:text-lg">
              {card.title}
            </h3>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowDeleteConfirm((v) => !v)}
              aria-label="Hapus kartu"
              title="Hapus kartu ini"
              className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
            <button
              onClick={onClose}
              aria-label="Tutup modal"
              className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Delete Confirmation Banner */}
        {showDeleteConfirm && (
          <div className="flex items-center justify-between border-b border-danger/30 bg-danger/10 px-4 py-2.5 text-xs text-danger">
            <span>Hapus kartu ini dari alur kerja?</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="font-medium text-muted hover:text-ink"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded bg-danger px-2.5 py-1 font-bold text-obsidian hover:opacity-90 disabled:opacity-50"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        )}

        {/* Tab Switcher (Detail Strategi vs Analisis AI) */}
        <div className="flex border-b border-hairline/60 bg-surface-raised/40 px-4">
          <button
            onClick={() => setActiveTab("detail")}
            className={`border-b-2 px-3 py-2.5 font-display text-xs font-semibold transition-colors ${
              activeTab === "detail"
                ? "border-ember text-ember"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Konten & Eksekusi
          </button>
          {Boolean(breakdown) && (
            <button
              onClick={() => setActiveTab("rubric")}
              className={`border-b-2 px-3 py-2.5 font-display text-xs font-semibold transition-colors ${
                activeTab === "rubric"
                  ? "border-ember text-ember"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              Analisis Potensi AI ({aiScore ?? "-"})
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {error && (
            <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
              {error}
            </div>
          )}

          {activeTab === "rubric" && breakdown ? (
            <div className="space-y-4">
              {Boolean(scoreReason) && (
                <div className="rounded-xl border border-hairline bg-surface-raised p-3.5">
                  <p className="eyebrow mb-1 text-ember">Alasan Sudut Pandang Ini Menang:</p>
                  <p className="text-xs leading-relaxed text-ink/90">&ldquo;{scoreReason}&rdquo;</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="rounded-xl border border-hairline bg-surface-raised p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">Daya Henti (Pattern Interrupt)</span>
                    <span className="font-mono text-xs font-bold text-ember">{breakdown.pattern ?? "-"}/25</span>
                  </div>
                  <p className="mt-1 text-micro text-muted">Kekuatan menahan jempol scrolling di 3 detik pertama.</p>
                </div>

                <div className="rounded-xl border border-hairline bg-surface-raised p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">Penasaran (Curiosity Gap)</span>
                    <span className="font-mono text-xs font-bold text-ember">{breakdown.curiosity ?? "-"}/20</span>
                  </div>
                  <p className="mt-1 text-micro text-muted">Memicu rasa ingin tahu tanpa clickbait murahan.</p>
                </div>

                <div className="rounded-xl border border-hairline bg-surface-raised p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">Masalah Audiens (Pain Match)</span>
                    <span className="font-mono text-xs font-bold text-ember">{breakdown.pain ?? "-"}/20</span>
                  </div>
                  <p className="mt-1 text-micro text-muted">Keselarasan langsung dengan keresahan target audiens.</p>
                </div>

                <div className="rounded-xl border border-hairline bg-surface-raised p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">Spesifik & Konkret</span>
                    <span className="font-mono text-xs font-bold text-ember">{breakdown.specificity ?? "-"}/20</span>
                  </div>
                  <p className="mt-1 text-micro text-muted">Memakai angka, perbandingan, atau objek yang nyata.</p>
                </div>

                <div className="rounded-xl border border-hairline bg-surface-raised p-3 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">Resonansi Emosi</span>
                    <span className="font-mono text-xs font-bold text-ember">{breakdown.emotion ?? "-"}/15</span>
                  </div>
                  <p className="mt-1 text-micro text-muted">Menyentuh perasaan relate, tawa, atau validasi audiens.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Strategic Metadata Grid */}
              <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-hairline bg-surface-raised p-3.5 sm:grid-cols-2">
                {content?.angle ? (
                  <div className="sm:col-span-2">
                    <span className="eyebrow text-muted">Sudut Pandang (Angle):</span>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink">{String(content.angle)}</p>
                  </div>
                ) : null}

                {content?.why_now ? (
                  <div className="sm:col-span-2 border-t border-hairline/60 pt-2">
                    <span className="eyebrow text-muted">Kenapa Harus Sekarang (Why Now):</span>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink">{String(content.why_now)}</p>
                  </div>
                ) : null}

                {content?.format ? (
                  <div className="border-t border-hairline/60 pt-2">
                    <span className="eyebrow text-muted">Format Konten:</span>
                    <p className="mt-0.5 text-xs font-medium text-ink">{String(content.format)}</p>
                  </div>
                ) : null}

                {content?.est_duration ? (
                  <div className="border-t border-hairline/60 pt-2">
                    <span className="eyebrow text-muted">Estimasi Durasi:</span>
                    <p className="mt-0.5 text-xs font-medium text-ink">{String(content.est_duration)}</p>
                  </div>
                ) : null}
              </div>

              {/* Action Stage 1: Generate Hook (If status is ide or no hook) */}
              {hookList.length === 0 && status === "ide" && (
                <div className="rounded-xl border border-ember/30 bg-ember/[0.03] p-4 text-center">
                  <p className="font-display text-xs font-bold text-ink">Langkah 1: Racik Hook Pembuka</p>
                  <p className="mt-1 text-micro text-muted">
                    Hook adalah 3 detik penentu apakah penonton bakal lanjut nonton atau scroll.
                  </p>
                  <button
                    onClick={handleGenerateHook}
                    disabled={isGenerating}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-ember px-4 py-2 font-display text-xs font-bold text-obsidian shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
                    </svg>
                    <span>{isGenerating ? generatingLabel : "Bikin Hook · 2 kredit"}</span>
                  </button>
                </div>
              )}

              {/* Action Stage 2: Hook Selection & Generate Script */}
              {hookList.length > 0 && (
                <div className="space-y-3 rounded-xl border border-hairline bg-surface-raised p-4">
                  <div className="flex items-center justify-between">
                    <span className="eyebrow text-ember">Pilihan Hook ({hookList.length} opsi):</span>
                    <span className="text-micro text-muted">Pilih satu untuk jadi acuan naskah</span>
                  </div>

                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {hookList.map((h, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePickHook(idx)}
                        className={`w-full rounded-lg border p-2.5 text-left text-xs transition-colors ${
                          idx === pickedHookIndex
                            ? "border-ember/60 bg-ember/15 text-ink font-semibold"
                            : "border-hairline bg-surface text-muted hover:text-ink"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between text-[10px]">
                          <span className="text-ember font-bold">Opsi #{idx + 1} {h.type ? `· ${h.type}` : ""}</span>
                          {h.score > 0 && <span className="font-mono text-muted">Skor: {h.score}</span>}
                        </div>
                        <p>{h.text}</p>
                      </button>
                    ))}
                  </div>

                  {!generatedScript && (
                    <div className="border-t border-hairline/60 pt-3 text-center">
                      <button
                        onClick={handleGenerateScript}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-ember px-4 py-2 font-display text-xs font-bold text-obsidian shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        <span>{isGenerating ? generatingLabel : "Bikin Script · 3 kredit"}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Action Stage 3: Script Teleprompter / Viewer */}
              {generatedScript && (
                <div className="space-y-3 rounded-xl border border-hairline bg-surface-raised p-4">
                  <div className="flex items-center justify-between">
                    <span className="eyebrow text-success">Naskah Video Siap Syuting:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowFullViewScript(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-ember/40 bg-ember/15 px-2.5 py-1 text-[11px] font-bold text-ember transition-colors hover:bg-ember/25 cursor-pointer active:scale-95"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="size-3 shrink-0"
                          aria-hidden="true"
                        >
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                        </svg>
                        <span>Layar Penuh</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNetizenSimulator(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-ink transition-colors hover:bg-white/10 cursor-pointer active:scale-95"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="size-3 shrink-0"
                          aria-hidden="true"
                        >
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span>Simulasi Netizen</span>
                      </button>
                      <span className="text-micro text-muted">
                        {generatedScript.scenes?.length ?? 0} Scene
                      </span>
                    </div>
                  </div>

                  <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                    {(generatedScript.scenes ?? []).map((sc, i) => (
                      <div key={i} className="rounded-lg border border-hairline bg-surface p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-muted">
                          <span className="font-bold text-ink">Scene #{sc.scene ?? i + 1}</span>
                          {sc.duration && <span className="font-mono">{sc.duration}</span>}
                        </div>
                        {sc.voiceover && (
                          <div>
                            <span className="text-micro text-ember font-semibold">Voiceover:</span>
                            <p className="text-ink leading-relaxed">{sc.voiceover}</p>
                          </div>
                        )}
                        {sc.visual && (
                          <div className="border-t border-hairline/40 pt-1 text-micro text-muted">
                            <span className="font-medium text-ink/70">Arahan Visual:</span> {sc.visual}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {status !== "posted" && (
                    <div className="border-t border-hairline/60 pt-3 flex justify-end">
                      <button
                        onClick={handleMarkAsPosted}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/15 px-3.5 py-1.5 font-display text-xs font-bold text-success transition-colors hover:bg-success/25"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Tandai Sudah Tayang di Medsos</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer: Precise Schedule Date & Time + Close */}
        <div className="border-t border-hairline/80 bg-surface-raised/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-micro font-bold text-muted">📅 Tanggal:</span>
                <input
                  type="date"
                  value={card.scheduled_date || ""}
                  onChange={(e) => handleChangeSchedule(e.target.value, card.scheduled_time || "19:30")}
                  className="rounded-lg border border-hairline bg-surface px-2.5 py-1 text-xs text-ink focus:border-ember focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-micro font-bold text-muted">⏰ Jam Posting:</span>
                <input
                  type="time"
                  value={card.scheduled_time || "19:30"}
                  onChange={(e) => handleChangeSchedule(card.scheduled_date || new Date().toISOString().split("T")[0], e.target.value)}
                  className="rounded-lg border border-hairline bg-surface px-2.5 py-1 text-xs font-mono font-bold text-ink focus:border-ember focus:outline-hidden"
                />
              </div>

              {card.scheduled_date && (
                <button
                  type="button"
                  onClick={() => handleChangeSchedule(null, null)}
                  className="text-[11px] text-muted hover:text-danger underline decoration-dotted"
                  title="Hapus dari jadwal"
                >
                  Lepas Jadwal
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-surface-raised px-4 py-2 text-xs font-semibold text-ink border border-hairline hover:bg-surface"
            >
              Tutup
            </button>
          </div>

          {/* Quick Time Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/[0.04]">
            <span className="text-[10px] text-muted font-medium">Preset Cepat:</span>
            {[
              { label: "☀️ 12:00 Siang", time: "12:00" },
              { label: "🌇 17:00 Sore", time: "17:00" },
              { label: "🔥 19:30 Prime Time", time: "19:30" },
              { label: "🌙 21:00 Malam", time: "21:00" },
            ].map((preset) => (
              <button
                key={preset.time}
                type="button"
                onClick={() => {
                  const today = card.scheduled_date || new Date().toISOString().split("T")[0];
                  handleChangeSchedule(today, preset.time);
                }}
                className={`rounded-md px-2 py-0.5 text-[10px] font-mono transition-colors ${
                  card.scheduled_time === preset.time
                    ? "bg-ember/20 text-ember border border-ember/40 font-bold"
                    : "bg-surface text-muted hover:text-ink border border-hairline"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Netizen Reaction Simulator Modal */}
    <NetizenSimulatorModal
      isOpen={showNetizenSimulator}
      onClose={() => setShowNetizenSimulator(false)}
      title={card.title}
      platform={String(content?.platform || "TikTok / Reels")}
      scriptContent={JSON.stringify(generatedScript || "")}
    />

    {/* Full View Studio Reader & Teleprompter Modal */}
    {generatedScript && (
      <ScriptFullViewModal
        isOpen={showFullViewScript}
        onClose={() => setShowFullViewScript(false)}
        title={card.title}
        platform={String(content?.platform || "TikTok / Reels")}
        script={generatedScript}
      />
    )}
  </>
  );

  return createPortal(modalContent, document.body);
}
