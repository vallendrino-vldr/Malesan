"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readErrorBody, readSSE, stripFence } from "@/lib/sse";
import { ScriptView, type ScriptOutput } from "./ScriptView";

/**
 * Hook Lab, Script Builder and Repurpose.
 *
 * All three existed in `/api/generate` and in the prompt library from the start
 * and none had a way in — the Studio offered two tiles while the backend
 * supported five, and the only way to reach a hook or a script was through a
 * pipeline card. That is why the product felt thinner than it is.
 *
 * One component rather than three: the modules differ only in which fields they
 * collect and how their output is shaped, so both are data. Three near-copies
 * would have meant three places for the same SSE bug to hide — which is exactly
 * what happened the first time.
 */

type FieldSpec = {
  name: string;
  label: string;
  hint?: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  options?: string[];
};

export type ModuleSpec = {
  key: "hook" | "script" | "repurpose";
  title: string;
  blurb: string;
  cost: number;
  cta: string;
  busy: string;
  fields: FieldSpec[];
  platformPicker?: boolean;
};

export const MODULE_SPECS: Record<ModuleSpec["key"], ModuleSpec> = {
  hook: {
    key: "hook",
    title: "Hook Lab",
    blurb: "Tiga detik pertama yang nentuin orang lanjut nonton atau scroll. Kasih idenya, balik 10 hook.",
    cost: 2,
    cta: "Bikin hook",
    busy: "Lagi mikirin hook...",
    platformPicker: true,
    fields: [
      {
        name: "idea",
        label: "Idenya apa?",
        placeholder: "Bongkar kebiasaan sepele yang bikin motor turun mesin",
        rows: 3,
        required: true,
      },
    ],
  },
  script: {
    key: "script",
    title: "Script Builder",
    blurb: "Dari hook jadi script lengkap: per scene, ada teks layar dan footage yang perlu diambil.",
    cost: 4,
    cta: "Bikin script",
    busy: "Lagi nulis script...",
    platformPicker: true,
    fields: [
      { name: "idea", label: "Idenya apa?", rows: 2, required: true, placeholder: "Review jujur oli murah" },
      {
        name: "hook",
        label: "Hook-nya",
        rows: 2,
        required: true,
        hint: "Kalimat pembuka yang mau dipakai.",
        placeholder: "Jangan kaget kalau motor lo turun mesin gara-gara ini",
      },
      {
        name: "duration",
        label: "Durasi",
        required: true,
        options: ["30 detik", "45 detik", "60 detik", "90 detik"],
      },
    ],
  },
  repurpose: {
    key: "repurpose",
    title: "Repurpose",
    blurb: "Satu konten, lima platform. Tiap platform beda gaya, bukan copy-paste.",
    cost: 1,
    cta: "Ubah jadi 5 versi",
    busy: "Lagi nyesuaiin tiap platform...",
    fields: [
      {
        name: "source_content",
        label: "Kontennya",
        hint: "Tempel caption, script, atau transkrip yang udah ada.",
        rows: 6,
        required: true,
        placeholder: "Tempel di sini...",
      },
    ],
  },
};

const PLATFORMS = ["tiktok", "instagram", "youtube", "x", "threads"] as const;

type HookItem = { text?: string; pattern?: string; score?: number; why?: string };
type RepurposeOut = Record<string, string>;

/**
 * Takes a key, not a spec.
 *
 * The first version accepted the whole `ModuleSpec` and the server component
 * built it with `{...MODULE_SPECS[mod], cost}`. That cannot work: when a server
 * component imports from a `"use client"` module it receives a client
 * *reference*, not the object, so the spread produced `{cost}` and nothing
 * else — `spec.fields` was undefined and the page threw on first render.
 *
 * Only serialisable primitives cross the boundary now. The spec is looked up on
 * the client, where it actually exists.
 */
