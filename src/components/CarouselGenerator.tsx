"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export type SlideTheme = "obsidian" | "midnight" | "noir" | "emerald" | "sunset" | "porcelain";
export type SlideRatio = "4:5" | "1:1" | "9:16";
export type FontPairing = "modern" | "editorial" | "impact" | "tech";
export type SlideType = "cover" | "point" | "stat" | "cta";

export interface SlideData {
  id: string;
  type: SlideType;
  badge?: string;
  title: string;
  body: string;
  stat_number?: string;
  stat_label?: string;
  footer?: string;
}

const DEFAULT_SLIDES: SlideData[] = [
  {
    id: "slide-1",
    type: "cover",
    badge: "STRATEGI KONTEN",
    title: "3 Kesalahan Fatal Bikin Video Sulit FYP & Sepi Penonton",
    body: "Kebiasaan sepele yang diam-diam bikin algoritma nahan views akun lo dan keranjang kuning gak tersentuh.",
    footer: "Geser ke samping ➔",
  },
  {
    id: "slide-2",
    type: "point",
    badge: "KESALAHAN #01",
    title: "Buka Video dengan Basa-Basi & Salam",
    body: "3 Detik pertama adalah medan pertempuran retensi. Hindari 'Halo guys kembali lagi...', langsung tembak rasa sakit atau masalah audiens.",
    footer: "Slide 2 dari 5",
  },
  {
    id: "slide-3",
    type: "stat",
    badge: "FAKTA ALGORITMA",
    title: "Retensi 3 Detik Menentukan 80% Distribusi",
    body: "Jika penonton swipe away di detik ke-2, algoritma langsung menghentikan distribusi video ke feed audiens baru.",
    stat_number: "87%",
    stat_label: "Penonton swipe away karena hook lambat",
    footer: "Slide 3 dari 5",
  },
  {
    id: "slide-4",
    type: "point",
    badge: "SOLUSI PRAKTIS",
    title: "Terapkan Formula Hook Pattern Interrupt",
    body: "Gunakan kontradiksi, aksi visual mendadak, atau pertanyaan paradoks untuk memaksa otak penonton berhenti scrolling.",
    footer: "Slide 4 dari 5",
  },
  {
    id: "slide-5",
    type: "cta",
    badge: "KESIMPULAN",
    title: "Siap Bikin Konten Berkualitas Tinggi Otomatis?",
    body: "Gunakan Malesan AI untuk riset ide, racik hook tajam, dan susun skrip video dalam hitungan detik tanpa pusing.",
    footer: "Simpan & bagikan postingan ini ✨",
  },
];

const THEMES: { id: SlideTheme; name: string; desc: string; accent: string; bg: string; border: string }[] = [
  {
    id: "obsidian",
    name: "Obsidian Ember",
    desc: "Malesan Signature Carbon & Glowing Amber",
    accent: "#f26222",
    bg: "#09090b",
    border: "border-ember/40",
  },
  {
    id: "midnight",
    name: "Midnight Cyber",
    desc: "Electric Cyan & Neon Deep Slate",
    accent: "#06b6d4",
    bg: "#040714",
    border: "border-cyan-500/40",
  },
  {
    id: "noir",
    name: "Editorial Noir",
    desc: "High-Fashion Monochrome & Champagne Gold",
    accent: "#e2d4b7",
    bg: "#000000",
    border: "border-amber-200/40",
  },
  {
    id: "emerald",
    name: "Emerald Velvet",
    desc: "Forest Green & Luminous Mint",
    accent: "#10b981",
    bg: "#031610",
    border: "border-emerald-500/40",
  },
  {
    id: "sunset",
    name: "Sunset Neon",
    desc: "Vibrant Coral & Rose Glow",
    accent: "#f97316",
    bg: "#14050e",
    border: "border-rose-500/40",
  },
  {
    id: "porcelain",
    name: "Clean Porcelain",
    desc: "Minimalist Studio White & Charcoal Ink",
    accent: "#0f172a",
    bg: "#fafafa",
    border: "border-neutral-300",
  },
];

const PROMPT_SUGGESTIONS = [
  "3 Kesalahan Fatal Bikin Konten Sepi",
  "Framework 10x Produktivitas Kreator",
  "Rahasia Hook 3 Detik FYP TikTok",
  "Cara Jualan Affiliate Tanpa Hard-Selling",
  "Mindset Mengubah 100 Followers Jadi Pembeli",
];

