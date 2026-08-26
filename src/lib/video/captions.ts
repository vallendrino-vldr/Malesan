/**
 * Caption grouping, live-preview lookup, and ASS generation.
 *
 * Pure functions, no DOM, no ffmpeg — so the same grouping drives the HTML
 * overlay (the live preview) and the burned-in ASS file (the export), and the
 * two cannot drift. If the preview shows a word highlighted, the export
 * highlights the same word at the same moment, because both read this.
 */

export type Word = { word: string; start: number; end: number };

export type CaptionStyle = {
  /** One of a short curated set — libass can only use a font present in its FS. */
  fontFamily: string;
  bold: boolean;
  /** Base text colour, "#rrggbb". */
  textColor: string;
  /** The colour the currently-spoken word turns. */
  highlightColor: string;
  /** How the text sits on the frame. */
  style: "box" | "outline" | "plain";
  /** 1 = bottom of the safe zone, higher = further up. Fraction of height. */
  position: number;
  /**
   * "word": one word on screen at a time — the punchy TikTok style.
   * "line": the whole caption line shows, the spoken word lit — the readable one.
   */
  mode: "word" | "line";
  /** Caption size multiplier (~0.7 small to ~1.6 huge). 1 = the tuned default. */
  fontScale: number;
  /** Optional entrance motion, rendered into the final pixels too. */
  animation: "none" | "pop" | "fade";
};

/**
 * Curated caption fonts, loaded from Google Fonts at runtime.
 *
 * These are the faces short-form captions actually use — heavy, condensed,
 * high-impact — not the system stack the first version was stuck with. The
 * `css` value is the exact family name to load and to hand the canvas, and
 * `weight` is the weight to request so the burned-in text matches the preview.
 */
export const CAPTION_FONTS: { label: string; family: string; weight: number }[] = [
  { label: "Anton", family: "Anton", weight: 400 },
  { label: "Bebas Neue", family: "Bebas Neue", weight: 400 },
  { label: "Archivo Black", family: "Archivo Black", weight: 400 },
  { label: "Montserrat", family: "Montserrat", weight: 800 },
  { label: "Poppins", family: "Poppins", weight: 700 },
  { label: "Oswald", family: "Oswald", weight: 700 },
  { label: "Teko", family: "Teko", weight: 700 },
  { label: "Rubik Mono", family: "Rubik Mono One", weight: 400 },
];

/** The Google Fonts href that loads every CAPTION_FONTS face in one request. */
export const CAPTION_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Anton",
    "family=Bebas+Neue",
    "family=Archivo+Black",
    "family=Montserrat:wght@800",
    "family=Poppins:wght@700",
    "family=Oswald:wght@700",
    "family=Teko:wght@700",
    "family=Rubik+Mono+One",
  ].join("&") +
  "&display=swap";

export const DEFAULT_STYLE: CaptionStyle = {
  fontFamily: "Anton",
  bold: false,
  textColor: "#ffffff",
  highlightColor: "#ff8a3d",
  style: "outline",
  position: 0.72,
  mode: "word",
  fontScale: 1,
  animation: "pop",
};

export type Line = { words: Word[]; start: number; end: number };

/**
 * Group a flat word list into short caption lines.
 *
 * Breaks on a pause longer than `maxGap` or after `maxWords`, whichever comes
 * first — the two things that make a caption feel like it belongs to one breath
 * rather than running on. Short-form captions live or die on this rhythm.
 */
export function groupLines(words: Word[], maxWords = 4, maxGap = 0.6): Line[] {
  const lines: Line[] = [];
  let cur: Word[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = cur[cur.length - 1];
    const gap = prev ? w.start - prev.end : 0;
    const isPunctuationBreak = prev && /[.!?]$/.test(prev.word);
    if (cur.length >= maxWords || (prev && (gap > maxGap || isPunctuationBreak))) {
      lines.push(toLine(cur));
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) lines.push(toLine(cur));
  return lines;
}

function toLine(words: Word[]): Line {
  return { words, start: words[0].start, end: words[words.length - 1].end };
}

/** The line showing at time t, plus which word in it is active (-1 if none). */
export function activeAt(lines: Line[], t: number): { line: Line; wordIdx: number } | null {
  // A small look-behind so a line stays up briefly after its last word instead
  // of flickering off in the gap before the next one.
  for (const line of lines) {
    if (t >= line.start && t <= line.end + 0.4) {
      let wordIdx = -1;
      for (let i = 0; i < line.words.length; i++) {
        const w = line.words[i];
        const next = line.words[i + 1];
        const until = next ? next.start : w.end;
        if (t >= w.start && t < until) {
          wordIdx = i;
          break;
        }
      }
      if (wordIdx === -1 && t >= line.words[line.words.length - 1].start) {
        wordIdx = line.words.length - 1;
      }
      return { line, wordIdx };
    }
  }
  return null;
}

/** "#rrggbb" -> ASS "&Haabbggrr" (alpha 00 = opaque, colours are reversed). */
function assColor(hex: string, alpha = "00"): string {
  const h = hex.replace("#", "");
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  return `&H${alpha}${b}${g}${r}`.toUpperCase();
}

function assEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\{/g, "(").replace(/\}/g, ")");
}

/**
 * Build an ASS subtitle that highlights one word at a time.
 *
 * One Dialogue event per word, each covering [word.start, nextWord.start) and
 * showing the whole line with that word in the highlight colour — so the line
 * is on screen continuously with exactly one word lit, matching the HTML
 * preview frame for frame. Positioned in the lower third (Alignment 2, bottom
 * centre, with a bottom margin) so it clears the TikTok/Reels caption zone.
 *
 * fontSize scales with the video height so a caption authored against a 1080p
 * preview does not come out tiny on a portrait export.
 */
export function buildAss(
  lines: Line[],
  style: CaptionStyle,
  width: number,
  height: number,
): string {
  const fontSize = Math.round(height * 0.055 * style.fontScale);
  const marginV = Math.round(height * (1 - style.position));

  const borderStyle = style.style === "box" ? 3 : 1;
  const outline = style.style === "outline" ? 3 : style.style === "box" ? 0 : 1;
  const shadow = style.style === "plain" ? 0 : 1;
  const back = style.style === "box" ? assColor("#000000", "40") : assColor("#000000", "80");

  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 2",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: CC,${style.fontFamily},${fontSize},${assColor(style.textColor)},${assColor(style.textColor)},${assColor("#000000")},${back},${style.bold ? -1 : 0},0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},2,60,60,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const hi = assColor(style.highlightColor);
  const base = assColor(style.textColor);
  const events: string[] = [];

  for (const line of lines) {
    for (let i = 0; i < line.words.length; i++) {
      const w = line.words[i];
      const next = line.words[i + 1];
      const start = w.start;
      const end = next ? next.start : w.end + 0.3;
      const text = line.words
        .map((x, j) => {
          const t = assEscape(x.word);
          return j === i ? `{\\c${hi}}${t}{\\c${base}}` : t;
        })
        .join(" ");
      events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},CC,,0,0,0,,${text}`);
    }
  }

  return [...header, ...events].join("\n") + "\n";
}

function assTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const cs = Math.round((s - Math.floor(s)) * 100);
  return `${h}:${pad(m)}:${pad(ss)}.${pad(cs)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
