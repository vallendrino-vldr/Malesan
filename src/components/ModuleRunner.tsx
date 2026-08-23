"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { readErrorBody, readSSE, stripFence } from "@/lib/sse";
import { saveToPipeline } from "@/app/actions/pipeline";
import { GenerationProgress } from "./GenerationProgress";
import { RateResult } from "./RateResult";
import { OfferAfterWin } from "./CreditNudge";
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
    title: "Bikin Hook",
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
    title: "Bikin Script",
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
    title: "Ubah Format",
    blurb: "Satu konten jadi lima versi. Tiap platform beda gaya, bukan copy-paste.",
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

/* ------------------------------------------------------------------------- *
 * Optional source material + the content-profile picker
 *
 * Two inputs that belong to every module rather than to any one of them, so
 * they live here once and the other module screens (IdeaEngine, IdeHariIni)
 * import them instead of growing their own copy.
 *
 * Their values are mirrored into sessionStorage because StudioPanel switches
 * modules by unmounting one component and mounting another. Plain React state
 * would be wiped by a move from Hook Lab to Script Builder — which is exactly
 * the moment somebody is feeding the same pasted article to a second module.
 * sessionStorage and not localStorage: this is material for the session in
 * front of you, not a preference worth remembering next week.
 * ------------------------------------------------------------------------- */

/** Mirrors the clip inside buildSharedContext, so what the counter shows is what the model reads. */
const REFERENCE_MAX = 12_000;
const REFERENCE_KEY = "malesan:reference";
const PERSONA_KEY = "malesan:persona";

type PersonaOption = { id: string; name: string; is_default: boolean };

type ExtrasSnapshot = { reference: string; personaId: string };

/**
 * The two values live outside React on purpose.
 *
 * They have to outlive the component that shows them, and `useState` cannot do
 * that here. They are read by three screens, so a plain module variable cannot
 * do it either — nothing would re-render. `useSyncExternalStore` is the one
 * sanctioned way in, and it comes with the SSR answer built in: the server
 * render gets an explicitly empty snapshot, so the first paint can never
 * disagree with what sessionStorage holds.
 */
const EMPTY_EXTRAS: ExtrasSnapshot = { reference: "", personaId: "" };
const extrasListeners = new Set<() => void>();
let extrasSnapshot: ExtrasSnapshot | null = null;

function subscribeExtras(onChange: () => void) {
  extrasListeners.add(onChange);
  return () => {
    extrasListeners.delete(onChange);
  };
}

function readExtras(): ExtrasSnapshot {
  // Hydrated from sessionStorage once per page load and then kept in memory:
  // this runs on every render, and re-reading a 12 KB string out of storage on
  // each keystroke is a cost with nothing to buy.
  extrasSnapshot ??= {
    reference: sessionStorage.getItem(REFERENCE_KEY) ?? "",
    personaId: sessionStorage.getItem(PERSONA_KEY) ?? "",
  };
  return extrasSnapshot;
}

function writeExtras(patch: Partial<ExtrasSnapshot>) {
  extrasSnapshot = { ...readExtras(), ...patch };
  if (patch.reference !== undefined) sessionStorage.setItem(REFERENCE_KEY, patch.reference);
  if (patch.personaId !== undefined) sessionStorage.setItem(PERSONA_KEY, patch.personaId);
  for (const notify of extrasListeners) notify();
}

export type GenerationExtrasState = {
  reference: string;
  setReference: (v: string) => void;
  personaId: string;
  setPersonaId: (v: string) => void;
  personas: PersonaOption[];
  /** Spread into the POST body's `input`. Undefined when neither control is set. */
  extraInput: Record<string, string> | undefined;
};

