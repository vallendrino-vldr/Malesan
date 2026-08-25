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
    badge: { label: string; bg: string; text: string };
  }
> = {
  skeptis: {
    name: "Bayu Antiklaim",
    handle: "@bayu_analis99",
    avatarColor: "from-amber-500 to-red-600",
    badge: { label: "Skeptis / Debat", bg: "bg-red-500/10 border-red-500/30", text: "text-red-400" },
  },
  fomo: {
    name: "Siska Racun TikTok",
    handle: "@siska_checkout_terus",
    avatarColor: "from-pink-500 to-rose-600",
    badge: { label: "FOMO / Emosi", bg: "bg-pink-500/10 border-pink-500/30", text: "text-pink-400" },
  },
  receh: {
    name: "Rian Kaum Rebahan",
    handle: "@rian_saldo_tipis",
    avatarColor: "from-purple-500 to-indigo-600",
    badge: { label: "Top Komen Receh", bg: "bg-purple-500/10 border-purple-500/30", text: "text-purple-400" },
  },
  detail: {
    name: "Dimas Detail Police",
    handle: "@dimas_pakar_dadakan",
    avatarColor: "from-blue-500 to-cyan-600",
    badge: { label: "Detail Police", bg: "bg-blue-500/10 border-blue-500/30", text: "text-blue-400" },
  },
  relate: {
    name: "Nadia Relate Parah",
    handle: "@nadiacurhat_id",
    avatarColor: "from-emerald-500 to-teal-600",
    badge: { label: "Curhat Relate", bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400" },
  },
  promo: {
    name: "Farhan Cari Solusi",
    handle: "@farhan_tips_id",
    avatarColor: "from-amber-400 to-orange-500",
    badge: { label: "Pemburu Solusi", bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400" },
  },
};

const LOADING_STEPS = [
  "Membaca naskah & hook utama...",
  "Mensimulasikan respon 6 karakter netizen...",
  "Menghitung proyeksi viralitas & daya debat...",
  "Merumuskan strategi pin komen terbaik...",
];

const PERSONA_TAGS = [
  { label: "Skeptis / Debat", name: "@bayu_analis99" },
  { label: "FOMO / Emosi", name: "@siska_checkout_terus" },
  { label: "Top Komen Receh", name: "@rian_saldo_tipis" },
  { label: "Detail Police", name: "@dimas_pakar_dadakan" },
  { label: "Curhat Relate", name: "@nadiacurhat_id" },
  { label: "Pemburu Solusi", name: "@farhan_tips_id" },
];

const netizenCache = new Map<
  string,
  {
    potensiViral: string;
    dayaDebat: string;
    rasioKonversi: string;
    suggestedPinnedComment: string;
    comments: NetizenComment[];
  }
>();

export function NetizenSimulatorModal({
  isOpen,
  onClose,
  title,
  scriptContent,
  platform = "TikTok / Reels",
}: NetizenSimulatorModalProps) {
  const isMounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const cacheKey = `${title}_${scriptContent || ""}_${platform}`;

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<NetizenComment[]>(
    () => netizenCache.get(`${title}_${scriptContent || ""}_${platform}`)?.comments || []
  );
  const [potensiViral, setPotensiViral] = useState(
    () => netizenCache.get(`${title}_${scriptContent || ""}_${platform}`)?.potensiViral || ""
  );
  const [dayaDebat, setDayaDebat] = useState(
    () => netizenCache.get(`${title}_${scriptContent || ""}_${platform}`)?.dayaDebat || ""
  );
  const [rasioKonversi, setRasioKonversi] = useState(
    () => netizenCache.get(`${title}_${scriptContent || ""}_${platform}`)?.rasioKonversi || ""
  );
  const [suggestedPinnedComment, setSuggestedPinnedComment] = useState(
    () => netizenCache.get(`${title}_${scriptContent || ""}_${platform}`)?.suggestedPinnedComment || ""
  );
  const [copiedPinned, setCopiedPinned] = useState(false);
  const [likedComments, setLikedComments] = useState<Record<string, boolean>>({});

  // Cycle loading step text to ensure dynamic active visual feedback
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => {
      setLoadingStepIdx((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 1100);
    return () => clearInterval(timer);
  }, [isLoading]);

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

  // Fetch real AI-generated netizen reactions (updates cache)
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

      const pViral = data.potensiViral || "8.8 / 10 (Tinggi)";
      const dDebat = data.dayaDebat || "8.2 / 10 (Aktif)";
      const rKonv = data.rasioKonversi || "Tinggi (Relate)";
      const sPinned =
        data.suggestedPinnedComment ||
        `Menurut kalian dari pembahasan "${title || "video ini"}", mana yang paling relate? Drop di kolom komentar ya! 👇`;

      setPotensiViral(pViral);
      setDayaDebat(dDebat);
      setRasioKonversi(rKonv);
      setSuggestedPinnedComment(sPinned);

      let mappedComments: NetizenComment[] = [];
      if (Array.isArray(data.comments)) {
        mappedComments = data.comments.map(
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
        setComments(mappedComments);
      }

      // Save to instant memory cache
      netizenCache.set(cacheKey, {
        potensiViral: pViral,
        dayaDebat: dDebat,
        rasioKonversi: rKonv,
        suggestedPinnedComment: sPinned,
        comments: mappedComments,
      });
    } catch (err) {
      console.error("Netizen simulator fetch error:", err);
      setError(err instanceof Error ? err.message : "Gagal memuat respon netizen.");
    } finally {
      setIsLoading(false);
    }
  }, [title, scriptContent, platform, cacheKey]);

  // Load automatically on modal open (instant 0ms if cached)
  useEffect(() => {
    if (!isOpen) return;

    // If already cached or comments exist, do not fetch
    if (netizenCache.has(cacheKey) || comments.length > 0) return;

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

        const pViral = data.potensiViral || "8.8 / 10 (Tinggi)";
        const dDebat = data.dayaDebat || "8.2 / 10 (Aktif)";
        const rKonv = data.rasioKonversi || "Tinggi (Relate)";
        const sPinned =
          data.suggestedPinnedComment ||
          `Menurut kalian dari pembahasan "${title || "video ini"}", mana yang paling relate? Drop di kolom komentar ya! 👇`;

        setPotensiViral(pViral);
        setDayaDebat(dDebat);
        setRasioKonversi(rKonv);
        setSuggestedPinnedComment(sPinned);

        let mappedComments: NetizenComment[] = [];
        if (Array.isArray(data.comments)) {
          mappedComments = data.comments.map(
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
          setComments(mappedComments);
        }

        // Save to instant memory cache
        netizenCache.set(cacheKey, {
          potensiViral: pViral,
          dayaDebat: dDebat,
          rasioKonversi: rKonv,
          suggestedPinnedComment: sPinned,
          comments: mappedComments,
        });
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
  }, [isOpen, comments.length, title, scriptContent, platform, cacheKey]);

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
            <div className="flex size-8 items-center justify-center rounded-lg bg-ember/15 text-ember border border-ember/30 shrink-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
                aria-hidden="true"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="netizen-simulator-title" className="text-sm font-bold text-ink">
                  Simulasi Respon Netizen
                </h3>
                <span className="rounded-full bg-ember/15 border border-ember/30 px-2 py-0.5 text-[10px] font-semibold text-ember flex items-center gap-1.5">
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
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Engagement Health & Sentiment Ticker */}
        <div className="grid grid-cols-3 gap-2 border-b border-hairline/40 bg-surface/30 px-4 py-2 sm:px-5 text-center text-[11px]">
          <div className="rounded-lg bg-white/[0.03] p-2 border border-white/[0.04] min-h-[50px] flex flex-col justify-center">
            <div className="text-[10px] text-muted font-medium flex items-center justify-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3 text-emerald-400" aria-hidden="true">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              <span>Potensi Viral</span>
            </div>
            {isLoading && !potensiViral ? (
              <div className="h-3.5 w-16 bg-white/[0.08] rounded animate-shimmer-sweep mx-auto mt-1" />
            ) : (
              <div className="font-bold text-emerald-400 truncate mt-0.5">{potensiViral || "8.8 / 10 (Tinggi)"}</div>
            )}
          </div>

          <div className="rounded-lg bg-white/[0.03] p-2 border border-white/[0.04] min-h-[50px] flex flex-col justify-center">
            <div className="text-[10px] text-muted font-medium flex items-center justify-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3 text-ember" aria-hidden="true">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>Daya Debat</span>
            </div>
            {isLoading && !dayaDebat ? (
              <div className="h-3.5 w-16 bg-white/[0.08] rounded animate-shimmer-sweep mx-auto mt-1" />
            ) : (
              <div className="font-bold text-ember truncate mt-0.5">{dayaDebat || "8.0 / 10 (Aktif)"}</div>
            )}
          </div>

          <div className="rounded-lg bg-white/[0.03] p-2 border border-white/[0.04] min-h-[50px] flex flex-col justify-center">
            <div className="text-[10px] text-muted font-medium flex items-center justify-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3 text-sky-400" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              <span>Rasio Konversi</span>
            </div>
            {isLoading && !rasioKonversi ? (
              <div className="h-3.5 w-20 bg-white/[0.08] rounded animate-shimmer-sweep mx-auto mt-1" />
            ) : (
              <div className="font-bold text-sky-400 truncate mt-0.5">{rasioKonversi || "Tinggi (Relate)"}</div>
            )}
          </div>
        </div>

        {/* Scrollable Comments Feed / Kinetic Loading Experience */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 divide-y divide-hairline/30 custom-scrollbar">
          {isLoading ? (
            <div className="space-y-4">
              {/* Studio AI Engine Pulse Indicator with Live Step Cycle */}
              <div className="rounded-xl border border-ember/30 bg-gradient-to-br from-ember/15 via-ember/5 to-transparent p-3.5 relative overflow-hidden animate-shimmer-sweep">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-ember/25 text-ember text-xs shrink-0 font-bold">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 animate-spin" aria-hidden="true">
                      <line x1="12" y1="2" x2="12" y2="6" />
                      <line x1="12" y1="18" x2="12" y2="22" />
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                      <line x1="2" y1="12" x2="6" y2="12" />
                      <line x1="18" y1="12" x2="22" y2="12" />
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-ink transition-all duration-300">
                      {LOADING_STEPS[loadingStepIdx]}
                    </div>
                    <p className="text-[10px] text-muted truncate">
                      Menganalisis topik &ldquo;{title || "konten lo"}&rdquo; secara kontekstual
                    </p>
                  </div>
                </div>

                {/* Kinetic Persona Badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PERSONA_TAGS.map((p, idx) => (
                    <div
                      key={p.name}
                      style={{ animationDelay: `${idx * 180}ms` }}
                      className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] border border-white/[0.1] px-2 py-0.5 text-[10px] text-ink/90 font-medium animate-pulse"
                    >
                      <span className="size-1.5 rounded-full bg-ember/80" />
                      <span>{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Shimmer Feed Skeletons */}
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="pt-3.5 first:pt-0 flex gap-3 items-start">
                  {/* Avatar Skeleton */}
                  <div className="size-8 rounded-full bg-white/[0.08] shrink-0 animate-shimmer-sweep" />

                  {/* Body Skeleton */}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="h-3.5 w-24 rounded bg-white/[0.12] animate-shimmer-sweep" />
                      <div className="h-3 w-16 rounded bg-white/[0.06] animate-shimmer-sweep" />
                      <div className="h-3.5 w-20 rounded bg-ember/20 animate-shimmer-sweep" />
                    </div>
                    <div
                      className={`h-3 rounded bg-white/[0.09] animate-shimmer-sweep ${
                        i % 2 === 0 ? "w-[92%]" : "w-[84%]"
                      }`}
                    />
                    <div
                      className={`h-3 rounded bg-white/[0.06] animate-shimmer-sweep ${
                        i % 2 === 0 ? "w-[68%]" : "w-[75%]"
                      }`}
                    />
                    <div className="flex items-center gap-3 pt-0.5">
                      <div className="h-2.5 w-8 rounded bg-white/[0.06] animate-shimmer-sweep" />
                      <div className="h-2.5 w-10 rounded bg-white/[0.05] animate-shimmer-sweep" />
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3" aria-hidden="true">
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
                <span>Coba Lagi</span>
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
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold border ${c.badge.bg} ${c.badge.text}`}
                        >
                          {c.badge.label}
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
                        <svg
                          viewBox="0 0 24 24"
                          fill={isLiked ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="size-3.5"
                          aria-hidden="true"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3" aria-hidden="true">
                <line x1="12" y1="17" x2="12" y2="22" />
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a3 3 0 0 0-6 0v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
              </svg>
              <span>Rekomendasi Pin Komen Kreator:</span>
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
            <div className="space-y-1.5 bg-black/40 rounded-lg p-2.5 border border-hairline/40 animate-shimmer-sweep">
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
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`size-3.5 ${isLoading ? "animate-spin text-ember" : ""}`}
              aria-hidden="true"
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
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
