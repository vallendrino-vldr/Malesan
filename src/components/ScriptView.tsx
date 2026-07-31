"use client";

import { useMemo, useState } from "react";

/**
 * Full script output.
 *
 * The generated script was persisted and then never rendered. A card in "Siap"
 * said "syuting, posting" and showed nothing to shoot from — six scenes, a CTA,
 * a caption and hashtags sat in the row, invisible. The generation was the
 * whole product and the user could not see it.
 *
 * Two ways to read it, because they are two different jobs:
 *  - **Baca** — one continuous voice-over, hook → body → CTA → closing, in the
 *    order you actually say it. This is what you read to camera.
 *  - **Scene** — the shot list: timestamp, what you say, what is on screen,
 *    what footage you need.
 *
 * Both are copyable; the whole thing downloads as Markdown. A script you cannot
 * get out of the app is a script you cannot shoot from.
 */

export type ScriptScene = {
  timestamp?: string;
  spoken?: string;
  visual?: string;
  on_screen_text?: string;
};

export type ScriptOutput = {
  script?: ScriptScene[];
  cta?: { text?: string; placement?: string };
  caption?: string;
  hashtags?: string[];
};

function buildReadThrough(s: ScriptOutput, title: string) {
  const scenes = s.script ?? [];
  const hook = scenes[0];
  const body = scenes.slice(1);

  const lines: string[] = [];
  if (hook?.spoken) lines.push(`HOOK\n${hook.spoken}`);
  if (body.length) {
    lines.push(
      `BODY\n${body
        .map((sc) => sc.spoken)
        .filter(Boolean)
        .join("\n\n")}`,
    );
  }
  if (s.cta?.text) lines.push(`CTA\n${s.cta.text}`);
  lines.push(`CLOSING\nMakasih udah nonton sampai habis. ${title}`);
  return lines.join("\n\n");
}

function buildMarkdown(s: ScriptOutput, title: string) {
  const out: string[] = [`# ${title}`, "", "## Voice over", "", buildReadThrough(s, title), ""];

  if (s.script?.length) {
    out.push("## Scene", "");
    s.script.forEach((sc, i) => {
      out.push(`### ${i + 1}. ${sc.timestamp ?? ""}`.trim());
      if (sc.spoken) out.push(`**Diucapkan:** ${sc.spoken}`);
      if (sc.on_screen_text) out.push(`**Teks di layar:** ${sc.on_screen_text}`);
      if (sc.visual) out.push(`**Footage:** ${sc.visual}`);
      out.push("");
    });
  }

  if (s.cta?.text) {
    out.push("## CTA", "", s.cta.text);
    if (s.cta.placement) out.push("", `_Penempatan: ${s.cta.placement}_`);
    out.push("");
  }
  if (s.caption) out.push("## Caption", "", s.caption, "");
  if (s.hashtags?.length) out.push("## Hashtag", "", s.hashtags.join(" "), "");

  return out.join("\n");
}

export function ScriptView({ script, title }: { script: ScriptOutput; title: string }) {
  const [tab, setTab] = useState<"baca" | "scene">("baca");
  const [copied, setCopied] = useState("");

  const readThrough = useMemo(() => buildReadThrough(script, title), [script, title]);
  const markdown = useMemo(() => buildMarkdown(script, title), [script, title]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("gagal");
      setTimeout(() => setCopied(""), 1600);
    }
  };

  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.slice(0, 60).replace(/[^\w\s-]/g, "").trim() || "script"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scenes = script.script ?? [];

  return (
    <div className="mt-3 rounded-xl border border-hairline bg-obsidian">
      <div className="flex items-center gap-1 border-b border-hairline p-1.5">
        {(["baca", "scene"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`flex-1 cursor-pointer rounded-lg py-1.5 text-micro font-bold transition-colors duration-[var(--duration-standard)] ease-heat ${
              tab === t ? "bg-ember/15 text-ember" : "text-muted hover:text-ink"
            }`}
          >
            {t === "baca" ? "Baca" : `Scene · ${scenes.length}`}
          </button>
        ))}
      </div>

      <div className="max-h-72 overflow-y-auto overscroll-contain p-3">
        {tab === "baca" ? (
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink/90">
            {readThrough}
          </pre>
        ) : (
          <ol className="space-y-3">
            {scenes.map((sc, i) => (
              <li key={i} className="rounded-lg border border-hairline bg-surface p-3">
                <p className="eyebrow text-ember">
                  {i + 1}. {sc.timestamp || "—"}
                </p>
                {sc.spoken && (
                  <p className="mt-1.5 text-xs leading-relaxed text-ink/90">{sc.spoken}</p>
                )}
                {sc.on_screen_text && (
                  <p className="mt-2 rounded bg-obsidian px-2 py-1 text-micro text-ink/70">
                    Teks layar: {sc.on_screen_text}
                  </p>
                )}
                {sc.visual && (
                  <p className="mt-1.5 text-micro leading-relaxed text-muted">
                    Footage: {sc.visual}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}

        {script.caption && (
          <div className="mt-3 border-t border-hairline pt-3">
            <p className="eyebrow text-muted">Caption</p>
            <p className="mt-1 text-xs leading-relaxed text-ink/80">{script.caption}</p>
          </div>
        )}

        {!!script.hashtags?.length && (
          <p className="mt-2 text-micro leading-relaxed text-ember-lo">
            {script.hashtags.join(" ")}
          </p>
        )}
      </div>

      <div className="flex gap-1.5 border-t border-hairline p-1.5">
        <Btn
          label={copied === "vo" ? "Kesalin!" : "Salin voice over"}
          onClick={() => copy("vo", readThrough)}
        />
        <Btn
          label={copied === "all" ? "Kesalin!" : "Salin semua"}
          onClick={() => copy("all", markdown)}
        />
        <Btn label="Unduh" onClick={download} />
      </div>
      {copied === "gagal" && (
        <p className="px-3 pb-2 text-micro text-danger">
          Browser-nya nolak akses clipboard. Pakai Unduh aja.
        </p>
      )}
    </div>
  );
}

function Btn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 cursor-pointer rounded-lg bg-surface px-2 py-2 text-micro font-bold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-surface-raised hover:text-ink"
    >
      {label}
    </button>
  );
}