export function useGenerationExtras(): GenerationExtrasState {
  const { reference, personaId } = useSyncExternalStore(
    subscribeExtras,
    readExtras,
    () => EMPTY_EXTRAS,
  );
  const [personas, setPersonas] = useState<PersonaOption[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive || !user) return;

      // Filtered by user_id on top of RLS, per the house rule — RLS is the
      // guarantee, the filter is what keeps a bug in one policy from becoming
      // a leak on its own.
      const { data, error } = await supabase
        .from("personas")
        .select("id, name, is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("name");

      // A failed read and an empty table land in the same place deliberately:
      // the picker never renders. Someone who has never written a persona
      // should see the one-tap path, not a nag about a feature they did not
      // ask for — and a network blip should not push an error at them either.
      if (!alive || error || !data?.length) return;
      setPersonas(data);

      // An explicit "" is a real choice (use the main profile), which is why this
      // reads storage rather than the snapshot: only a missing key or a persona
      // that has since been deleted falls back to the default row.
      const saved = sessionStorage.getItem(PERSONA_KEY);
      if (saved === null || (saved !== "" && !data.some((p) => p.id === saved))) {
        writeExtras({ personaId: data.find((p) => p.is_default)?.id ?? "" });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const extraInput: Record<string, string> = {};
  const trimmed = reference.trim();
  if (trimmed) extraInput.reference = trimmed;
  if (personaId) extraInput.persona_id = personaId;

  return {
    reference,
    setReference: (v) => writeExtras({ reference: v }),
    personaId,
    setPersonaId: (v) => writeExtras({ personaId: v }),
    personas,
    extraInput: Object.keys(extraInput).length ? extraInput : undefined,
  };
}

/**
 * Rendered by every module that generates.
 *
 * `<details>` rather than a state-driven panel: collapsed by default is the
 * whole point — the one-tap path must stay one tap — and the native element is
 * already keyboard reachable, screen-reader labelled and free of animation to
 * suppress.
 */
export function GenerationExtras({
  extras,
  disabled,
}: {
  extras: GenerationExtrasState;
  disabled?: boolean;
}) {
  const selectId = useId();
  const used = extras.reference.length;
  const hasRef = used > 0;
  const near = used >= REFERENCE_MAX * 0.9;

  // null until the user opens or closes it themselves, and until then material
  // restored after a module switch opens the panel on its own. A reference that
  // is silently in effect but folded out of sight is worse than none — the
  // creator cannot tell why the answer suddenly changed shape.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? hasRef;

  return (
    <div className="space-y-3">
      {extras.personas.length > 0 && (
        <div>
          <label htmlFor={selectId} className="block text-sm font-semibold text-ink">
            Profil konten
          </label>
          <select
            id={selectId}
            value={extras.personaId}
            onChange={(e) => extras.setPersonaId(e.target.value)}
            disabled={disabled}
            className="mt-2 min-h-11 w-full cursor-pointer rounded-xl border border-hairline bg-obsidian px-3.5 text-sm text-ink focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember disabled:opacity-50"
          >
            <option value="">Profil utama</option>
            {extras.personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <details
        open={open}
        onToggle={(e) => setToggled(e.currentTarget.open)}
        className="rounded-xl border border-hairline bg-obsidian/40"
      >
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember">
          <span>Pakai bahan sendiri</span>
          <span className={`tabular text-micro font-normal ${hasRef ? "text-ember" : "text-muted"}`}>
            {hasRef ? `${used.toLocaleString("id-ID")} karakter nempel` : "Opsional"}
          </span>
        </summary>

        <div className="border-t border-hairline px-3.5 pb-3.5 pt-3">
          <p className="text-micro leading-relaxed text-muted">
            Punya artikel, data, atau catatan yang harus dipakai? Tempel di sini.
            Kalau gak ada, lewatin aja — Malesan tetap mikir dari profil lo.
          </p>
          <textarea
            rows={6}
            value={extras.reference}
            onChange={(e) => extras.setReference(e.target.value)}
            maxLength={REFERENCE_MAX}
            disabled={disabled}
            placeholder="Tempel di sini..."
            className="mt-2 w-full resize-none skeu-inset rounded-xl border border-hairline bg-obsidian p-3.5 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember disabled:opacity-50"
          />
          <p className={`mt-1.5 tabular text-micro ${near ? "text-ember" : "text-muted"}`}>
            {used.toLocaleString("id-ID")} / {REFERENCE_MAX.toLocaleString("id-ID")} karakter
            {near ? " · lebihnya bakal kepotong" : ""}
          </p>
        </div>
      </details>
    </div>
  );
}

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
  credits,
}: {
  moduleKey: ModuleSpec["key"];
  cost: number;
  /** Current balance. Only used to decide whether an offer is worth showing. */
  credits: number;
}) {
  const base = MODULE_SPECS[moduleKey];
  const spec: ModuleSpec | null = base ? { ...base, cost } : null;
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [platform, setPlatform] = useState<string>("tiktok");
  const extras = useGenerationExtras();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<unknown>(null);
  // Kept so a saved pipeline card can point back at the generation it came
  // from — that link is what lets a rating on the card reach the model.
  const [genId, setGenId] = useState<string | null>(null);
  // Characters actually received. Drives GenerationProgress — a bar fed by a
  // timer keeps filling after a dead request, which is worse than none.
  const [chars, setChars] = useState(0);
  const [status, setStatus] = useState("");
  // The offer only appears after someone says the output was useful — that is
  // the one moment the value is not hypothetical.
  const [rated, setRated] = useState<null | "good" | "bad">(null);

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
    setGenId(null);
    setChars(0);
    setStatus("Lagi siapin bahan lo...");
    setRated(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: spec.key,
          input: { ...values, ...extras.extraInput },
          ...(spec.platformPicker ? { platform } : {}),
        }),
      });

      if (!res.ok) throw new Error(await readErrorBody(res, "Kontennya belum berhasil dibikin."));

      let acc = "";
      let streamError: string | null = null;

      await readSSE(res, (msg) => {
        if (typeof msg.error === "string") {
          streamError = msg.error;
          return true;
        }
        if (typeof msg.status === "string") setStatus(msg.status);
        if (msg.done) {
          const g = msg.generation as { id?: string; output?: unknown } | undefined;
          setOut(g?.output ?? null);
          setGenId(typeof g?.id === "string" ? g.id : null);
          router.refresh();
          return true;
        }
        if (typeof msg.chunk === "string") {
          acc += msg.chunk;
          setChars(acc.length);
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
                {f.hint && <p className="mt-0.5 text-micro text-muted">{f.hint}</p>}
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

          <GenerationExtras extras={extras} disabled={busy} />
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

      {busy && (
        <GenerationProgress moduleKey={spec.key} chars={chars} label={spec.busy} status={status} />
      )}

      {out !== null && (
        <>
          <ModuleOutput moduleKey={spec.key} out={out} busy={busy} platform={platform} />
          {!busy && (
            <>
              <SaveToPipeline
                moduleKey={spec.key}
                out={out}
                genId={genId}
                values={values}
                platform={platform}
              />
              <div className="surface-card rounded-xl p-4">
                <RateResult generationId={genId} onRated={setRated} />
              </div>
              {rated === "good" && <OfferAfterWin credits={credits} />}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ModuleOutput({
  moduleKey,
  out,
  busy,
  platform,
}: {
  moduleKey: ModuleSpec["key"];
  out: unknown;
  busy: boolean;
  platform: string;
}) {
  if (moduleKey === "script") {
    return <ScriptView script={out as ScriptOutput} title="Script" platform={platform} />;
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
                <span className="shrink-0 rounded-full bg-ember/15 px-2 py-0.5 font-mono text-micro text-ember">
                  {h.score}
                </span>
              )}
            </div>
            {h.pattern && <p className="eyebrow mt-2 text-ember-lo">{h.pattern}</p>}
            {h.why && <p className="mt-1 text-micro leading-relaxed text-muted">{h.why}</p>}
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
      className="mt-3 cursor-pointer text-micro font-semibold text-muted underline-offset-2 hover:text-ember hover:underline"
    >
      {done ? "Kesalin!" : "Salin"}
    </button>
  );
}

/**
 * Send a module result into the pipeline.
 *
 * Hook Lab, Script and Repurpose had no route into the pipeline at all — only
 * the idea cards did. So the board's own empty state told people to "tap Simpan
 * ke pipeline di kartu hasilnya" on screens where no such control existed, and
 * a 4-credit script lived in history and nowhere else.
 *
 * The card is written in the shape PipelineBoard already reads, so a hook saved
 * here lands in Draft with its options intact and the Script button unlocked,
 * and a script lands in Siap ready to shoot. `generation_id` is carried through
 * so rating the card later still reaches the generation it came from.
 */
function SaveToPipeline({
  moduleKey,
  out,
  genId,
  values,
  platform,
}: {
  moduleKey: ModuleSpec["key"];
  out: unknown;
  genId: string | null;
  values: Record<string, string>;
  platform: string;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  if (moduleKey !== "hook" && moduleKey !== "script" && moduleKey !== "repurpose") return null;

  const idea = (values.idea || values.topic || values.content || "").trim();
  const title =
    idea.split(/\r?\n/)[0].slice(0, 90) ||
    ({ hook: "Hook tanpa judul", script: "Script tanpa judul", repurpose: "Konten tanpa judul" } as const)[
      moduleKey
    ];

  const save = async () => {
    setState("saving");
    setError("");
    try {
      // Matches what PipelineBoard expects, so the card arrives at the right
      // stage with the right next action rather than as an inert blob.
      const content =
        moduleKey === "hook"
          ? { angle: idea, generated_hook: out, chosen_hook: 0, platform }
          : moduleKey === "script"
            ? { angle: idea, generated_script: out, hook_seed: values.hook ?? "", platform }
            : { angle: idea, repurposed: out, platform };
      const status = moduleKey === "hook" ? "draft" : moduleKey === "script" ? "siap" : "ide";

      await saveToPipeline(title, content, genId ?? undefined, status);
      setState("saved");
      router.refresh();
    } catch (e: unknown) {
      setState("idle");
      setError(e instanceof Error ? e.message : "Gagal nyimpen ke pipeline.");
    }
  };

  return (
    <div className="surface-card rounded-xl p-4">
      {state === "saved" ? (
        <p className="text-mini leading-relaxed text-success">
          Kesimpen di pipeline. Buka tab Pipeline buat lanjutin.
        </p>
      ) : (
        <>
          <p className="text-mini leading-relaxed text-muted">
            Simpen ke pipeline biar gak ilang, dan bisa dilanjutin jadi konten
            jadi.
          </p>
          <button
            onClick={save}
            disabled={state === "saving"}
            className="mt-2.5 min-h-11 w-full cursor-pointer rounded-lg border border-ember/40 bg-ember/10 px-4 font-display text-mini font-bold text-ember disabled:opacity-50"
          >
            {state === "saving" ? "Nyimpen..." : "Simpan ke pipeline"}
          </button>
        </>
      )}
      {error && <p className="mt-2 text-micro leading-relaxed text-danger">{error}</p>}
    </div>
  );
}
