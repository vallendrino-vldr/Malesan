"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

type SlideTheme = "obsidian" | "clean" | "emerald";

interface SlideData {
  type: "cover" | "content" | "cta";
  badge?: string;
  title: string;
  body: string;
  footer?: string;
}

const DEFAULT_SLIDES: SlideData[] = [
  {
    type: "cover",
    badge: "TIPS KONTEN",
    title: "3 Kesalahan Fatal Bikin Video Affiliate",
    body: "Yang diam-diam bikin akun lo sepi penonton dan keranjang kuning gak disentuh sama sekali.",
    footer: "Geser ke samping 👉",
  },
  {
    type: "content",
    badge: "KESALAHAN #1",
    title: "Buka Video dengan Salam & Basa-basi",
    body: "3 Detik pertama itu penentu. Jangan ngomong 'Halo guys hari ini...', langsung buka dengan keresahan atau unboxing heboh.",
    footer: "Slide 2 dari 4",
  },
  {
    type: "content",
    badge: "KESALAHAN #2",
    title: "Spill Harga di Akhir Tanpa Alasan",
    body: "Orang beli karena butuh solusinya. Buktiin dulu barangnya bisa nyelesaiin masalah mereka, baru spill promo harganya.",
    footer: "Slide 3 dari 4",
  },
  {
    type: "cta",
    badge: "KESIMPULAN",
    title: "Mau Bikin Naskah Affiliate Otomatis?",
    body: "Gunakan Malesan AI untuk racik 3 varian naskah video racun belanja dalam 15 detik.",
    footer: "Simpan postingan ini ✨",
  },
];