export function ModuleRunner({
  moduleKey,
  cost,
}: {
  moduleKey: ModuleSpec["key"];
  cost: number;
}) {
  const base = MODULE_SPECS[moduleKey];
  const spec: ModuleSpec | null = base ? { ...base, cost } : null;
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [platform, setPlatform] = useState<string>("tiktok");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<unknown>(null);

  // Never throw on a bad key again — an unknown module renders a message, not
  // a red error overlay over the whole app.
  const missing = (spec?.fields ?? []).filter((f) => f.required && !values[f.name]?.trim());

  const run = async () => {
    if (missing.length) {
      setError(`Isi dulu: ${missing.map((f) => f.label).join(", ")}.`);
      return;
    }
    if (!spec) return;
    setBusy(true);
    setError("");
    setOut(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: spec.key,
          input: values,
          ...(spec.platformPicker ? { platform } : {}),
        }),
      });

      if (!res.ok) throw new Error(await readErrorBody(res, "Gagal generate."));

      let acc = "";
      let streamError: string | null = null;

      await readSSE(res, (msg) => {
        if (typeof msg.error === "string") {
          streamError = msg.error;
          return true;
        }
        if (msg.done) {
          setOut((msg.generation as { output?: unknown } | undefined)?.output ?? null);
          router.refresh();
          return true;
        }
        if (typeof msg.chunk === "string") {
          acc += msg.chunk;
          try {
            setOut(JSON.parse(stripFence(acc.trim())));
          } catch {
            /* JSON not closed yet */
          }
        }
      });

      if (streamError) throw new Error(streamError);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ada yang error.");
    } finally {
      setBusy(false);
    }
  };

  if (!spec) {
    return (
      <p className="rounded-xl border border-hairline bg-surface px-4 py-6 text-center text-sm text-muted">
        Modul ini gak ada. Balik ke Studio ya.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <section className="surface-card rounded-2xl p-5">
        <h2 className="font-display text-xl font-bold tracking-display-sm text-ink">{spec.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{spec.blurb}</p>

        <div className="mt-4 space-y-3.5">
          {spec.fields.map((f) =>
            f.options ? (
              <div key={f.name}>
                <label className="block text-sm font-semibold text-ink">{f.label}</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {f.options.map((o) => {
                    const on = values[f.name] === o;
                    return (
                      <button
                        key={o}
                        onClick={() => setValues((v) => ({ ...v, [f.name]: o }))}
                        aria-pressed={on}
                        className={`cursor-pointer rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors duration-[var(--duration-standard)] ease-heat ${
                          on
                            ? "border-ember/45 bg-ember/10 text-ember"
                            : "border-hairline text-muted hover:text-ink"
                        }`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div key={f.name}>
                <label className="block text-sm font-semibold text-ink">{f.label}</label>
                {f.hint && <p className="mt-0.5 text-[11px] text-muted">{f.hint}</p>}
                <textarea
                  rows={f.rows ?? 3}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  placeholder={f.placeholder}
                  disabled={busy}
                  className="mt-2 w-full resize-none skeu-inset rounded-xl border border-hairline bg-obsidian p-3.5 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember disabled:opacity-50"
                />
              </div>
            ),
          )}

          {spec.platformPicker && (
            <div>
              <label className="block text-sm font-semibold text-ink">Platform</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const on = platform === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      aria-pressed={on}
                      className={`cursor-pointer rounded-full border px-3.5 py-2 text-xs font-semibold capitalize transition-colors duration-[var(--duration-standard)] ease-heat ${
                        on ? "border-ember/45 bg-ember/10 text-ember" : "border-hairline text-muted hover:text-ink"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          onClick={run}
          disabled={busy}
          className={`mt-5 w-full cursor-pointer rounded-xl bg-ember px-5 py-3.5 font-display text-sm font-bold text-obsidian transition-all duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo disabled:cursor-not-allowed disabled:opacity-50 ${
            busy ? "glow-ember" : ""
          }`}
        >
          {busy ? spec.busy : `${spec.cta} · ${spec.cost} kredit`}
        </button>
      </section>

      {out !== null && <ModuleOutput moduleKey={spec.key} out={out} busy={busy} />}
    </div>
  );
}

function ModuleOutput({
  moduleKey,
  out,
  busy,
}: {
  moduleKey: ModuleSpec["key"];
  out: unknown;
  busy: boolean;
}) {
  if (moduleKey === "script") {
    return <ScriptView script={out as ScriptOutput} title="Script" />;
  }

  if (moduleKey === "hook") {
    const hooks = ((out as { hooks?: HookItem[] })?.hooks ?? [])
      .filter((h) => h?.text)
      .slice()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    if (!hooks.length) return busy ? <Pending /> : null;

    return (
      <div className="space-y-2">
        <h3 className="eyebrow ml-1 text-muted">Hasil · {hooks.length} hook</h3>
        {hooks.map((h, i) => (
          <div key={i} className="surface-card rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-relaxed text-ink">{h.text}</p>
              {typeof h.score === "number" && (
                <span className="shrink-0 rounded-full bg-ember/15 px-2 py-0.5 font-mono text-[11px] text-ember">
                  {h.score}
                </span>
              )}
            </div>
            {h.pattern && <p className="eyebrow mt-2 text-ember-lo">{h.pattern}</p>}
            {h.why && <p className="mt-1 text-[11px] leading-relaxed text-muted">{h.why}</p>}
            <CopyBtn text={h.text ?? ""} />
          </div>
        ))}
      </div>
    );
  }

  const versions = Object.entries((out as RepurposeOut) ?? {}).filter(
    ([, v]) => typeof v === "string" && v.trim(),
  );
  if (!versions.length) return busy ? <Pending /> : null;

  return (
    <div className="space-y-2">
      <h3 className="eyebrow ml-1 text-muted">Hasil</h3>
      {versions.map(([platform, text]) => (
        <div key={platform} className="surface-card rounded-xl p-4">
          <p className="eyebrow text-ember capitalize">{platform}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{text}</p>
          <CopyBtn text={text} />
        </div>
      ))}
    </div>
  );
}

function Pending() {
  return (
    <div className="surface-card rounded-xl p-4">
      <div className="h-3 w-2/3 animate-pulse rounded bg-surface-raised" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-surface-raised" />
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          setDone(false);
        }
      }}
      className="mt-3 cursor-pointer text-[11px] font-semibold text-muted underline-offset-2 hover:text-ember hover:underline"
    >
      {done ? "Kesalin!" : "Salin"}
    </button>
  );
}
