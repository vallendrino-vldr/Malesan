"use client";

import React, { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export interface NetizenComment {
  id: string;
  name: string;
  handle: string;
  avatarColor: string;
  badge: {
    label: string;
    bg: string;
    text: string;
    icon: string;
  };
  comment: string;
  likes: number;
  timeAgo: string;
  isLiked?: boolean;
}

interface NetizenSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  scriptContent?: string;
  platform?: string;
}

const ARCHETYPE_META: Record<
  string,
  {
    name: string;
    handle: string;
    avatarColor: string;
    badge: { label: string; bg: string; text: string; icon: string };
  }
> = {
  skeptis: {
    name: "Bayu Antiklaim",
    handle: "@bayu_analis99",
    avatarColor: "from-amber-500 to-red-600",
    badge: { label: "Skeptis / Debat", bg: "bg-red-500/10 border-red-500/30", text: "text-red-400", icon: "🧐" },
  },
  fomo: {
    name: "Siska Racun TikTok",
    handle: "@siska_checkout_terus",
    avatarColor: "from-pink-500 to-rose-600",
    badge: { label: "FOMO / Emosi", bg: "bg-pink-500/10 border-pink-500/30", text: "text-pink-400", icon: "😍" },
  },
  receh: {
    name: "Rian Kaum Rebahan",
    handle: "@rian_saldo_tipis",
    avatarColor: "from-purple-500 to-indigo-600",
    badge: { label: "Top Komen Receh", bg: "bg-purple-500/10 border-purple-500/30", text: "text-purple-400", icon: "😂" },
  },
  detail: {
    name: "Dimas Detail Police",
    handle: "@dimas_pakar_dadakan",
    avatarColor: "from-blue-500 to-cyan-600",
    badge: { label: "Detail Police", bg: "bg-blue-500/10 border-blue-500/30", text: "text-blue-400", icon: "🤓" },
  },
  relate: {
    name: "Nadia Relate Parah",
    handle: "@nadiacurhat_id",
    avatarColor: "from-emerald-500 to-teal-600",
    badge: { label: "Curhat Relate", bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400", icon: "🤍" },
  },
  promo: {
    name: "Farhan Cari Solusi",
    handle: "@farhan_tips_id",
    avatarColor: "from-amber-400 to-orange-500",
    badge: { label: "Pemburu Solusi", bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400", icon: "💡" },
  },
};

const PERSONA_PREVIEWS = [
  { icon: "🧐", label: "Skeptis", name: "@bayu_analis99" },
  { icon: "😍", label: "FOMO", name: "@siska_checkout_terus" },
  { icon: "😂", label: "Receh", name: "@rian_saldo_tipis" },
  { icon: "🤓", label: "Detail", name: "@dimas_pakar_dadakan" },
  { icon: "🤍", label: "Relate", name: "@nadiacurhat_id" },
  { icon: "💡", label: "Solusi", name: "@farhan_tips_id" },
];

export function NetizenSimulatorModal({
  isOpen,
  onClose,
  title,
  scriptContent,
  platform = "TikTok / Reels",
}: NetizenSimulatorModalProps) {
  const isMounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<NetizenComment[]>([]);
  const [potensiViral, setPotensiViral] = useState("");
  const [dayaDebat, setDayaDebat] = useState("");
  const [rasioKonversi, setRasioKonversi] = useState("");
  const [suggestedPinnedComment, setSuggestedPinnedComment] = useState("");
  const [copiedPinned, setCopiedPinned] = useState(false);
  const [likedComments, setLikedComments] = useState<Record<string, boolean>>({});

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

  // Fetch real AI-generated netizen reactions
  const fetchNetizenReactions = useCallback(async () => {
    if (!title && !scriptContent) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/pipeline/simulate-netizen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          scriptContent,
          platform,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memuat simulasi netizen.");
      }

      setPotensiViral(data.potensiViral || "8.8 / 10 (Tinggi)");
      setDayaDebat(data.dayaDebat || "8.2 / 10 (Aktif)");
      setRasioKonversi(data.rasioKonversi || "Tinggi (Relate)");
      setSuggestedPinnedComment(
        data.suggestedPinnedComment ||
          `Menurut kalian dari pembahasan "${title || "video ini"}", mana yang paling relate? Drop di kolom komentar ya! 👇`
      );

      if (Array.isArray(data.comments)) {
        const mapped: NetizenComment[] = data.comments.map(
          (
            c: {
              type?: string;
              name?: string;
              handle?: string;
              badgeLabel?: string;
              comment: string;
              likes?: number;
              timeAgo?: string;
            },
            idx: number
          ) => {
            const rawType = (c.type || "relate").toLowerCase();
            const meta = ARCHETYPE_META[rawType] || ARCHETYPE_META.relate;
            return {
              id: `comment-${idx}-${Date.now()}`,
              name: c.name || meta.name,
              handle: c.handle || meta.handle,
              avatarColor: meta.avatarColor,
              badge: {
                ...meta.badge,
                label: c.badgeLabel || meta.badge.label,
              },
              comment: c.comment,
              likes: c.likes ?? 80 + Math.floor(Math.random() * 250),
              timeAgo: c.timeAgo || `${(idx + 1) * 7}m`,
            };
          }
        );
        setComments(mapped);
      }
    } catch (err) {
      console.error("Netizen simulator fetch error:", err);
      setError(err instanceof Error ? err.message : "Gagal memuat respon netizen.");
    } finally {
      setIsLoading(false);
    }
  }, [title, scriptContent, platform]);

  // Load automatically on modal open if no comments yet
  useEffect(() => {
    if (!isOpen || comments.length > 0) return;
    let isCurrent = true;

    async function loadInitial() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/pipeline/simulate-netizen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, scriptContent, platform }),
        });
        const data = await res.json();
        if (!isCurrent) return;
        if (!res.ok) throw new Error(data.error || "Gagal memuat simulasi netizen.");

        setPotensiViral(data.potensiViral || "8.8 / 10 (Tinggi)");
        setDayaDebat(data.dayaDebat || "8.2 / 10 (Aktif)");
        setRasioKonversi(data.rasioKonversi || "Tinggi (Relate)");
        setSuggestedPinnedComment(
          data.suggestedPinnedComment ||
            `Menurut kalian dari pembahasan "${title || "video ini"}", mana yang paling relate? Drop di kolom komentar ya! 👇`
        );

        if (Array.isArray(data.comments)) {
          const mapped: NetizenComment[] = data.comments.map(
            (
              c: {
                type?: string;
                name?: string;
                handle?: string;
                badgeLabel?: string;
                comment: string;
                likes?: number;
                timeAgo?: string;
              },
              idx: number
            ) => {
              const rawType = (c.type || "relate").toLowerCase();
              const meta = ARCHETYPE_META[rawType] || ARCHETYPE_META.relate;
              return {
                id: `comment-${idx}-${Date.now()}`,
                name: c.name || meta.name,
                handle: c.handle || meta.handle,
                avatarColor: meta.avatarColor,
                badge: {
                  ...meta.badge,
                  label: c.badgeLabel || meta.badge.label,
                },
                comment: c.comment,
                likes: c.likes ?? 80 + Math.floor(Math.random() * 250),
                timeAgo: c.timeAgo || `${(idx + 1) * 7}m`,
              };
            }
          );
          setComments(mapped);
        }
      } catch (err) {
        if (!isCurrent) return;
        console.error("Netizen simulator fetch error:", err);
        setError(err instanceof Error ? err.message : "Gagal memuat respon netizen.");
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadInitial();
    return () => {
      isCurrent = false;
    };
  }, [isOpen, comments.length, title, scriptContent, platform]);

  const handleCopyPinned = useCallback(() => {
    if (!suggestedPinnedComment) return;
    navigator.clipboard.writeText(suggestedPinnedComment);
    setCopiedPinned(true);
    setTimeout(() => setCopiedPinned(false), 2000);
  }, [suggestedPinnedComment]);

  const handleToggleLike = (id: string) => {
    setLikedComments((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (!isOpen || !isMounted) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="netizen-simulator-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      {/* Backdrop Click to Close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Modal Container */}
      <div className="relative w-full max-w-lg rounded-2xl border border-hairline/80 bg-[#0d0d0d] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-scale-up">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-hairline/60 bg-surface/80 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 items-center justify-center rounded-lg bg-ember/15 text-ember text-sm font-bold border border-ember/30 shrink-0">
              💬
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="netizen-simulator-title" className="text-sm font-bold text-ink">
                  Simulasi Respon Netizen
                </h3>
                <span className="rounded-full bg-ember/15 border border-ember/30 px-2 py-0.2 text-[10px] font-semibold text-ember flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-ember animate-pulse" />
                  AI Real-Time
                </span>
              </div>
              <p className="text-[11px] text-muted truncate max-w-[240px] sm:max-w-sm">
                Naskah: {title || "Naskah Siap"} ({platform})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-white/10 hover:text-ink transition-colors cursor-pointer shrink-0"
            aria-label="Tutup Modal"
          >
            ✕
          </button>
        </div>

        {/* Engagement Health & Sentiment Ticker */}
        <div className="grid grid-cols-3 gap-2 border-b border-hairline/40 bg-surface/30 px-4 py-2 sm:px-5 text-center text-[11px]">
          <div className="rounded-lg bg-white/[0.03] p-1.5 border border-white/[0.04] min-h-[46px] flex flex-col justify-center">
            <div className="text-[10px] text-muted">🔥 Potensi Viral</div>
            {isLoading && !potensiViral ? (
              <div className="h-3.5 w-16 bg-white/[0.08] rounded animate-pulse mx-auto mt-1" />
            ) : (
              <div className="font-bold text-emerald-400 truncate">{potensiViral || "8.8 / 10 (Tinggi)"}</div>
            )}
          </div>
          <div className="rounded-lg bg-white/[0.03] p-1.5 border border-white/[0.04] min-h-[46px] flex flex-col justify-center">
            <div className="text-[10px] text-muted">⚡ Daya Debat</div>
            {isLoading && !dayaDebat ? (
              <div className="h-3.5 w-16 bg-white/[0.08] rounded animate-pulse mx-auto mt-1" />
            ) : (
              <div className="font-bold text-ember truncate">{dayaDebat || "8.0 / 10 (Aktif)"}</div>
            )}
          </div>
          <div className="rounded-lg bg-white/[0.03] p-1.5 border border-white/[0.04] min-h-[46px] flex flex-col justify-center">
            <div className="text-[10px] text-muted">🎯 Rasio Konversi</div>
            {isLoading && !rasioKonversi ? (
              <div className="h-3.5 w-20 bg-white/[0.08] rounded animate-pulse mx-auto mt-1" />
            ) : (
              <div className="font-bold text-sky-400 truncate">{rasioKonversi || "Tinggi (Relate)"}</div>
            )}
          </div>
        </div>

        {/* Scrollable Comments Feed / Loading Skeleton */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 divide-y divide-hairline/30 custom-scrollbar">
          {isLoading ? (
            <div className="space-y-4">
              {/* Studio AI Engine Pulse Indicator */}
              <div className="rounded-xl border border-ember/25 bg-gradient-to-br from-ember/10 via-ember/5 to-transparent p-3 sm:p-3.5 relative overflow-hidden">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-ember/20 text-ember text-sm shrink-0 animate-pulse">
                    ⚡
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <span>Membaca naskah & meracik 6 karakter netizen...</span>
                    </div>
                    <p className="text-[10px] text-muted">
                      Menganalisis topik &ldquo;{title || "konten lo"}&rdquo; secara mendalam
                    </p>
                  </div>
                </div>

                {/* Animated Persona Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PERSONA_PREVIEWS.map((p, idx) => (
                    <div
                      key={p.name}
                      style={{ animationDelay: `${idx * 150}ms` }}
                      className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 text-[10px] text-ink/80 animate-pulse"
                    >
                      <span>{p.icon}</span>
                      <span className="font-medium">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Realistic Feed Skeleton Rows */}
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="pt-3.5 first:pt-0 flex gap-3 items-start animate-pulse">
                  {/* Avatar Skeleton */}
                  <div className="size-8 rounded-full bg-white/[0.08] shrink-0" />

                  {/* Body Skeleton */}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="h-3.5 w-24 rounded bg-white/[0.1]" />
                      <div className="h-3 w-16 rounded bg-white/[0.05]" />
                      <div className="h-3.5 w-20 rounded bg-ember/15" />
                    </div>
                    <div
                      className={`h-3 rounded bg-white/[0.08] ${
                        i % 2 === 0 ? "w-[92%]" : "w-[84%]"
                      }`}
                    />
                    <div
                      className={`h-3 rounded bg-white/[0.05] ${
                        i % 2 === 0 ? "w-[68%]" : "w-[75%]"
                      }`}
                    />
                    <div className="flex items-center gap-3 pt-0.5">
                      <div className="h-2.5 w-8 rounded bg-white/[0.05]" />
                      <div className="h-2.5 w-10 rounded bg-white/[0.04]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error && comments.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-xs text-danger">{error}</p>
              <button
                onClick={fetchNetizenReactions}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-ink hover:bg-white/15 cursor-pointer"
              >
                <span>🔄 Coba Lagi</span>
              </button>
            </div>
          ) : (
            comments.map((c) => {
              const isLiked = !!likedComments[c.id];
              const displayLikes = c.likes + (isLiked ? 1 : 0);

              return (
                <div key={c.id} className="pt-3.5 first:pt-0 flex gap-3 items-start group">
                  {/* Avatar */}
                  <div
                    className={`size-8 rounded-full bg-gradient-to-br ${c.avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}
                  >
                    {c.name.charAt(0)}
                  </div>

                  {/* Comment Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-ink leading-tight">{c.name}</span>
                        <span className="text-[10px] text-muted">{c.handle}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[9px] font-semibold border ${c.badge.bg} ${c.badge.text}`}
                        >
                          <span>{c.badge.icon}</span>
                          <span>{c.badge.label}</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-muted shrink-0">{c.timeAgo}</span>
                    </div>

                    <p className="text-xs text-ink/90 leading-relaxed break-words">{c.comment}</p>

                    {/* Actions (Like / Reply Simulation) */}
                    <div className="flex items-center gap-4 mt-1.5 text-[10px] text-muted">
                      <button
                        onClick={() => handleToggleLike(c.id)}
                        className={`flex items-center gap-1 transition-colors cursor-pointer ${
                          isLiked ? "text-rose-500 font-bold" : "hover:text-ink"
                        }`}
                      >
                        <span>{isLiked ? "❤️" : "🤍"}</span>
                        <span>{displayLikes}</span>
                      </button>
                      <span className="hover:text-ink cursor-pointer">Balas</span>
                      <span className="hover:text-ink cursor-pointer">Lihat terjemahan</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* AI Recommended Pinned Comment Box */}
        <div className="border-t border-hairline/60 bg-surface/60 p-3 sm:px-5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-ember flex items-center gap-1.5">
              <span>📌</span> Rekomendasi Pin Komen Kreator:
            </span>
            <button
              onClick={handleCopyPinned}
              disabled={isLoading || !suggestedPinnedComment}
              className="text-[10px] font-semibold text-ink bg-white/10 hover:bg-white/15 px-2 py-1 rounded transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {copiedPinned ? "✓ Disalin!" : "Salin Komen"}
            </button>
          </div>
          {isLoading && !suggestedPinnedComment ? (
            <div className="space-y-1.5 bg-black/40 rounded-lg p-2.5 border border-hairline/40 animate-pulse">
              <div className="h-3 w-5/6 rounded bg-white/[0.08]" />
              <div className="h-3 w-2/3 rounded bg-white/[0.05]" />
            </div>
          ) : (
            <p className="text-xs text-muted italic bg-black/40 rounded-lg p-2.5 border border-hairline/40 leading-relaxed">
              &ldquo;{suggestedPinnedComment}&rdquo;
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-hairline/80 bg-surface/90 px-4 py-3 sm:px-5">
          <button
            onClick={fetchNetizenReactions}
            disabled={isLoading}
            className="h-8 flex items-center gap-1.5 rounded-xl border border-hairline/80 bg-white/[0.04] px-3.5 text-xs font-semibold text-ink hover:border-ember/40 hover:text-ember active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            <span className={isLoading ? "animate-spin" : ""}>🔄</span>
            <span>{isLoading ? "Memproses..." : "Acak Respon Baru"}</span>
          </button>

          <button
            onClick={onClose}
            className="h-8 rounded-xl bg-ember px-4 text-xs font-bold text-obsidian shadow-sm hover:bg-ember-lo active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center"
          >
            Tutup & Siap Posting
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