export function CarouselGenerator({
  initialTitle,
  initialText,
}: {
  initialTitle?: string;
  initialText?: string;
}) {
  const [prevTitle, setPrevTitle] = useState(initialTitle);
  const [slides, setSlides] = useState<SlideData[]>(() => {
    if (initialTitle) {
      return [
        {
          ...DEFAULT_SLIDES[0],
          title: initialTitle,
          body: initialText ? initialText.slice(0, 120) : DEFAULT_SLIDES[0].body,
        },
        ...DEFAULT_SLIDES.slice(1),
      ];
    }
    return DEFAULT_SLIDES;
  });
  const [currentIdx, setCurrentIdx] = useState(0);
  const [theme, setTheme] = useState<SlideTheme>("obsidian");
  const [ratio, setRatio] = useState<"4:5" | "1:1">("4:5");
  const [creatorTag, setCreatorTag] = useState("@malesan_creator");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync state if initialTitle changes
  if (initialTitle && initialTitle !== prevTitle) {
    setPrevTitle(initialTitle);
    setSlides((prev) => [
      {
        ...prev[0],
        title: initialTitle,
        body: initialText ? initialText.slice(0, 120) : prev[0].body,
      },
      ...prev.slice(1),
    ]);
  }

  // Render a specific slide onto a canvas context
  const renderSlideToCanvas = useCallback((
    ctx: CanvasRenderingContext2D,
    slide: SlideData,
    slideIndex: number,
    totalSlides: number,
    width: number,
    height: number,
    targetTheme: SlideTheme,
    tag: string
  ) => {
    // 1. Background
    if (targetTheme === "obsidian") {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0e0e11");
      grad.addColorStop(0.5, "#141419");
      grad.addColorStop(1, "#1a1310");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Ember decorative glow
      const glow = ctx.createRadialGradient(width * 0.8, height * 0.2, 50, width * 0.8, height * 0.2, width * 0.7);
      glow.addColorStop(0, "rgba(242, 98, 34, 0.15)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    } else if (targetTheme === "emerald") {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#081c15");
      grad.addColorStop(0.6, "#1b4332");
      grad.addColorStop(1, "#081c15");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else {
      // Clean Light
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(0, 0, width, height);
    }

    const isDark = targetTheme !== "clean";
    const primaryTextColor = isDark ? "#ffffff" : "#111827";
    const mutedTextColor = isDark ? "#a1a1aa" : "#4b5563";
    const accentColor = targetTheme === "emerald" ? "#52b788" : "#f26222";

    // 2. Header: Badge & Creator Tag
    const paddingX = width * 0.08;
    let cursorY = height * 0.1;

    // Badge pill
    if (slide.badge) {
      ctx.font = `bold ${width * 0.03}px sans-serif`;
      const badgeText = slide.badge.toUpperCase();
      const textMetrics = ctx.measureText(badgeText);
      const pillWidth = textMetrics.width + 36;
      const pillHeight = width * 0.06;

      ctx.fillStyle = targetTheme === "emerald" ? "rgba(82, 183, 136, 0.2)" : "rgba(242, 98, 34, 0.2)";
      ctx.beginPath();
      ctx.roundRect(paddingX, cursorY, pillWidth, pillHeight, pillHeight / 2);
      ctx.fill();

      ctx.fillStyle = accentColor;
      ctx.fillText(badgeText, paddingX + 18, cursorY + pillHeight * 0.68);

      cursorY += pillHeight + height * 0.04;
    }

    // 3. Main Title (Word wrap)
    ctx.fillStyle = primaryTextColor;
    ctx.font = `bold ${width * 0.065}px sans-serif`;
    const titleLineHeight = width * 0.085;

    const words = slide.title.split(" ");
    let line = "";
    const maxWidth = width - paddingX * 2;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, paddingX, cursorY);
        line = words[n] + " ";
        cursorY += titleLineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, paddingX, cursorY);
    cursorY += height * 0.04;

    // 4. Body Content (Word wrap)
    ctx.fillStyle = mutedTextColor;
    ctx.font = `${width * 0.04}px sans-serif`;
    const bodyLineHeight = width * 0.062;

    const bodyWords = slide.body.split(" ");
    let bodyLine = "";

    for (let n = 0; n < bodyWords.length; n++) {
      const testLine = bodyLine + bodyWords[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(bodyLine, paddingX, cursorY);
        bodyLine = bodyWords[n] + " ";
        cursorY += bodyLineHeight;
      } else {
        bodyLine = testLine;
      }
    }
    ctx.fillText(bodyLine, paddingX, cursorY);

    // 5. Footer: Slide Indicator & Creator Handle
    const footerY = height * 0.92;
    ctx.fillStyle = mutedTextColor;
    ctx.font = `bold ${width * 0.03}px sans-serif`;
    ctx.fillText(tag || "@malesan", paddingX, footerY);

    const counterText = `${slideIndex + 1} / ${totalSlides}`;
    const counterWidth = ctx.measureText(counterText).width;
    ctx.fillStyle = accentColor;
    ctx.fillText(counterText, width - paddingX - counterWidth, footerY);
  }, []);

  // Update canvas preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = 1080;
    const height = ratio === "4:5" ? 1350 : 1080;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const currentSlide = slides[currentIdx] || slides[0];
    renderSlideToCanvas(
      ctx,
      currentSlide,
      currentIdx,
      slides.length,
      width,
      height,
      theme,
      creatorTag
    );
  }, [slides, currentIdx, theme, ratio, creatorTag, renderSlideToCanvas]);

  // Export single slide or all slides as PNG
  const handleExportAll = async () => {
    setIsExporting(true);
    const width = 1080;
    const height = ratio === "4:5" ? 1350 : 1080;

    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext("2d");

    if (!ctx) {
      setIsExporting(false);
      return;
    }

    try {
      for (let i = 0; i < slides.length; i++) {
        setExportProgress(`Mengunduh Slide ${i + 1} dari ${slides.length}...`);
        renderSlideToCanvas(
          ctx,
          slides[i],
          i,
          slides.length,
          width,
          height,
          theme,
          creatorTag
        );

        const dataUrl = offscreen.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `slide_${i + 1}_${slides[i].title.slice(0, 20).replace(/\s+/g, "_")}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Small pause between downloads
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (err) {
      console.error("Export error", err);
      alert("Gagal mengunduh gambar slide.");
    } finally {
      setIsExporting(false);
      setExportProgress("");
    }
  };

  const handleUpdateCurrentSlide = (field: keyof SlideData, val: string) => {
    setSlides((prev) =>
      prev.map((s, idx) => (idx === currentIdx ? { ...s, [field]: val } : s))
    );
  };

  const handleAddSlide = () => {
    setSlides((prev) => [
      ...prev,
      {
        type: "content",
        badge: `POIN #${prev.length}`,
        title: "Judul Poin Baru",
        body: "Penjelasan ringkas dan padat yang nyaman dibaca di layar HP.",
        footer: `Slide ${prev.length + 1}`,
      },
    ]);
    setCurrentIdx(slides.length);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-ember/30 bg-surface p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ember/15 border border-ember/30 text-base">
            🎨
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-ink">
              AI Carousel &amp; Slide Card Generator
            </h2>
            <p className="text-micro text-muted">
              Ubah ide/naskah jadi gambar slide Instagram (1080×1350) &amp; LinkedIn siap download PNG
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportAll}
          disabled={isExporting}
          className="btn-ember inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-obsidian shadow-sm transition-transform active:scale-95 disabled:opacity-50"
        >
          <span>💾</span>
          <span>{isExporting ? exportProgress : "Download Semua Slide (.PNG)"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left Controls & Slide Text Editor (7 cols) */}
        <div className="space-y-3.5 lg:col-span-7">
          {/* Customization Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-xl border border-hairline bg-surface p-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                Pilih Tema
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as SlideTheme)}
                className="w-full rounded-lg border border-hairline bg-obsidian px-2.5 py-1.5 text-xs text-ink"
              >
                <option value="obsidian">🔥 Obsidian Ember</option>
                <option value="emerald">🌿 Bold Emerald</option>
                <option value="clean">📄 Clean Light</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                Format Rasio
              </label>
              <select
                value={ratio}
                onChange={(e) => setRatio(e.target.value as "4:5" | "1:1")}
                className="w-full rounded-lg border border-hairline bg-obsidian px-2.5 py-1.5 text-xs text-ink"
              >
                <option value="4:5">📱 4:5 (Instagram Feed)</option>
                <option value="1:1">🟦 1:1 (Square LinkedIn)</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                Username / Handle
              </label>
              <input
                type="text"
                value={creatorTag}
                onChange={(e) => setCreatorTag(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-obsidian px-2.5 py-1.5 text-xs text-ink"
                placeholder="@username"
              />
            </div>
          </div>

          {/* Slide Navigator & Editor */}
          <div className="surface-card rounded-2xl border border-hairline p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2.5">
              <span className="eyebrow text-ember font-bold">
                Edit Slide #{currentIdx + 1} dari {slides.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAddSlide}
                  className="rounded-lg border border-hairline bg-surface-raised px-2.5 py-1 text-micro font-semibold text-ink hover:border-ember/40"
                >
                  + Tambah Slide
                </button>
              </div>
            </div>

            {/* Slide Navigation Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIdx(idx)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition-colors ${
                    currentIdx === idx
                      ? "bg-ember text-obsidian shadow-xs"
                      : "bg-surface-raised text-muted hover:text-ink border border-hairline"
                  }`}
                >
                  #{idx + 1}
                </button>
              ))}
            </div>

            {/* Form Fields for Active Slide */}
            {slides[currentIdx] && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-micro font-semibold text-muted mb-1">
                    Label Kategori (Badge Atas)
                  </label>
                  <input
                    type="text"
                    value={slides[currentIdx].badge || ""}
                    onChange={(e) => handleUpdateCurrentSlide("badge", e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-obsidian p-2 text-xs text-ink"
                  />
                </div>

                <div>
                  <label className="block text-micro font-semibold text-muted mb-1">
                    Judul Utama Slide
                  </label>
                  <textarea
                    rows={2}
                    value={slides[currentIdx].title || ""}
                    onChange={(e) => handleUpdateCurrentSlide("title", e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-obsidian p-2 text-xs font-bold text-ink resize-y"
                  />
                </div>

                <div>
                  <label className="block text-micro font-semibold text-muted mb-1">
                    Isi Teks / Penjelasan
                  </label>
                  <textarea
                    rows={3}
                    value={slides[currentIdx].body || ""}
                    onChange={(e) => handleUpdateCurrentSlide("body", e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-obsidian p-2 text-xs text-ink resize-y"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Live Canvas Preview (5 cols) */}
        <div className="flex flex-col items-center justify-center lg:col-span-5 space-y-3">
          <div className="relative w-full max-w-[320px] rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-black">
            <canvas
              ref={canvasRef}
              className="w-full h-auto object-contain block"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs text-ink disabled:opacity-30 hover:border-ember/40"
            >
              ← Sebelumnya
            </button>
            <span className="text-micro font-mono text-muted">
              {currentIdx + 1} / {slides.length}
            </span>
            <button
              type="button"
              disabled={currentIdx === slides.length - 1}
              onClick={() => setCurrentIdx((p) => Math.min(slides.length - 1, p + 1))}
              className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs text-ink disabled:opacity-30 hover:border-ember/40"
            >
              Berikutnya →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
