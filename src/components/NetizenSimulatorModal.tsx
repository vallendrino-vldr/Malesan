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
  const [potensiViral, setPotensiViral] = useState("8.8 / 10 (Tinggi)");
  const [dayaDebat, setDayaDebat] = useState("8.0 / 10 (Aktif)");
  const [rasioKonversi, setRasioKonversi] = useState("Tinggi (Relate & Edukasi)");
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
                <span className="rounded-full bg-ember/15 border border-ember/30 px-2 py-0.2 text-[10px] font-semibold text-ember">
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
          <div className="rounded-lg bg-white/[0.03] p-1.5 border border-white/[0.04]">
            <div className="text-[10px] text-muted">🔥 Potensi Viral</div>
            <div className="font-bold text-emerald-400 truncate">{potensiViral}</div>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-1.5 border border-white/[0.04]">
            <div className="text-[10px] text-muted">⚡ Daya Debat</div>
            <div className="font-bold text-ember truncate">{dayaDebat}</div>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-1.5 border border-white/[0.04]">
            <div className="text-[10px] text-muted">🎯 Rasio Konversi</div>
            <div className="font-bold text-sky-400 truncate">{rasioKonversi}</div>
          </div>
        </div>

        {/* Scrollable Comments Feed / Loading Skeleton */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 divide-y divide-hairline/30 custom-scrollbar">
          {isLoading ? (
            <div className="py-8 text-center space-y-3">
              <div className="inline-flex size-10 items-center justify-center rounded-full bg-ember/20 text-ember text-lg animate-spin">
                ⏳
              </div>
              <p className="text-xs font-semibold text-ink">
                Membaca naskah & mensimulasikan reaksi 6 karakter netizen...
              </p>
              <p className="text-[11px] text-muted">
                Menciptakan respon otentik sesuai topik naskah lo
              </p>
              <div className="pt-3 space-y-2.5 max-w-sm mx-auto">
                <div className="h-10 rounded-xl bg-white/[0.04] animate-pulse" />
                <div className="h-10 rounded-xl bg-white/[0.04] animate-pulse delay-100" />
                <div className="h-10 rounded-xl bg-white/[0.04] animate-pulse delay-200" />
              </div>
            </div>
          ) : error && comments.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-xs text-danger">{error}</p>
              <button
                onClick={fetchNetizenReactions}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-ink hover:bg-white/15"
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
          <p className="text-xs text-muted italic bg-black/40 rounded-lg p-2 border border-hairline/40 leading-relaxed">
            {suggestedPinnedComment ? (
              <>&ldquo;{suggestedPinnedComment}&rdquo;</>
            ) : (
              <span className="text-muted/60">Menghasilkan saran pin komentar yang memicu debat...</span>
            )}
          </p>
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
