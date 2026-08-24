"use client";

import React, { useState, useMemo, useCallback, useEffect, useSyncExternalStore } from "react";
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

const NETIZEN_ARCHETYPES = [
  {
    type: "skeptis",
    name: "Bayu Antiklaim",
    handle: "@bayu_analis99",
    avatarColor: "from-amber-500 to-red-600",
    badge: { label: "Skeptis / Debat", bg: "bg-red-500/10 border-red-500/30", text: "text-red-400", icon: "🧐" },
    templates: [
      "Ah masa sih? Di toko sebelah harganya lebih murah setengahnya deh...",
      "Spill bukti risetnya bang, jangan cuma klaim sepihak buat naikin views doang.",
      "Kalo di kota kecil gak bakal bisa diterapin sih cara ginian, realistis aja lah.",
      "Gue udah pernah coba trik kayak gini tahun lalu, hasilnya zonk gak ngaruh apa-apa.",
    ],
  },
  {
    type: "fomo",
    name: "Siska Racun TikTok",
    handle: "@siska_checkout_terus",
    avatarColor: "from-pink-500 to-rose-600",
    badge: { label: "FOMO / Racun", bg: "bg-pink-500/10 border-pink-500/30", text: "text-pink-400", icon: "😍" },
    templates: [
      "KERANJANG KUNING SEBELAH MANA KAKK MAU CHECKOUT SEKARANGG 😭🔥",
      "Gak bisa dibiarin, racun baru lagi anjirr baru gajian langsung abis!",
      "Auto checkout! Jangan lupa klaim voucher gratis ongkirnya ya gaes biar dapet potongan.",
      "Sumpah bagus bgt, gue udah punya 2 warna dan emang se-worth it itu dipake!",
    ],
  },
  {
    type: "receh",
    name: "Rian Kaum Rebahan",
    handle: "@rian_saldo_tipis",
    avatarColor: "from-purple-500 to-indigo-600",
    badge: { label: "Top Komen Receh", bg: "bg-purple-500/10 border-purple-500/30", text: "text-purple-400", icon: "😂" },
    templates: [
      "Gue yang nonton video ini jam 2 pagi sambil mikirin cicilan: 🗿👍",
      "Info yang sangat bermanfaat bagi saya yang saldo rekeningnya tinggal 4 ribu rupiah.",
      "Nontonnya serius banget kayak mau praktek, padahal abis ini lanjut scroll reels sampe subuh.",
      "Muka gue pas dengerin triknya: 😮 Muka dompet gue: 💀",
    ],
  },
  {
    type: "detail",
    name: "Dimas Detail Police",
    handle: "@dimas_pakar_dadakan",
    avatarColor: "from-blue-500 to-cyan-600",
    badge: { label: "Detail Police", bg: "bg-blue-500/10 border-blue-500/30", text: "text-blue-400", icon: "🤓" },
    templates: [
      "Kalo diperhatiin di detik awal tadi ada step yang kelewat, mestinya dicek dulu sertifikasinya.",
      "Secara teori bener, tapi faktor cuaca & kelembaban di Indo juga ngaruh ke durabilitasnya bro.",
      "Tambahan dikit buat kreator: next time kasih perbandingan side-by-side biar makin valid!",
      "Poin 2 itu krusial banget sih, banyak pemula yang skip bagian itu makanya gagal.",
    ],
  },
  {
    type: "relate",
    name: "Nadia Relate Parah",
    handle: "@nadiacurhat_id",
    avatarColor: "from-emerald-500 to-teal-600",
    badge: { label: "Curhat Relate", bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400", icon: "🤍" },
    templates: [
      "Valid banget sih ini! Gue ngalamin sendiri minggu lalu dan nyesel bgt baru tau sekarang...",
      "Beneran ngerasa kesenggol pas nonton bagian ini, relate parah sama kehidupan pekerja kantoran.",
      "Makasih bang udah speak up soal ini, jarang banget kreator yang mau jujur bahas beginian.",
      "Gue kirim video ini ke grup keluarga biar pada sadar dan gak ketipu lagi.",
    ],
  },
  {
    type: "promo",
    name: "Farhan Cari Diskon",
    handle: "@farhan_gratisongkir",
    avatarColor: "from-amber-400 to-orange-500",
    badge: { label: "Pemburu Promo", bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400", icon: "🛒" },
    templates: [
      "Bisa COD gak min? Pengiriman ke luar Jawa aman gak ya packing-nya?",
      "Spill link tokonya kak, lagi ada flash sale tanggal kembar gak ya hari ini?",
      "Kalo beli 2 dapet diskon tambahan gak min? Minat buat kado ultah temen nih.",
      "Masih dapet bonus gratisan gak kalo checkout sebelum jam 12 malam?",
    ],
  },
];

export function NetizenSimulatorModal({
  isOpen,
  onClose,
  title,
  scriptContent,
  platform = "TikTok / Reels",
}: NetizenSimulatorModalProps) {
  const [rerollSeed, setRerollSeed] = useState(0);
  const [copiedPinned, setCopiedPinned] = useState(false);
  const [likedComments, setLikedComments] = useState<Record<string, boolean>>({});

  // Generate randomized netizen reactions based on script context & seed
  const comments: NetizenComment[] = useMemo(() => {
    const hasLongScript = Boolean(scriptContent && scriptContent.length > 50);
    return NETIZEN_ARCHETYPES.map((arch, idx) => {
      const templateIdx = (rerollSeed + idx * 2 + (hasLongScript ? 1 : 0)) % arch.templates.length;
      const baseLikes = 45 + ((rerollSeed * 17 + idx * 53) % 480);
      const timeMinutes = 3 + ((rerollSeed + idx * 7) % 45);

      return {
        id: `${arch.type}-${rerollSeed}-${idx}`,
        name: arch.name,
        handle: arch.handle,
        avatarColor: arch.avatarColor,
        badge: arch.badge,
        comment: arch.templates[templateIdx],
        likes: baseLikes,
        timeAgo: `${timeMinutes}m`,
      };
    });
  }, [rerollSeed, scriptContent]);

  // Suggested pinned comment for creator to spark high engagement
  const suggestedPinnedComment = useMemo(() => {
    const cleanTitle = title?.trim() || "topik ini";
    const topics = [
      `Kalo menurut kalian soal "${cleanTitle}", lebih suka opsi A atau B? Drop di kolom komentar ya! 👇`,
      `Banyak yang nanya di DM soal trik ini: info detail udah gue taruh di bio ya! Menurut kalian worth it gak?`,
      `Jujur kaget bgt sama hasilnya. Ada yang pernah ngalamin hal serupa juga gak nih?`,
    ];
    return topics[rerollSeed % topics.length];
  }, [title, rerollSeed]);

  const handleCopyPinned = useCallback(() => {
    navigator.clipboard.writeText(suggestedPinnedComment);
    setCopiedPinned(true);
    setTimeout(() => setCopiedPinned(false), 2000);
  }, [suggestedPinnedComment]);

  const isMounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

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

  const handleToggleLike = (id: string) => {
    setLikedComments((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleReroll = () => {
    setRerollSeed((prev) => prev + 1);
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
        <div className="flex items-center justify-between border-b border-hairline/60 bg-surface/80 px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-ember/15 text-ember text-sm font-bold border border-ember/30">
              💬
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="netizen-simulator-title" className="text-sm font-bold text-ink">
                  Simulasi Respon Netizen
                </h3>
                <span className="rounded-full bg-ember/15 border border-ember/30 px-2 py-0.2 text-[10px] font-semibold text-ember">
                  AI Preview
                </span>
              </div>
              <p className="text-[11px] text-muted line-clamp-1 max-w-[280px] sm:max-w-sm">
                Target: {title || "Naskah Siap"} ({platform})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-white/10 hover:text-ink transition-colors cursor-pointer"
            aria-label="Tutup Modal"
          >
            ✕
          </button>
        </div>

        {/* Engagement Health & Sentiment Ticker */}
        <div className="grid grid-cols-3 gap-2 border-b border-hairline/40 bg-surface/30 px-4 py-2.5 sm:px-5 text-center text-[11px]">
          <div className="rounded-lg bg-white/[0.03] p-1.5 border border-white/[0.04]">
            <div className="text-[10px] text-muted">🔥 Potensi Viral</div>
            <div className="font-bold text-emerald-400">8.8 / 10 (Tinggi)</div>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-1.5 border border-white/[0.04]">
            <div className="text-[10px] text-muted">⚡ Daya Debat</div>
            <div className="font-bold text-ember">7.5 / 10 (Aktif)</div>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-1.5 border border-white/[0.04]">
            <div className="text-[10px] text-muted">🎯 Rasio Konversi</div>
            <div className="font-bold text-sky-400">Tinggi (FOMO)</div>
          </div>
        </div>

        {/* Scrollable Comments Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 divide-y divide-hairline/30 custom-scrollbar">
          {comments.map((c) => {
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
          })}
        </div>

        {/* AI Recommended Pinned Comment Box */}
        <div className="border-t border-hairline/60 bg-surface/60 p-3.5 sm:px-5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-ember flex items-center gap-1.5">
              <span>📌</span> Rekomendasi Pin Komen Kreator:
            </span>
            <button
              onClick={handleCopyPinned}
              className="text-[10px] font-semibold text-ink bg-white/10 hover:bg-white/15 px-2 py-1 rounded transition-colors cursor-pointer active:scale-95"
            >
              {copiedPinned ? "✓ Disalin!" : "Salin Komen"}
            </button>
          </div>
          <p className="text-xs text-muted italic bg-black/40 rounded-lg p-2 border border-hairline/40">
            &ldquo;{suggestedPinnedComment}&rdquo;
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-hairline/80 bg-surface/90 px-4 py-3 sm:px-5">
          <button
            onClick={handleReroll}
            className="h-8 flex items-center gap-1.5 rounded-xl border border-hairline/80 bg-white/[0.04] px-3.5 text-xs font-semibold text-ink hover:border-ember/40 hover:text-ember active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>🔄</span>
            <span>Acak Respon Baru</span>
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