export function CarouselGenerator({
  initialTitle,
  initialText,
  cost = 3,
  credits = 0,
}: {
  initialTitle?: string;
  initialText?: string;
  cost?: number;
  credits?: number;
}) {
  const router = useRouter();

  // State
  const [slides, setSlides] = useState<SlideData[]>(() => {
    if (initialTitle) {
      return [
        {
          ...DEFAULT_SLIDES[0],
          title: initialTitle,
          body: initialText ? initialText.slice(0, 140) : DEFAULT_SLIDES[0].body,
        },
        ...DEFAULT_SLIDES.slice(1),
      ];
    }
    return DEFAULT_SLIDES;
  });

  const [currentIdx, setCurrentIdx] = useState(0);
  const [theme, setTheme] = useState<SlideTheme>("obsidian");
  const [ratio, setRatio] = useState<SlideRatio>("4:5");
  const [fontPairing, setFontPairing] = useState<FontPairing>("modern");
  const [authorName, setAuthorName] = useState("Malesan Creator");
  const [creatorTag, setCreatorTag] = useState("@malesan_creator");
  const [showVerified, setShowVerified] = useState(true);
  const [showSwipePrompt, setShowSwipePrompt] = useState(true);

  // AI Generator state
  const [aiTopic, setAiTopic] = useState("");
  const [slideCount, setSlideCount] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [postCaption, setPostCaption] = useState("");
  const [postHashtags, setPostHashtags] = useState<string[]>([]);
  const [copiedCaption, setCopiedCaption] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Helper to wrap text into multiple lines in canvas
  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && i > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  };

  // High-Resolution 2D Canvas Slide Renderer
  const renderSlideToCanvas = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      slide: SlideData,
      slideIndex: number,
      totalSlides: number,
      width: number,
      height: number,
      targetTheme: SlideTheme,
      targetFont: FontPairing,
      author: string,
      tag: string,
      isVerified: boolean,
      hasSwipePrompt: boolean,
    ) => {
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      const isLight = targetTheme === "porcelain";
      const isCover = slide.type === "cover";
      const isStat = slide.type === "stat";
      const isCta = slide.type === "cta";

      // 1. Background Styling & Atmospheric Lighting
      if (targetTheme === "obsidian") {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#0a0a0d");
        bgGrad.addColorStop(0.5, "#101014");
        bgGrad.addColorStop(1, "#150e0a");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Ambient Ember Glow
        const glow = ctx.createRadialGradient(
          width * 0.85,
          height * 0.18,
          60,
          width * 0.85,
          height * 0.18,
          width * 0.75,
        );
        glow.addColorStop(0, "rgba(242, 98, 34, 0.22)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        // Secondary subtle bottom glow
        const glow2 = ctx.createRadialGradient(
          width * 0.15,
          height * 0.85,
          40,
          width * 0.15,
          height * 0.85,
          width * 0.6,
        );
        glow2.addColorStop(0, "rgba(251, 146, 60, 0.12)");
        glow2.addColorStop(1, "transparent");
        ctx.fillStyle = glow2;
        ctx.fillRect(0, 0, width, height);
      } else if (targetTheme === "midnight") {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#040714");
        bgGrad.addColorStop(0.5, "#080f24");
        bgGrad.addColorStop(1, "#0d1636");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        const glow = ctx.createRadialGradient(
          width * 0.85,
          height * 0.2,
          50,
          width * 0.85,
          height * 0.2,
          width * 0.7,
        );
        glow.addColorStop(0, "rgba(6, 182, 212, 0.24)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      } else if (targetTheme === "noir") {
        ctx.fillStyle = "#050507";
        ctx.fillRect(0, 0, width, height);

        // Minimalist Champagne vignette
        const glow = ctx.createRadialGradient(
          width * 0.5,
          height * 0.5,
          width * 0.2,
          width * 0.5,
          height * 0.5,
          width * 0.8,
        );
        glow.addColorStop(0, "rgba(226, 212, 183, 0.06)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      } else if (targetTheme === "emerald") {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#02130e");
        bgGrad.addColorStop(0.6, "#05261c");
        bgGrad.addColorStop(1, "#021510");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        const glow = ctx.createRadialGradient(
          width * 0.85,
          height * 0.2,
          60,
          width * 0.85,
          height * 0.2,
          width * 0.75,
        );
        glow.addColorStop(0, "rgba(16, 185, 129, 0.22)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      } else if (targetTheme === "sunset") {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#13050c");
        bgGrad.addColorStop(0.5, "#220817");
        bgGrad.addColorStop(1, "#2e0c1a");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        const glow = ctx.createRadialGradient(
          width * 0.85,
          height * 0.2,
          60,
          width * 0.85,
          height * 0.2,
          width * 0.75,
        );
        glow.addColorStop(0, "rgba(249, 115, 22, 0.24)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      } else {
        // Porcelain Studio Light
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#fbfbfb");
        bgGrad.addColorStop(1, "#f2f4f7");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Color Palette & Typography Configuration
      let accentColor = "#f26222";
      let badgeBg = "rgba(242, 98, 34, 0.16)";
      let badgeBorder = "rgba(242, 98, 34, 0.35)";
      let primaryTextColor = "#ffffff";
      let secondaryTextColor = "#a1a1aa";
      let cardBg = "rgba(20, 20, 26, 0.55)";
      let cardBorder = "rgba(255, 255, 255, 0.08)";

      if (targetTheme === "midnight") {
        accentColor = "#06b6d4";
        badgeBg = "rgba(6, 182, 212, 0.16)";
        badgeBorder = "rgba(6, 182, 212, 0.35)";
        primaryTextColor = "#ffffff";
        secondaryTextColor = "#94a3b8";
        cardBg = "rgba(10, 18, 40, 0.55)";
        cardBorder = "rgba(6, 182, 212, 0.15)";
      } else if (targetTheme === "noir") {
        accentColor = "#e2d4b7";
        badgeBg = "rgba(226, 212, 183, 0.12)";
        badgeBorder = "rgba(226, 212, 183, 0.3)";
        primaryTextColor = "#ffffff";
        secondaryTextColor = "#a3a3a3";
        cardBg = "rgba(18, 18, 22, 0.6)";
        cardBorder = "rgba(226, 212, 183, 0.15)";
      } else if (targetTheme === "emerald") {
        accentColor = "#10b981";
        badgeBg = "rgba(16, 185, 129, 0.16)";
        badgeBorder = "rgba(16, 185, 129, 0.35)";
        primaryTextColor = "#ffffff";
        secondaryTextColor = "#9ca3af";
        cardBg = "rgba(5, 32, 24, 0.55)";
        cardBorder = "rgba(16, 185, 129, 0.15)";
      } else if (targetTheme === "sunset") {
        accentColor = "#f97316";
        badgeBg = "rgba(249, 115, 22, 0.16)";
        badgeBorder = "rgba(249, 115, 22, 0.35)";
        primaryTextColor = "#ffffff";
        secondaryTextColor = "#cbd5e1";
        cardBg = "rgba(35, 10, 24, 0.55)";
        cardBorder = "rgba(249, 115, 22, 0.15)";
      } else if (targetTheme === "porcelain") {
        accentColor = "#0f172a";
        badgeBg = "rgba(15, 23, 42, 0.08)";
        badgeBorder = "rgba(15, 23, 42, 0.18)";
        primaryTextColor = "#09090b";
        secondaryTextColor = "#4b5563";
        cardBg = "rgba(255, 255, 255, 0.85)";
        cardBorder = "rgba(0, 0, 0, 0.08)";
      }

      // Font stack based on pairing
      let headerFontFamily = "system-ui, -apple-system, sans-serif";
      let bodyFontFamily = "system-ui, -apple-system, sans-serif";

      if (targetFont === "editorial") {
        headerFontFamily = "'Playfair Display', Georgia, 'Times New Roman', serif";
        bodyFontFamily = "system-ui, -apple-system, sans-serif";
      } else if (targetFont === "impact") {
        headerFontFamily = "'Syne', 'Arial Black', Impact, sans-serif";
        bodyFontFamily = "system-ui, -apple-system, sans-serif";
      } else if (targetFont === "tech") {
        headerFontFamily = "'JetBrains Mono', 'Courier New', monospace";
        bodyFontFamily = "system-ui, -apple-system, sans-serif";
      }

      const paddingX = width * 0.085;
      const contentWidth = width - paddingX * 2;
      let cursorY = height * 0.095;

      // 3. Top Header Bar: Author Avatar & Brand Tag
      const avatarSize = width * 0.052;
      const avatarX = paddingX;
      const avatarY = cursorY;

      // Avatar circle with border
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();
      ctx.restore();

      // Avatar initials text
      ctx.fillStyle = isLight ? "#ffffff" : "#09090b";
      ctx.font = `bold ${avatarSize * 0.48}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const initialLetters = (author || "M").slice(0, 2).toUpperCase();
      ctx.fillText(initialLetters, avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1);

      // Author Name & Handle
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = `bold ${width * 0.03}px ${bodyFontFamily}`;
      ctx.fillStyle = primaryTextColor;
      ctx.fillText(author || "Malesan Creator", avatarX + avatarSize + 16, avatarY + avatarSize * 0.45);

      // Verified checkmark icon
      if (isVerified) {
        const authorTextWidth = ctx.measureText(author || "Malesan Creator").width;
        const iconX = avatarX + avatarSize + 22 + authorTextWidth;
        const iconY = avatarY + avatarSize * 0.32;
        const iconR = width * 0.012;

        ctx.save();
        ctx.beginPath();
        ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2);
        ctx.fillStyle = accentColor;
        ctx.fill();
        ctx.restore();

        // Checkmark tick
        ctx.strokeStyle = isLight ? "#ffffff" : "#09090b";
        ctx.lineWidth = width * 0.003;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(iconX - iconR * 0.4, iconY);
        ctx.lineTo(iconX - iconR * 0.1, iconY + iconR * 0.4);
        ctx.lineTo(iconX + iconR * 0.45, iconY - iconR * 0.35);
        ctx.stroke();
      }

      // Creator Handle
      ctx.font = `normal ${width * 0.024}px ${bodyFontFamily}`;
      ctx.fillStyle = secondaryTextColor;
      ctx.fillText(tag || "@malesan_creator", avatarX + avatarSize + 16, avatarY + avatarSize * 0.88);

      // Top Slide Counter Tag (Right aligned)
      ctx.textAlign = "right";
      ctx.font = `bold ${width * 0.028}px sans-serif`;
      ctx.fillStyle = secondaryTextColor;
      ctx.fillText(`${slideIndex + 1} / ${totalSlides}`, width - paddingX, avatarY + avatarSize * 0.65);

      cursorY += avatarSize + height * 0.065;

      // 4. Badge Pill (Category or Step indicator)
      if (slide.badge) {
        ctx.textAlign = "left";
        const badgeText = slide.badge.toUpperCase();
        ctx.font = `bold ${width * 0.026}px sans-serif`;
        const badgeMetrics = ctx.measureText(badgeText);
        const pillWidth = badgeMetrics.width + width * 0.045;
        const pillHeight = width * 0.055;

        // Pill shape with border
        ctx.save();
        ctx.fillStyle = badgeBg;
        ctx.strokeStyle = badgeBorder;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(paddingX, cursorY, pillWidth, pillHeight, pillHeight / 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Pill Text
        ctx.fillStyle = accentColor;
        ctx.fillText(badgeText, paddingX + (pillWidth - badgeMetrics.width) / 2, cursorY + pillHeight * 0.68);

        cursorY += pillHeight + height * 0.038;
      }

      // 5. Main Focal Content Rendering based on Slide Type
      if (isCover) {
        // --- COVER SLIDE: Huge Hook Headline + Subtitle ---
        ctx.fillStyle = primaryTextColor;
        const titleFontSize = width * 0.076;
        ctx.font = `bold ${titleFontSize}px ${headerFontFamily}`;
        const titleLineHeight = titleFontSize * 1.25;

        const titleLines = wrapText(ctx, slide.title, contentWidth);
        for (const line of titleLines) {
          ctx.fillText(line, paddingX, cursorY);
          cursorY += titleLineHeight;
        }

        cursorY += height * 0.03;

        // Decorative Accent Line
        ctx.save();
        const lineGrad = ctx.createLinearGradient(paddingX, 0, paddingX + width * 0.25, 0);
        lineGrad.addColorStop(0, accentColor);
        lineGrad.addColorStop(1, "transparent");
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(paddingX, cursorY);
        ctx.lineTo(paddingX + width * 0.35, cursorY);
        ctx.stroke();
        ctx.restore();

        cursorY += height * 0.045;

        // Subtitle / Body text
        ctx.fillStyle = secondaryTextColor;
        const bodyFontSize = width * 0.04;
        ctx.font = `normal ${bodyFontSize}px ${bodyFontFamily}`;
        const bodyLineHeight = bodyFontSize * 1.45;

        const bodyLines = wrapText(ctx, slide.body, contentWidth);
        for (const line of bodyLines) {
          ctx.fillText(line, paddingX, cursorY);
          cursorY += bodyLineHeight;
        }
      } else if (isStat) {
        // --- STAT SLIDE: Huge Focal Statistic Metric ---
        ctx.fillStyle = primaryTextColor;
        const titleFontSize = width * 0.062;
        ctx.font = `bold ${titleFontSize}px ${headerFontFamily}`;
        const titleLineHeight = titleFontSize * 1.25;

        const titleLines = wrapText(ctx, slide.title, contentWidth);
        for (const line of titleLines) {
          ctx.fillText(line, paddingX, cursorY);
          cursorY += titleLineHeight;
        }

        cursorY += height * 0.04;

        // Giant Stat Box Card
        const statCardHeight = height * 0.26;
        ctx.save();
        ctx.fillStyle = cardBg;
        ctx.strokeStyle = cardBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(paddingX, cursorY, contentWidth, statCardHeight, 28);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Massive Focal Number
        const statNum = slide.stat_number || "85%";
        ctx.fillStyle = accentColor;
        ctx.font = `bold ${width * 0.14}px ${headerFontFamily}`;
        ctx.textAlign = "center";
        ctx.fillText(statNum, width / 2, cursorY + statCardHeight * 0.52);

        // Stat Label
        const statLbl = slide.stat_label || "Penonton memutuskan di 3 detik pertama";
        ctx.fillStyle = primaryTextColor;
        ctx.font = `bold ${width * 0.032}px ${bodyFontFamily}`;
        ctx.fillText(statLbl, width / 2, cursorY + statCardHeight * 0.78);

        ctx.textAlign = "left";
        cursorY += statCardHeight + height * 0.04;

        // Body explanation below card
        ctx.fillStyle = secondaryTextColor;
        const bodyFontSize = width * 0.038;
        ctx.font = `normal ${bodyFontSize}px ${bodyFontFamily}`;
        const bodyLineHeight = bodyFontSize * 1.45;

        const bodyLines = wrapText(ctx, slide.body, contentWidth);
        for (const line of bodyLines) {
          ctx.fillText(line, paddingX, cursorY);
          cursorY += bodyLineHeight;
        }
      } else if (isCta) {
        // --- CTA SLIDE: Actionable Conclusion & Profile Highlight ---
        ctx.fillStyle = primaryTextColor;
        const titleFontSize = width * 0.068;
        ctx.font = `bold ${titleFontSize}px ${headerFontFamily}`;
        const titleLineHeight = titleFontSize * 1.25;

        const titleLines = wrapText(ctx, slide.title, contentWidth);
        for (const line of titleLines) {
          ctx.fillText(line, paddingX, cursorY);
          cursorY += titleLineHeight;
        }

        cursorY += height * 0.035;

        // CTA Card Highlight
        const ctaCardHeight = height * 0.32;
        ctx.save();
        ctx.fillStyle = cardBg;
        ctx.strokeStyle = cardBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(paddingX, cursorY, contentWidth, ctaCardHeight, 28);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        const cardPadding = width * 0.06;
        let cardCursorY = cursorY + cardPadding * 1.1;

        // Body instructions inside card
        ctx.fillStyle = primaryTextColor;
        const bodyFontSize = width * 0.038;
        ctx.font = `normal ${bodyFontSize}px ${bodyFontFamily}`;
        const bodyLineHeight = bodyFontSize * 1.45;

        const bodyLines = wrapText(ctx, slide.body, contentWidth - cardPadding * 2);
        for (const line of bodyLines) {
          ctx.fillText(line, paddingX + cardPadding, cardCursorY);
          cardCursorY += bodyLineHeight;
        }

        // Profile Plug Bar inside card bottom
        const plugY = cursorY + ctaCardHeight - width * 0.09;
        ctx.save();
        ctx.fillStyle = badgeBg;
        ctx.strokeStyle = badgeBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(
          paddingX + cardPadding,
          plugY,
          contentWidth - cardPadding * 2,
          width * 0.065,
          12,
        );
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = accentColor;
        ctx.font = `bold ${width * 0.028}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(
          `Follow ${tag} untuk insight konten harian`,
          width / 2,
          plugY + width * 0.042,
        );
        ctx.textAlign = "left";
      } else {
        // --- STANDARD POINT / INSIGHT SLIDE ---
        ctx.fillStyle = primaryTextColor;
        const titleFontSize = width * 0.064;
        ctx.font = `bold ${titleFontSize}px ${headerFontFamily}`;
        const titleLineHeight = titleFontSize * 1.25;

        const titleLines = wrapText(ctx, slide.title, contentWidth);
        for (const line of titleLines) {
          ctx.fillText(line, paddingX, cursorY);
          cursorY += titleLineHeight;
        }

        cursorY += height * 0.035;

        // Card Container for Body Insight
        const bodyCardHeight = height * 0.35;
        ctx.save();
        ctx.fillStyle = cardBg;
        ctx.strokeStyle = cardBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(paddingX, cursorY, contentWidth, bodyCardHeight, 28);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        const cardPadding = width * 0.06;
        let cardCursorY = cursorY + cardPadding * 1.1;

        ctx.fillStyle = secondaryTextColor;
        const bodyFontSize = width * 0.039;
        ctx.font = `normal ${bodyFontSize}px ${bodyFontFamily}`;
        const bodyLineHeight = bodyFontSize * 1.5;

        const bodyLines = wrapText(ctx, slide.body, contentWidth - cardPadding * 2);
        for (const line of bodyLines) {
          ctx.fillText(line, paddingX + cardPadding, cardCursorY);
          cardCursorY += bodyLineHeight;
        }
      }

      // 6. Bottom Footer Bar (Swipe callout & Branding)
      const footerY = height * 0.93;

      // Bottom Hairline separator
      ctx.save();
      ctx.strokeStyle = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(paddingX, footerY - height * 0.025);
      ctx.lineTo(width - paddingX, footerY - height * 0.025);
      ctx.stroke();
      ctx.restore();

      // Footer note / Swipe Prompt
      if (hasSwipePrompt) {
        ctx.fillStyle = accentColor;
        ctx.font = `bold ${width * 0.028}px sans-serif`;
        ctx.textAlign = "left";
        ctx.fillText(slide.footer || "Geser ke samping ➔", paddingX, footerY);
      }

      // Branding tag on bottom right
      ctx.textAlign = "right";
      ctx.fillStyle = secondaryTextColor;
      ctx.font = `bold ${width * 0.026}px sans-serif`;
      ctx.fillText(tag || "@malesan", width - paddingX, footerY);

      ctx.restore();
    },
    [],
  );

  // Redraw preview canvas whenever state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = 1080;
    let height = 1350;
    if (ratio === "1:1") height = 1080;
    if (ratio === "9:16") height = 1920;

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
      fontPairing,
      authorName,
      creatorTag,
      showVerified,
      showSwipePrompt,
    );
  }, [
    slides,
    currentIdx,
    theme,
    ratio,
    fontPairing,
    authorName,
    creatorTag,
    showVerified,
    showSwipePrompt,
    renderSlideToCanvas,
  ]);

  // AI Generation Handler (Calls /api/generate with module: 'carousel')
  const handleGenerateAI = async () => {
    if (!aiTopic.trim()) {
      alert("Masukkan topik atau ide konten carousel terlebih dahulu.");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress("Menghubungi AI Studio...");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "carousel",
          input: {
            topic: aiTopic.trim(),
            slide_count: String(slideCount),
          },
          platform: "instagram",
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Gagal membuat konten carousel.");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = "";
      let finalJson: {
        topic_title?: string;
        slides?: Array<{
          type: SlideType;
          badge?: string;
          title: string;
          body: string;
          stat_number?: string;
          stat_label?: string;
          footer?: string;
        }>;
        caption?: string;
        hashtags?: string[];
      } | null = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split("\n");
          streamBuffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.replace("data: ", "").trim();
              if (!dataStr) continue;

              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.status) {
                  setGenerationProgress(parsed.status);
                }
                if (parsed.output && parsed.output.slides) {
                  finalJson = parsed.output;
                }
              } catch {
                // partial chunk
              }
            }
          }
        }
      }

      if (finalJson && finalJson.slides && finalJson.slides.length > 0) {
        const newSlides: SlideData[] = finalJson.slides.map((s, idx) => ({
          id: `ai-slide-${idx + 1}-${Date.now()}`,
          type: (s.type || (idx === 0 ? "cover" : idx === finalJson!.slides!.length - 1 ? "cta" : "point")) as SlideType,
          badge: s.badge || (idx === 0 ? "TIPS KONTEN" : `POIN #${idx}`),
          title: s.title || "Judul Slide",
          body: s.body || "",
          stat_number: s.stat_number,
          stat_label: s.stat_label,
          footer: s.footer || `Slide ${idx + 1} dari ${finalJson!.slides!.length}`,
        }));

        setSlides(newSlides);
        setCurrentIdx(0);
        if (finalJson.caption) setPostCaption(finalJson.caption);
        if (finalJson.hashtags) setPostHashtags(finalJson.hashtags);
        router.refresh();
      }
    } catch (err: unknown) {
      console.error("AI Carousel Error:", err);
      alert(err instanceof Error ? err.message : "Terjadi kendala saat generate carousel.");
    } finally {
      setIsGenerating(false);
      setGenerationProgress("");
    }
  };

  // Export Single Slide (.PNG)
  const handleExportSingle = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    const titleSlug = (slides[currentIdx]?.title || "slide").slice(0, 25).replace(/[^a-zA-Z0-9]/g, "_");
    a.download = `slide_${currentIdx + 1}_${titleSlug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Export All Slides (.PNG sequentially)
  const handleExportAll = async () => {
    setIsExporting(true);
    const width = 1080;
    let height = 1350;
    if (ratio === "1:1") height = 1080;
    if (ratio === "9:16") height = 1920;

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
          fontPairing,
          authorName,
          creatorTag,
          showVerified,
          showSwipePrompt,
        );

        const dataUrl = offscreen.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        const titleSlug = (slides[i]?.title || "slide").slice(0, 20).replace(/[^a-zA-Z0-9]/g, "_");
        a.download = `slide_${String(i + 1).padStart(2, "0")}_${titleSlug}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        await new Promise((r) => setTimeout(r, 220));
      }
    } catch (err) {
      console.error("Export error", err);
      alert("Gagal mengunduh gambar slide.");
    } finally {
      setIsExporting(false);
      setExportProgress("");
    }
  };

  // Copy Post Caption
  const handleCopyCaption = () => {
    let textToCopy = postCaption;
    if (!textToCopy) {
      // Build auto caption from slides
      textToCopy = `${slides[0]?.title || "Tips Hari Ini"}\n\n`;
      slides.slice(1, -1).forEach((s, idx) => {
        textToCopy += `📌 ${idx + 1}. ${s.title}\n${s.body}\n\n`;
      });
      textToCopy += `👉 ${slides[slides.length - 1]?.body || "Follow untuk tips lainnya!"}\n\n`;
      textToCopy += postHashtags.length > 0 ? postHashtags.map((h) => `#${h}`).join(" ") : "#malesan #tipscreator #carouseltips";
    }

    navigator.clipboard.writeText(textToCopy);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  // Slide CRUD Operations
  const handleUpdateSlide = (field: keyof SlideData, val: string) => {
    setSlides((prev) =>
      prev.map((s, idx) => (idx === currentIdx ? { ...s, [field]: val } : s)),
    );
  };

  const handleAddSlide = () => {
    const newSlide: SlideData = {
      id: `slide-${Date.now()}`,
      type: "point",
      badge: `POIN #${slides.length}`,
      title: "Judul Poin Tambahan",
      body: "Tuliskan penjelasan tajam dan solusi konkret di sini agar nyaman dibaca di layar HP.",
      footer: `Slide ${slides.length + 1} dari ${slides.length + 1}`,
    };
    setSlides((prev) => [...prev, newSlide]);
    setCurrentIdx(slides.length);
  };

  const handleDeleteSlide = (idxToDelete: number) => {
    if (slides.length <= 2) {
      alert("Carousel minimal harus memiliki 2 slide.");
      return;
    }
    setSlides((prev) => prev.filter((_, idx) => idx !== idxToDelete));
    setCurrentIdx((prev) => Math.min(prev, slides.length - 2));
  };

  const handleDuplicateSlide = (idxToDup: number) => {
    const target = slides[idxToDup];
    if (!target) return;
    const duplicated: SlideData = {
      ...target,
      id: `slide-dup-${Date.now()}`,
      title: `${target.title} (Salinan)`,
    };
    const nextSlides = [...slides];
    nextSlides.splice(idxToDup + 1, 0, duplicated);
    setSlides(nextSlides);
    setCurrentIdx(idxToDup + 1);
  };

  const handleMoveSlide = (fromIdx: number, direction: "left" | "right") => {
    const toIdx = direction === "left" ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= slides.length) return;
    const nextSlides = [...slides];
    const temp = nextSlides[fromIdx];
    nextSlides[fromIdx] = nextSlides[toIdx];
    nextSlides[toIdx] = temp;
    setSlides(nextSlides);
    setCurrentIdx(toIdx);
  };

  return (
    <div className="space-y-6">
      {/* 1. LUXURY FLAGSHIP HEADER */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.12] bg-gradient-to-br from-surface-raised via-[#101014] to-[#0a0a0d] p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-ember/15 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-3 py-1 text-micro font-bold uppercase tracking-wider text-ember">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M7 3v18" />
                <path d="M17 3v18" />
              </svg>
              <span>AI Carousel &amp; Slide Studio</span>
              <span className="h-1 w-1 rounded-full bg-ember" />
              <span>Biaya: {cost} Kredit</span>
              {typeof credits === "number" && (
                <>
                  <span className="h-1 w-1 rounded-full bg-ember/60" />
                  <span className="text-muted">Saldo: {credits}</span>
                </>
              )}
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-ink">
              Bikin Slide Card Instagram &amp; LinkedIn Kelas Agency
            </h1>
            <p className="text-xs sm:text-sm text-muted max-w-2xl leading-relaxed">
              Ubah ide mentah jadi rangkaian slide visual beresolusi tinggi (1080×1350) siap download PNG dengan 6 tema mewah.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyCaption}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-surface px-4 text-xs font-bold text-ink transition-all hover:border-white/[0.25] hover:bg-surface-raised active:scale-95 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 text-ember">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
              <span>{copiedCaption ? "Caption Disalin! ✓" : "Salin Caption Post"}</span>
            </button>

            <button
              type="button"
              onClick={handleExportAll}
              disabled={isExporting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-ember px-5 font-display text-xs font-bold text-obsidian shadow-lg shadow-ember/20 transition-all hover:bg-ember-lo active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              <span>{isExporting ? exportProgress : "Download Semua Slide (.PNG)"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN STUDIO WORKSPACE */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Controls & Precision Slide Editor (7 cols) */}
        <div className="space-y-5 lg:col-span-7">
          {/* A. 🪄 1-CLICK AI CAROUSEL MAGIC */}
          <div className="rounded-2xl border border-ember/35 bg-gradient-to-b from-[#131114] to-[#09090b] p-4 sm:p-5 shadow-lg space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-ember/15 text-ember">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-ink">
                    1-Click AI Carousel Generator
                  </h3>
                  <p className="text-micro text-muted">
                    Ketik topik atau ide, AI akan otomatis menyusun narasi lengkap {slideCount} slide.
                  </p>
                </div>
              </div>

              <span className="rounded-md bg-surface px-2.5 py-1 font-mono text-micro font-bold text-ember border border-hairline">
                {cost} Kredit
              </span>
            </div>

            <div className="space-y-2">
              <textarea
                rows={2}
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Contoh: 3 kesalahan fatal pemula saat jualan online di TikTok Shop..."
                className="w-full rounded-xl border border-white/[0.1] bg-obsidian px-4 py-3 text-xs sm:text-sm text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember resize-none"
              />

              {/* Suggestions chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-muted">Inspirasi:</span>
                {PROMPT_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setAiTopic(sug)}
                    className="rounded-lg border border-white/[0.08] bg-surface px-2.5 py-1 text-[11px] text-muted hover:border-ember/40 hover:text-ink transition-all cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-micro font-bold uppercase text-muted">Jumlah Slide:</span>
                <div className="inline-flex rounded-xl border border-white/[0.1] bg-surface p-0.5">
                  {[4, 5, 6, 7].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSlideCount(num)}
                      className={`rounded-lg px-3 py-1 text-xs font-mono font-bold transition-all cursor-pointer ${
                        slideCount === num ? "bg-ember text-obsidian shadow-xs" : "text-muted hover:text-ink"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={isGenerating || !aiTopic.trim()}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-ember px-5 font-display text-xs font-bold text-obsidian shadow-md transition-all hover:bg-ember-lo active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <span className="size-3.5 animate-spin rounded-full border-2 border-obsidian border-t-transparent" />
                    <span>{generationProgress || "Menyusun Narasi..."}</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span>Bikin Carousel Otomatis ➔</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* B. 🎨 6 LUXURY DESIGNER THEME PRESETS */}
          <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted">
                Pilih Tema Visual &amp; Karakter Desain
              </h3>
              <span className="text-micro text-ember font-semibold font-mono">
                {THEMES.find((t) => t.id === theme)?.name}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`group relative flex flex-col rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    theme === t.id
                      ? `${t.border} bg-surface-raised ring-2 ring-ember/25 shadow-md`
                      : "border-white/[0.08] bg-[#09090b] hover:border-white/[0.18]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="size-3.5 rounded-full border border-white/20 shadow-xs"
                      style={{ backgroundColor: t.accent }}
                    />
                    {theme === t.id && (
                      <span className="size-1.5 rounded-full bg-ember animate-pulse" />
                    )}
                  </div>
                  <span className="mt-2 text-xs font-bold text-ink group-hover:text-ember transition-colors">
                    {t.name}
                  </span>
                  <span className="mt-0.5 text-[10px] text-muted line-clamp-1 leading-tight">
                    {t.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* C. 📐 FORMAT RASIO, TIPOGRAFI & BRANDING */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
            {/* Format Rasio */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted">
                Format Rasio Kanvas
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "4:5", label: "4:5 Portrait", sub: "Instagram" },
                  { id: "1:1", label: "1:1 Square", sub: "LinkedIn/Feed" },
                  { id: "9:16", label: "9:16 Story", sub: "Reels/TikTok" },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRatio(r.id as SlideRatio)}
                    className={`flex flex-col items-center justify-center rounded-xl border py-2 px-1 text-center transition-all cursor-pointer ${
                      ratio === r.id
                        ? "border-ember/50 bg-ember/15 text-ember shadow-xs"
                        : "border-white/[0.08] bg-[#09090b] text-muted hover:text-ink"
                    }`}
                  >
                    <span className="text-xs font-bold">{r.label}</span>
                    <span className="text-[10px] opacity-70">{r.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tipografi Pairing */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted">
                Karakter Tipografi
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "modern", label: "Modern Sans", sub: "Clean & High Legibility" },
                  { id: "editorial", label: "Editorial Serif", sub: "Luxury High-Fashion" },
                  { id: "impact", label: "Impact Bold", sub: "Punchy Viral Statement" },
                  { id: "tech", label: "Tech Mono", sub: "Developer & Metrics" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFontPairing(f.id as FontPairing)}
                    className={`flex flex-col rounded-xl border p-2 text-left transition-all cursor-pointer ${
                      fontPairing === f.id
                        ? "border-ember/50 bg-ember/15 text-ember shadow-xs"
                        : "border-white/[0.08] bg-[#09090b] text-muted hover:text-ink"
                    }`}
                  >
                    <span className="text-xs font-bold">{f.label}</span>
                    <span className="text-[10px] opacity-70 line-clamp-1">{f.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Branding Inputs */}
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-hairline">
              <div>
                <label className="block text-micro font-semibold text-muted mb-1">
                  Nama Kreator / Brand
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Nama Akun"
                  className="w-full rounded-xl border border-hairline bg-[#09090b] px-3.5 py-2 text-xs text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-micro font-semibold text-muted mb-1">
                  Username / Handle Media Sosial
                </label>
                <input
                  type="text"
                  value={creatorTag}
                  onChange={(e) => setCreatorTag(e.target.value)}
                  placeholder="@username"
                  className="w-full rounded-xl border border-hairline bg-[#09090b] px-3.5 py-2 text-xs text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 flex flex-wrap items-center gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showVerified}
                    onChange={(e) => setShowVerified(e.target.checked)}
                    className="size-4 rounded accent-ember"
                  />
                  <span>Tampilkan Badge Verified Kreator</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSwipePrompt}
                    onChange={(e) => setShowSwipePrompt(e.target.checked)}
                    className="size-4 rounded accent-ember"
                  />
                  <span>Tampilkan Teks Petunjuk Geser (Swipe ➔)</span>
                </label>
              </div>
            </div>
          </div>

          {/* D. 📝 PER-SLIDE PRECISION EDITOR */}
          <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-ember animate-pulse" />
                <span className="font-display text-sm font-bold text-ink">
                  Edit Slide #{currentIdx + 1} dari {slides.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDuplicateSlide(currentIdx)}
                  className="rounded-lg border border-hairline bg-[#09090b] px-2.5 py-1 text-micro font-semibold text-muted hover:text-ink cursor-pointer"
                >
                  Duplikat
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteSlide(currentIdx)}
                  className="rounded-lg border border-hairline bg-[#09090b] px-2.5 py-1 text-micro font-semibold text-danger/80 hover:bg-danger/10 hover:text-danger cursor-pointer"
                >
                  Hapus
                </button>

                <button
                  type="button"
                  onClick={handleAddSlide}
                  className="rounded-lg bg-ember px-3 py-1 text-micro font-bold text-obsidian shadow-xs hover:bg-ember-lo transition-all cursor-pointer"
                >
                  + Tambah Slide
                </button>
              </div>
            </div>

            {/* Slide Navigation Number Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5">
              {slides.map((s, idx) => (
                <button
                  key={s.id || idx}
                  type="button"
                  onClick={() => setCurrentIdx(idx)}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
                    currentIdx === idx
                      ? "bg-ember text-obsidian shadow-md ring-2 ring-ember/25"
                      : "bg-[#09090b] text-muted hover:text-ink border border-white/[0.08]"
                  }`}
                >
                  <span>#{idx + 1}</span>
                  <span className="text-[10px] font-normal uppercase opacity-75">
                    ({s.type})
                  </span>
                </button>
              ))}
            </div>

            {/* Active Slide Form Fields */}
            {slides[currentIdx] && (
              <div className="space-y-3.5 pt-1">
                {/* Slide Type Switcher */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    Tipe Layout Slide
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { id: "cover", label: "Cover Hook" },
                      { id: "point", label: "Poin / Insight" },
                      { id: "stat", label: "Fakta / Stat" },
                      { id: "cta", label: "Kesimpulan / CTA" },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleUpdateSlide("type", st.id)}
                        className={`rounded-xl border py-1.5 text-xs font-bold transition-all cursor-pointer ${
                          slides[currentIdx].type === st.id
                            ? "border-ember/50 bg-ember/15 text-ember shadow-xs"
                            : "border-white/[0.08] bg-[#09090b] text-muted hover:text-ink"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Badge Tag */}
                <div>
                  <label className="block text-micro font-semibold text-muted mb-1">
                    Label Kategori (Pill Badge Atas)
                  </label>
                  <input
                    type="text"
                    value={slides[currentIdx].badge || ""}
                    onChange={(e) => handleUpdateSlide("badge", e.target.value)}
                    placeholder="Contoh: TIPS KONTEN, POIN #1, RAHASIA"
                    className="w-full rounded-xl border border-hairline bg-[#09090b] px-3.5 py-2.5 text-xs text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none"
                  />
                </div>

                {/* Stat Special Inputs (If type === 'stat') */}
                {slides[currentIdx].type === "stat" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-ember/20 bg-ember/5">
                    <div>
                      <label className="block text-micro font-bold text-ember mb-1">
                        Angka Stat Utama
                      </label>
                      <input
                        type="text"
                        value={slides[currentIdx].stat_number || ""}
                        onChange={(e) => handleUpdateSlide("stat_number", e.target.value)}
                        placeholder="Contoh: 87%, 10x, 3 Detik"
                        className="w-full rounded-lg border border-ember/30 bg-obsidian px-3 py-2 text-sm font-bold text-ink focus:border-ember focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-micro font-bold text-ember mb-1">
                        Label Penjelas Angka
                      </label>
                      <input
                        type="text"
                        value={slides[currentIdx].stat_label || ""}
                        onChange={(e) => handleUpdateSlide("stat_label", e.target.value)}
                        placeholder="Contoh: Penonton swipe di detik pertama"
                        className="w-full rounded-lg border border-ember/30 bg-obsidian px-3 py-2 text-xs text-ink focus:border-ember focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Main Headline */}
                <div>
                  <label className="block text-micro font-semibold text-muted mb-1">
                    Judul Utama Slide
                  </label>
                  <textarea
                    rows={2}
                    value={slides[currentIdx].title || ""}
                    onChange={(e) => handleUpdateSlide("title", e.target.value)}
                    placeholder="Judul pokok poin atau hook slide..."
                    className="w-full rounded-xl border border-hairline bg-[#09090b] px-3.5 py-2.5 text-xs sm:text-sm font-bold text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none resize-none"
                  />
                </div>

                {/* Body Explanation */}
                <div>
                  <label className="block text-micro font-semibold text-muted mb-1">
                    Isi Teks / Penjelasan Poin
                  </label>
                  <textarea
                    rows={3}
                    value={slides[currentIdx].body || ""}
                    onChange={(e) => handleUpdateSlide("body", e.target.value)}
                    placeholder="Penjelasan ringkas 2-3 kalimat yang nyaman dibaca..."
                    className="w-full rounded-xl border border-hairline bg-[#09090b] px-3.5 py-2.5 text-xs text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none resize-none"
                  />
                </div>

                {/* Footer Note */}
                <div>
                  <label className="block text-micro font-semibold text-muted mb-1">
                    Teks Kaki Slide (Footer Callout)
                  </label>
                  <input
                    type="text"
                    value={slides[currentIdx].footer || ""}
                    onChange={(e) => handleUpdateSlide("footer", e.target.value)}
                    placeholder="Contoh: Geser ke samping ➔ atau Simpan postingan ini ✨"
                    className="w-full rounded-xl border border-hairline bg-[#09090b] px-3.5 py-2 text-xs text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Live HD Canvas Preview & Filmstrip Gallery (5 cols) */}
        <div className="flex flex-col items-center lg:col-span-5 space-y-4">
          {/* Main Canvas Card Display */}
          <div className="w-full flex flex-col items-center">
            <div className="relative w-full max-w-[340px] sm:max-w-[380px] rounded-3xl border border-white/[0.15] overflow-hidden shadow-2xl bg-black transition-all">
              <canvas
                ref={canvasRef}
                className="w-full h-auto object-contain block"
              />
            </div>
          </div>

          {/* Slide Navigator & Action Controls */}
          <div className="w-full max-w-[380px] flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-surface px-3 text-xs font-semibold text-ink disabled:opacity-30 hover:border-ember/40 transition-all cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Prev</span>
            </button>

            <div className="flex items-center gap-1 font-mono text-xs font-bold text-ink">
              <span className="text-ember">{currentIdx + 1}</span>
              <span className="text-muted">/</span>
              <span className="text-muted">{slides.length}</span>
            </div>

            <button
              type="button"
              disabled={currentIdx === slides.length - 1}
              onClick={() => setCurrentIdx((p) => Math.min(slides.length - 1, p + 1))}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-surface px-3 text-xs font-semibold text-ink disabled:opacity-30 hover:border-ember/40 transition-all cursor-pointer"
            >
              <span>Next</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleExportSingle}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-ember/40 bg-ember/10 px-3 text-xs font-bold text-ember hover:bg-ember/20 transition-all cursor-pointer"
              title="Download slide yang sedang aktif"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              <span>Unduh Slide</span>
            </button>
          </div>

          {/* FILMSTRIP RAIL: Multi-Slide Thumbnails */}
          <div className="w-full max-w-[380px] rounded-2xl border border-hairline bg-surface p-3.5 space-y-2">
            <div className="flex items-center justify-between text-micro font-bold uppercase tracking-wider text-muted">
              <span>Alur Urutan Slide</span>
              <span>{slides.length} Kartu Slide</span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {slides.map((s, idx) => (
                <div
                  key={s.id || idx}
                  onClick={() => setCurrentIdx(idx)}
                  className={`relative flex-shrink-0 w-16 sm:w-20 rounded-xl border p-2 cursor-pointer transition-all ${
                    currentIdx === idx
                      ? "border-ember bg-surface-raised ring-2 ring-ember/30 shadow-md"
                      : "border-white/[0.08] bg-[#09090b] hover:border-white/[0.2]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-ember">#{idx + 1}</span>
                    <span className="size-1 rounded-full bg-muted" />
                  </div>
                  <p className="mt-1 text-[9px] font-bold text-ink line-clamp-2 leading-tight">
                    {s.title || "Slide"}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[8px] text-muted">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveSlide(idx, "left");
                      }}
                      className="hover:text-ink disabled:opacity-20 cursor-pointer"
                    >
                      ◀
                    </button>
                    <span className="uppercase">{s.type.slice(0, 3)}</span>
                    <button
                      type="button"
                      disabled={idx === slides.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveSlide(idx, "right");
                      }}
                      className="hover:text-ink disabled:opacity-20 cursor-pointer"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
