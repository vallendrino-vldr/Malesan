"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export type SlideTheme = "obsidian" | "midnight" | "noir" | "emerald" | "sunset" | "porcelain";
export type SlideRatio = "4:5" | "1:1" | "9:16";
export type FontPairing = "modern" | "editorial" | "impact" | "tech";
export type SlideType = "cover" | "point" | "stat" | "cta";
export type StudioTab = "content" | "design" | "brand" | "ai";

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
    border: "border-ember/50",
  },
  {
    id: "midnight",
    name: "Midnight Cyber",
    desc: "Electric Cyan & Neon Deep Slate",
    accent: "#06b6d4",
    bg: "#040714",
    border: "border-cyan-500/50",
  },
  {
    id: "noir",
    name: "Editorial Noir",
    desc: "High-Fashion Monochrome & Gold",
    accent: "#e2d4b7",
    bg: "#000000",
    border: "border-amber-200/50",
  },
  {
    id: "emerald",
    name: "Emerald Velvet",
    desc: "Forest Green & Luminous Mint",
    accent: "#10b981",
    bg: "#031610",
    border: "border-emerald-500/50",
  },
  {
    id: "sunset",
    name: "Sunset Neon",
    desc: "Vibrant Coral & Rose Glow",
    accent: "#f97316",
    bg: "#14050e",
    border: "border-rose-500/50",
  },
  {
    id: "porcelain",
    name: "Clean Porcelain",
    desc: "Minimalist Studio White & Ink",
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
  const [activeTab, setActiveTab] = useState<StudioTab>("content");
  const [mobileView, setMobileView] = useState<"preview" | "editor">("preview");

  // Style Settings
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

  // High-Resolution 2D Canvas Slide Renderer (Pixel-Perfect Mathematical Layout)
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

      // 1. Background Atmosphere & Lighting
      if (targetTheme === "obsidian") {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#09090b");
        bgGrad.addColorStop(0.5, "#101014");
        bgGrad.addColorStop(1, "#160e0a");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Radiant Ember Glow
        const glow = ctx.createRadialGradient(
          width * 0.85,
          height * 0.16,
          60,
          width * 0.85,
          height * 0.16,
          width * 0.75,
        );
        glow.addColorStop(0, "rgba(242, 98, 34, 0.24)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        const glow2 = ctx.createRadialGradient(
          width * 0.15,
          height * 0.88,
          40,
          width * 0.15,
          height * 0.88,
          width * 0.6,
        );
        glow2.addColorStop(0, "rgba(251, 146, 60, 0.12)");
        glow2.addColorStop(1, "transparent");
        ctx.fillStyle = glow2;
        ctx.fillRect(0, 0, width, height);
      } else if (targetTheme === "midnight") {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#030612");
        bgGrad.addColorStop(0.5, "#080f24");
        bgGrad.addColorStop(1, "#0c1534");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        const glow = ctx.createRadialGradient(
          width * 0.85,
          height * 0.18,
          50,
          width * 0.85,
          height * 0.18,
          width * 0.75,
        );
        glow.addColorStop(0, "rgba(6, 182, 212, 0.25)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      } else if (targetTheme === "noir") {
        ctx.fillStyle = "#040406";
        ctx.fillRect(0, 0, width, height);

        const glow = ctx.createRadialGradient(
          width * 0.5,
          height * 0.5,
          width * 0.2,
          width * 0.5,
          height * 0.5,
          width * 0.8,
        );
        glow.addColorStop(0, "rgba(226, 212, 183, 0.08)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      } else if (targetTheme === "emerald") {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#02120d");
        bgGrad.addColorStop(0.6, "#04241a");
        bgGrad.addColorStop(1, "#02140f");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        const glow = ctx.createRadialGradient(
          width * 0.85,
          height * 0.18,
          60,
          width * 0.85,
          height * 0.18,
          width * 0.75,
        );
        glow.addColorStop(0, "rgba(16, 185, 129, 0.24)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      } else if (targetTheme === "sunset") {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#12040b");
        bgGrad.addColorStop(0.5, "#200716");
        bgGrad.addColorStop(1, "#2b0a19");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        const glow = ctx.createRadialGradient(
          width * 0.85,
          height * 0.18,
          60,
          width * 0.85,
          height * 0.18,
          width * 0.75,
        );
        glow.addColorStop(0, "rgba(249, 115, 22, 0.25)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      } else {
        // Porcelain Light
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#fafafa");
        bgGrad.addColorStop(1, "#f2f4f7");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Palette Settings
      let accentColor = "#f26222";
      let badgeBg = "rgba(242, 98, 34, 0.16)";
      let badgeBorder = "rgba(242, 98, 34, 0.4)";
      let primaryTextColor = "#ffffff";
      let secondaryTextColor = "#a1a1aa";
      let cardBg = "rgba(20, 20, 26, 0.6)";
      let cardBorder = "rgba(255, 255, 255, 0.09)";

      if (targetTheme === "midnight") {
        accentColor = "#06b6d4";
        badgeBg = "rgba(6, 182, 212, 0.16)";
        badgeBorder = "rgba(6, 182, 212, 0.4)";
        primaryTextColor = "#ffffff";
        secondaryTextColor = "#94a3b8";
        cardBg = "rgba(10, 18, 40, 0.6)";
        cardBorder = "rgba(6, 182, 212, 0.18)";
      } else if (targetTheme === "noir") {
        accentColor = "#e2d4b7";
        badgeBg = "rgba(226, 212, 183, 0.14)";
        badgeBorder = "rgba(226, 212, 183, 0.35)";
        primaryTextColor = "#ffffff";
        secondaryTextColor = "#a3a3a3";
        cardBg = "rgba(18, 18, 22, 0.65)";
        cardBorder = "rgba(226, 212, 183, 0.18)";
      } else if (targetTheme === "emerald") {
        accentColor = "#10b981";
        badgeBg = "rgba(16, 185, 129, 0.16)";
        badgeBorder = "rgba(16, 185, 129, 0.4)";
        primaryTextColor = "#ffffff";
        secondaryTextColor = "#9ca3af";
        cardBg = "rgba(5, 32, 24, 0.6)";
        cardBorder = "rgba(16, 185, 129, 0.18)";
      } else if (targetTheme === "sunset") {
        accentColor = "#f97316";
        badgeBg = "rgba(249, 115, 22, 0.16)";
        badgeBorder = "rgba(249, 115, 22, 0.4)";
        primaryTextColor = "#ffffff";
        secondaryTextColor = "#cbd5e1";
        cardBg = "rgba(35, 10, 24, 0.6)";
        cardBorder = "rgba(249, 115, 22, 0.18)";
      } else if (targetTheme === "porcelain") {
        accentColor = "#0f172a";
        badgeBg = "rgba(15, 23, 42, 0.08)";
        badgeBorder = "rgba(15, 23, 42, 0.22)";
        primaryTextColor = "#09090b";
        secondaryTextColor = "#4b5563";
        cardBg = "rgba(255, 255, 255, 0.9)";
        cardBorder = "rgba(0, 0, 0, 0.1)";
      }

      // Font Family
      let headerFont = "system-ui, -apple-system, sans-serif";
      let bodyFont = "system-ui, -apple-system, sans-serif";

      if (targetFont === "editorial") {
        headerFont = "'Playfair Display', Georgia, 'Times New Roman', serif";
        bodyFont = "system-ui, -apple-system, sans-serif";
      } else if (targetFont === "impact") {
        headerFont = "'Syne', 'Arial Black', Impact, sans-serif";
        bodyFont = "system-ui, -apple-system, sans-serif";
      } else if (targetFont === "tech") {
        headerFont = "'JetBrains Mono', 'Courier New', monospace";
        bodyFont = "system-ui, -apple-system, sans-serif";
      }

      const paddingX = width * 0.085;
      const contentWidth = width - paddingX * 2;
      let cursorY = height * 0.085;

      // 3. TOP HEADER BAR: Avatar Circle + Author Name + Verified Badge + Handle
      const avatarSize = width * 0.058; // 62px on 1080p
      const avatarX = paddingX;
      const avatarY = cursorY;

      // Draw Avatar Circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();
      ctx.restore();

      // Avatar Initials
      ctx.fillStyle = isLight ? "#ffffff" : "#09090b";
      ctx.font = `bold ${avatarSize * 0.46}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const initialLetters = (author || "M").trim().slice(0, 2).toUpperCase();
      ctx.fillText(initialLetters, avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1);

      // Author Name (Line 1)
      const nameY = avatarY + avatarSize * 0.28;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${width * 0.031}px ${bodyFont}`;
      ctx.fillStyle = primaryTextColor;
      const displayName = author || "Malesan Creator";
      ctx.fillText(displayName, avatarX + avatarSize + 16, nameY);

      // Verified Badge Icon (Crisp alignment with 8px buffer)
      if (isVerified) {
        const nameWidth = ctx.measureText(displayName).width;
        const iconX = avatarX + avatarSize + 16 + nameWidth + width * 0.018;
        const iconY = nameY;
        const iconR = width * 0.011;

        ctx.save();
        ctx.beginPath();
        ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2);
        ctx.fillStyle = accentColor;
        ctx.fill();

        ctx.strokeStyle = isLight ? "#ffffff" : "#09090b";
        ctx.lineWidth = width * 0.0028;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(iconX - iconR * 0.42, iconY);
        ctx.lineTo(iconX - iconR * 0.1, iconY + iconR * 0.38);
        ctx.lineTo(iconX + iconR * 0.45, iconY - iconR * 0.38);
        ctx.stroke();
        ctx.restore();
      }

      // Creator Handle (Line 2)
      const handleY = avatarY + avatarSize * 0.76;
      ctx.font = `normal ${width * 0.024}px ${bodyFont}`;
      ctx.fillStyle = secondaryTextColor;
      ctx.fillText(tag || "@malesan_creator", avatarX + avatarSize + 16, handleY);

      // Slide Counter Tag (Right aligned)
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${width * 0.028}px sans-serif`;
      ctx.fillStyle = secondaryTextColor;
      ctx.fillText(`${slideIndex + 1} / ${totalSlides}`, width - paddingX, avatarY + avatarSize * 0.5);

      cursorY = avatarY + avatarSize + height * 0.055;

      // 4. Badge Pill (Category Tag)
      if (slide.badge) {
        const badgeText = slide.badge.toUpperCase();
        ctx.font = `bold ${width * 0.025}px sans-serif`;
        const badgeMetrics = ctx.measureText(badgeText);
        const pillWidth = badgeMetrics.width + width * 0.045;
        const pillHeight = width * 0.054;

        ctx.save();
        ctx.fillStyle = badgeBg;
        ctx.strokeStyle = badgeBorder;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(paddingX, cursorY, pillWidth, pillHeight, pillHeight / 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = accentColor;
        ctx.fillText(badgeText, paddingX + pillWidth / 2, cursorY + pillHeight / 2);

        // Advance cursor with safe gap so title never collides
        cursorY += pillHeight + height * 0.045;
      }

      // 5. Main Focal Content (Using textBaseline = "top" for 100% mathematical precision)
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      if (isCover) {
        // --- COVER HOOK SLIDE ---
        ctx.fillStyle = primaryTextColor;
        const titleFontSize = width * 0.074;
        ctx.font = `bold ${titleFontSize}px ${headerFont}`;
        const titleLineHeight = titleFontSize * 1.25;

        const titleLines = wrapText(ctx, slide.title, contentWidth);
        for (const line of titleLines) {
          ctx.fillText(line, paddingX, cursorY);
          cursorY += titleLineHeight;
        }

        cursorY += height * 0.025;

        // Decorative Accent Line
        ctx.save();
        const lineGrad = ctx.createLinearGradient(paddingX, 0, paddingX + width * 0.35, 0);
        lineGrad.addColorStop(0, accentColor);
        lineGrad.addColorStop(1, "transparent");
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(paddingX, cursorY);
        ctx.lineTo(paddingX + width * 0.35, cursorY);
        ctx.stroke();
        ctx.restore();

        cursorY += height * 0.035;

        // Subtitle / Body text
        ctx.fillStyle = secondaryTextColor;
        const bodyFontSize = width * 0.039;
        ctx.font = `normal ${bodyFontSize}px ${bodyFont}`;
        const bodyLineHeight = bodyFontSize * 1.45;

        const bodyLines = wrapText(ctx, slide.body, contentWidth);
        for (const line of bodyLines) {
          ctx.fillText(line, paddingX, cursorY);
          cursorY += bodyLineHeight;
        }
      } else if (isStat) {
        // --- BIG STATISTIC SLIDE ---
        ctx.fillStyle = primaryTextColor;
        const titleFontSize = width * 0.062;
        ctx.font = `bold ${titleFontSize}px ${headerFont}`;
        const titleLineHeight = titleFontSize * 1.25;

        const titleLines = wrapText(ctx, slide.title, contentWidth);
        for (const line of titleLines) {
          ctx.fillText(line, paddingX, cursorY);
          cursorY += titleLineHeight;
        }

        cursorY += height * 0.03;

        // Big Stat Card Box
        const statCardHeight = height * 0.25;
        ctx.save();
        ctx.fillStyle = cardBg;
        ctx.strokeStyle = cardBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(paddingX, cursorY, contentWidth, statCardHeight, 24);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        const statNum = slide.stat_number || "85%";
        ctx.fillStyle = accentColor;
        ctx.font = `bold ${width * 0.13}px ${headerFont}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(statNum, width / 2, cursorY + statCardHeight * 0.42);

        const statLbl = slide.stat_label || "Penonton memutuskan di 3 detik pertama";
        ctx.fillStyle = primaryTextColor;
        ctx.font = `bold ${width * 0.03}px ${bodyFont}`;
        ctx.fillText(statLbl, width / 2, cursorY + statCardHeight * 0.78);

        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        cursorY += statCardHeight + height * 0.03;

        // Explanation text below card
        ctx.fillStyle = secondaryTextColor;
        const bodyFontSize = width * 0.038;
        ctx.font = `normal ${bodyFontSize}px ${bodyFont}`;
        const bodyLineHeight = bodyFontSize * 1.45;

        const bodyLines = wrapText(ctx, slide.body, contentWidth);
        for (const line of bodyLines) {
          ctx.fillText(line, paddingX, cursorY);
          cursorY += bodyLineHeight;
        }
      } else if (isCta) {
        // --- ACTIONABLE CTA SLIDE ---
        ctx.fillStyle = primaryTextColor;
        const titleFontSize = width * 0.066;
        ctx.font = `bold ${titleFontSize}px ${headerFont}`;
        const titleLineHeight = titleFontSize * 1.25;

        const titleLines = wrapText(ctx, slide.title, contentWidth);
        for (const line of titleLines) {
          ctx.fillText(line, paddingX, cursorY);
          cursorY += titleLineHeight;
        }

        cursorY += height * 0.03;

        // CTA Card Highlight Box
        const ctaCardHeight = height * 0.3;
        ctx.save();
        ctx.fillStyle = cardBg;
        ctx.strokeStyle = cardBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(paddingX, cursorY, contentWidth, ctaCardHeight, 24);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        const cardPadding = width * 0.055;
        let cardCursorY = cursorY + cardPadding;

        ctx.fillStyle = primaryTextColor;
        const bodyFontSize = width * 0.038;
        ctx.font = `normal ${bodyFontSize}px ${bodyFont}`;
        const bodyLineHeight = bodyFontSize * 1.45;

        const bodyLines = wrapText(ctx, slide.body, contentWidth - cardPadding * 2);
        for (const line of bodyLines) {
          ctx.fillText(line, paddingX + cardPadding, cardCursorY);
          cardCursorY += bodyLineHeight;
        }

        // Profile Plug Bar
        const plugY = cursorY + ctaCardHeight - width * 0.085;
        ctx.save();
        ctx.fillStyle = badgeBg;
        ctx.strokeStyle = badgeBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(
          paddingX + cardPadding,
          plugY,
          contentWidth - cardPadding * 2,
          width * 0.062,
          12,
        );
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = accentColor;
        ctx.font = `bold ${width * 0.027}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          `Follow ${tag} untuk insight konten harian`,
          width / 2,
          plugY + width * 0.031,
        );
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
      } else {
        // --- POINT / INSIGHT SLIDE ---
        ctx.fillStyle = primaryTextColor;
        const titleFontSize = width * 0.064;
        ctx.font = `bold ${titleFontSize}px ${headerFont}`;
        const titleLineHeight = titleFontSize * 1.25;

        const titleLines = wrapText(ctx, slide.title, contentWidth);
        for (const line of titleLines) {
          ctx.fillText(line, paddingX, cursorY);
          cursorY += titleLineHeight;
        }

        cursorY += height * 0.03;

        // Container Card for Body Insight
        const bodyCardHeight = height * 0.34;
        ctx.save();
        ctx.fillStyle = cardBg;
        ctx.strokeStyle = cardBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(paddingX, cursorY, contentWidth, bodyCardHeight, 24);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        const cardPadding = width * 0.055;
        let cardCursorY = cursorY + cardPadding;

        ctx.fillStyle = secondaryTextColor;
        const bodyFontSize = width * 0.039;
        ctx.font = `normal ${bodyFontSize}px ${bodyFont}`;
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
      ctx.moveTo(paddingX, footerY - height * 0.022);
      ctx.lineTo(width - paddingX, footerY - height * 0.022);
      ctx.stroke();
      ctx.restore();

      ctx.textBaseline = "middle";

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
      ctx.fillText(tag || "@malesan_creator", width - paddingX, footerY);

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

  // AI Generation Handler
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
        setActiveTab("content");
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
        setExportProgress(`Mengunduh Slide ${i + 1}/${slides.length}...`);
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

  // Slide Operations
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
      title: "Judul Poin Baru",
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
    <div className="space-y-3">
      {/* 1. ULTRA-COMPACT TOP ACTION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-white/[0.1] bg-gradient-to-r from-surface-raised via-[#101014] to-surface p-2.5 sm:px-4 sm:py-2.5 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-ember/15 text-ember">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M7 3v18" />
              <path d="M17 3v18" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-sm sm:text-base font-bold text-ink leading-none">
                AI Carousel &amp; Slide Studio
              </h1>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                Gratis
              </span>
              {typeof credits === "number" && (
                <span className="hidden sm:inline text-micro text-muted font-mono">
                  Saldo: {credits}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyCaption}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-surface px-3 text-xs font-semibold text-ink transition-all hover:border-white/[0.25] hover:bg-surface-raised active:scale-95 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-ember">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            <span className="hidden sm:inline">{copiedCaption ? "Caption Disalin!" : "Salin Caption"}</span>
            <span className="sm:hidden">{copiedCaption ? "Disalin!" : "Caption"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportAll}
            disabled={isExporting}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-ember px-3.5 font-display text-xs font-bold text-obsidian shadow-sm transition-all hover:bg-ember-lo active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            <span>{isExporting ? exportProgress : "Download Semua (.PNG)"}</span>
          </button>
        </div>
      </div>

      {/* MOBILE SEGMENTED VIEW SWITCHER */}
      <div className="lg:hidden flex rounded-xl border border-white/[0.1] bg-surface p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setMobileView("preview")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
            mobileView === "preview" ? "bg-ember text-obsidian shadow-xs" : "text-muted hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          <span>Preview Kartu</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileView("editor")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
            mobileView === "editor" ? "bg-ember text-obsidian shadow-xs" : "text-muted hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          <span>Atur &amp; Edit Konten</span>
        </button>
      </div>

      {/* 2. MAIN WORKBENCH: FULL 1-PAGE ZERO-SCROLL LAYOUT */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
        {/* LEFT COLUMN: Compact 4-Tab Control Center (7 cols) */}
        <div
          className={`space-y-3 lg:col-span-7 ${
            mobileView === "preview" ? "hidden lg:block" : "block"
          }`}
        >
          {/* TAB BAR (4 DEDICATED CRISP TABS) */}
          <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/[0.1] bg-surface p-1 shadow-xs">
            {[
              { id: "content" as StudioTab, label: "Teks Slide", badge: `#${currentIdx + 1}` },
              { id: "design" as StudioTab, label: "Tema & Rasio", badge: "Tema" },
              { id: "brand" as StudioTab, label: "Branding", badge: "Profil" },
              { id: "ai" as StudioTab, label: "AI Generator", badge: "Auto" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1 rounded-lg py-2 px-1 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-ember text-obsidian shadow-xs ring-1 ring-ember/30"
                    : "text-muted hover:text-ink hover:bg-surface-raised"
                }`}
              >
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: 📝 PER-SLIDE TEXT EDITOR */}
          {activeTab === "content" && (
            <div className="rounded-2xl border border-hairline bg-surface p-3.5 sm:p-4 space-y-3 shadow-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-ember animate-pulse" />
                  <span className="font-display text-xs font-bold text-ink">
                    Slide #{currentIdx + 1} dari {slides.length}
                  </span>
                  <span className="rounded-md border border-ember/30 bg-ember/10 px-1.5 py-0.2 text-[10px] font-bold text-ember uppercase">
                    {slides[currentIdx]?.type || "point"}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDuplicateSlide(currentIdx)}
                    className="rounded-lg border border-hairline bg-[#09090b] px-2 py-0.5 text-micro font-semibold text-muted hover:text-ink cursor-pointer"
                  >
                    Duplikat
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteSlide(currentIdx)}
                    className="rounded-lg border border-hairline bg-[#09090b] px-2 py-0.5 text-micro font-semibold text-danger/80 hover:text-danger cursor-pointer"
                  >
                    Hapus
                  </button>

                  <button
                    type="button"
                    onClick={handleAddSlide}
                    className="rounded-lg bg-ember px-2.5 py-0.5 text-micro font-bold text-obsidian hover:bg-ember-lo cursor-pointer"
                  >
                    + Slide
                  </button>
                </div>
              </div>

              {/* Slide Stepper Selector */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
                {slides.map((s, idx) => (
                  <button
                    key={s.id || idx}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
                      currentIdx === idx
                        ? "bg-ember text-obsidian shadow-xs"
                        : "bg-[#09090b] text-muted hover:text-ink border border-white/[0.08]"
                    }`}
                  >
                    <span>#{idx + 1}</span>
                    <span className="text-[9px] uppercase opacity-75">
                      ({s.type})
                    </span>
                  </button>
                ))}
              </div>

              {/* Input Form Fields */}
              {slides[currentIdx] && (
                <div className="space-y-2.5">
                  {/* Layout Type Chips */}
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: "cover", label: "Cover Hook" },
                      { id: "point", label: "Poin" },
                      { id: "stat", label: "Fakta/Stat" },
                      { id: "cta", label: "CTA" },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleUpdateSlide("type", st.id)}
                        className={`rounded-lg border py-1 text-micro font-bold transition-all cursor-pointer ${
                          slides[currentIdx].type === st.id
                            ? "border-ember/50 bg-ember/15 text-ember shadow-xs"
                            : "border-white/[0.08] bg-[#09090b] text-muted hover:text-ink"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {/* Badge & Stat Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted mb-0.5">
                        Label Pill Badge Atas
                      </label>
                      <input
                        type="text"
                        value={slides[currentIdx].badge || ""}
                        onChange={(e) => handleUpdateSlide("badge", e.target.value)}
                        placeholder="Contoh: STRATEGI KONTEN"
                        className="w-full rounded-lg border border-hairline bg-[#09090b] px-2.5 py-1.5 text-xs text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none"
                      />
                    </div>

                    {slides[currentIdx].type === "stat" ? (
                      <div>
                        <label className="block text-[10px] font-bold text-ember mb-0.5">
                          Angka Statistik
                        </label>
                        <input
                          type="text"
                          value={slides[currentIdx].stat_number || ""}
                          onChange={(e) => handleUpdateSlide("stat_number", e.target.value)}
                          placeholder="87%, 10x, dll"
                          className="w-full rounded-lg border border-ember/30 bg-obsidian px-2.5 py-1.5 text-xs font-bold text-ink focus:border-ember focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-semibold text-muted mb-0.5">
                          Footer Callout (Bawah)
                        </label>
                        <input
                          type="text"
                          value={slides[currentIdx].footer || ""}
                          onChange={(e) => handleUpdateSlide("footer", e.target.value)}
                          placeholder="Geser ke samping ➔"
                          className="w-full rounded-lg border border-hairline bg-[#09090b] px-2.5 py-1.5 text-xs text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Headline */}
                  <div>
                    <label className="block text-[10px] font-semibold text-muted mb-0.5">
                      Judul Utama Slide
                    </label>
                    <textarea
                      rows={2}
                      value={slides[currentIdx].title || ""}
                      onChange={(e) => handleUpdateSlide("title", e.target.value)}
                      placeholder="Judul pokok slide..."
                      className="w-full rounded-lg border border-hairline bg-[#09090b] px-2.5 py-1.5 text-xs sm:text-sm font-bold text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none resize-none"
                    />
                  </div>

                  {/* Body Text */}
                  <div>
                    <label className="block text-[10px] font-semibold text-muted mb-0.5">
                      Isi Penjelasan Poin
                    </label>
                    <textarea
                      rows={2}
                      value={slides[currentIdx].body || ""}
                      onChange={(e) => handleUpdateSlide("body", e.target.value)}
                      placeholder="Penjelasan ringkas 2-3 kalimat..."
                      className="w-full rounded-lg border border-hairline bg-[#09090b] px-2.5 py-1.5 text-xs text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 🎨 TEMA VISUAL, RASIO & TIPOGRAFI */}
          {activeTab === "design" && (
            <div className="rounded-2xl border border-hairline bg-surface p-3.5 sm:p-4 space-y-3 shadow-xs animate-in fade-in duration-150">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                  Pilih Tema Desain ({THEMES.find((t) => t.id === theme)?.name})
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={`flex items-center gap-2 rounded-xl border p-2 text-left transition-all cursor-pointer ${
                        theme === t.id
                          ? `${t.border} bg-surface-raised ring-1 ring-ember/30 shadow-xs`
                          : "border-white/[0.08] bg-[#09090b] hover:border-white/[0.18]"
                      }`}
                    >
                      <span
                        className="size-3 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: t.accent }}
                      />
                      <span className="text-xs font-bold text-ink truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-hairline">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                    Format Rasio
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: "4:5", label: "4:5", sub: "IG Feed" },
                      { id: "1:1", label: "1:1", sub: "Square" },
                      { id: "9:16", label: "9:16", sub: "Story" },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRatio(r.id as SlideRatio)}
                        className={`rounded-lg border py-1 px-1 text-center transition-all cursor-pointer ${
                          ratio === r.id
                            ? "border-ember/50 bg-ember/15 text-ember shadow-xs"
                            : "border-white/[0.08] bg-[#09090b] text-muted hover:text-ink"
                        }`}
                      >
                        <div className="text-xs font-bold leading-none">{r.label}</div>
                        <div className="text-[9px] opacity-70 mt-0.5">{r.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                    Tipografi
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { id: "modern", label: "Modern Sans" },
                      { id: "editorial", label: "Editorial Serif" },
                      { id: "impact", label: "Impact Bold" },
                      { id: "tech", label: "Tech Mono" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFontPairing(f.id as FontPairing)}
                        className={`rounded-lg border py-1.5 px-2 text-left text-xs font-bold transition-all truncate cursor-pointer ${
                          fontPairing === f.id
                            ? "border-ember/50 bg-ember/15 text-ember shadow-xs"
                            : "border-white/[0.08] bg-[#09090b] text-muted hover:text-ink"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 👤 BRANDING & PROFIL KREATOR */}
          {activeTab === "brand" && (
            <div className="rounded-2xl border border-hairline bg-surface p-3.5 sm:p-4 space-y-3 shadow-xs animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-muted mb-0.5">
                    Nama Kreator / Brand
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Nama Akun"
                    className="w-full rounded-lg border border-hairline bg-[#09090b] px-3 py-1.5 text-xs text-ink focus:border-ember focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-muted mb-0.5">
                    Username / Handle Sosmed
                  </label>
                  <input
                    type="text"
                    value={creatorTag}
                    onChange={(e) => setCreatorTag(e.target.value)}
                    placeholder="@username"
                    className="w-full rounded-lg border border-hairline bg-[#09090b] px-3 py-1.5 text-xs text-ink focus:border-ember focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-hairline">
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
                  <span>Tampilkan Petunjuk Geser (Swipe)</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 4: 🪄 1-CLICK AI CAROUSEL GENERATOR */}
          {activeTab === "ai" && (
            <div className="rounded-2xl border border-ember/35 bg-gradient-to-b from-[#131114] to-[#09090b] p-3.5 sm:p-4 space-y-3 shadow-sm animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-xs font-bold text-ink flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-ember" />
                  1-Click AI Carousel Generator
                </h3>
                <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[10px] font-bold text-ember border border-hairline">
                  {cost} Kredit
                </span>
              </div>

              <div className="space-y-1.5">
                <textarea
                  rows={2}
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="Ketik topik: contoh 3 kesalahan fatal pemula saat jualan..."
                  className="w-full rounded-xl border border-white/[0.1] bg-obsidian px-3 py-2 text-xs text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none resize-none"
                />

                <div className="flex flex-wrap items-center gap-1">
                  {PROMPT_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setAiTopic(sug)}
                      className="rounded-md border border-white/[0.08] bg-surface px-2 py-0.5 text-[10px] text-muted hover:text-ink cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-hairline">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-muted">Slide:</span>
                  <div className="inline-flex rounded-lg border border-white/[0.1] bg-surface p-0.5">
                    {[4, 5, 6, 7].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSlideCount(num)}
                        className={`rounded px-2 py-0.5 text-[11px] font-mono font-bold cursor-pointer ${
                          slideCount === num ? "bg-ember text-obsidian" : "text-muted hover:text-ink"
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
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-ember px-4 font-display text-xs font-bold text-obsidian shadow-sm hover:bg-ember-lo disabled:opacity-50 cursor-pointer"
                >
                  {isGenerating ? (
                    <span>{generationProgress || "Memproses..."}</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <span>Bikin Otomatis ({cost} Kredit)</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: HD Canvas Display + Single-Screen Filmstrip (5 cols) */}
        <div
          className={`flex flex-col items-center lg:col-span-5 space-y-2.5 ${
            mobileView === "editor" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Main Canvas Card Display (Zero letterboxing black bars) */}
          <div className="w-full flex flex-col items-center">
            <div
              className={`relative rounded-2xl border border-white/[0.18] overflow-hidden shadow-2xl transition-all flex items-center justify-center ${
                ratio === "1:1"
                  ? "w-[270px] sm:w-[290px] aspect-square"
                  : ratio === "9:16"
                  ? "w-[190px] sm:w-[210px] aspect-[9/16]"
                  : "w-[245px] sm:w-[275px] aspect-[4/5]"
              }`}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full block"
              />
            </div>
          </div>

          {/* Slide Navigator & Action Controls */}
          <div className="w-full max-w-[275px] sm:max-w-[290px] flex items-center justify-between gap-1.5">
            <button
              type="button"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-white/[0.1] bg-surface px-2.5 text-xs font-semibold text-ink disabled:opacity-30 hover:border-ember/40 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3">
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
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-white/[0.1] bg-surface px-2.5 text-xs font-semibold text-ink disabled:opacity-30 hover:border-ember/40 cursor-pointer"
            >
              <span>Next</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleExportSingle}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-ember/40 bg-ember/10 px-2.5 text-xs font-bold text-ember hover:bg-ember/20 cursor-pointer"
              title="Download slide aktif ini"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              <span>Unduh Slide</span>
            </button>
          </div>

          {/* ULTRA-COMPACT FILMSTRIP RAIL */}
          <div className="w-full max-w-[275px] sm:max-w-[290px] rounded-xl border border-hairline bg-surface p-2 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted">
              <span>Alur Urutan Slide</span>
              <span>{slides.length} Kartu</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
              {slides.map((s, idx) => (
                <div
                  key={s.id || idx}
                  onClick={() => setCurrentIdx(idx)}
                  className={`relative flex-shrink-0 w-14 rounded-lg border p-1 cursor-pointer transition-all ${
                    currentIdx === idx
                      ? "border-ember bg-surface-raised ring-1 ring-ember/30 shadow-xs"
                      : "border-white/[0.08] bg-[#09090b] hover:border-white/[0.2]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-ember">#{idx + 1}</span>
                    <span className="text-[7px] uppercase text-muted font-bold">{s.type.slice(0, 3)}</span>
                  </div>
                  <p className="mt-0.5 text-[8px] font-bold text-ink line-clamp-1 leading-tight">
                    {s.title || "Slide"}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[8px] text-muted">
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
