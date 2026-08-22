"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { readErrorBody } from "@/lib/sse";
import type { Draft } from "@/lib/supabase/database.types";
import { DraftReactions } from "./DraftReactions";

/**
 * The writing surface.
 *
 * Two things here are load-bearing and easy to get wrong.
 *
 * 1. Autosave tells the truth. `.update()` on PostgREST without `.select()`
 *    cannot distinguish "saved" from "matched no rows" — both come back with no
 *    error — so every write asks for the row back and a missing row is treated
 *    as a failure. An editor that says "Kesimpen" over a write that silently
 *    matched nothing is the worst bug this file could have: the user closes the
 *    tab believing their work is safe.
 *
 * 2. The ghost text is a mirror, not a textarea trick. A textarea cannot render
 *    two colours, so a div underneath holds the same string with identical
 *    typography — the real text invisible, the suggestion in muted — and the
 *    transparent textarea sits exactly on top of it. The mirror is what sets the
 *    height, so the box grows to fit a suggestion instead of scrolling out of
 *    sync with it.
 */

type SaveState = "saved" | "dirty" | "saving" | "error";

const SAVE_LABEL: Record<SaveState, string> = {
  saved: "Kesimpen",
  dirty: "Belum kesimpen",
  saving: "Nyimpen…",
  error: "Gagal nyimpen — coba lagi",
};

/** Keeps a trailing newline in the ghost mirror from collapsing. */
const ZWSP = "​";

/** How long the typing has to stop before a write goes out. */
const AUTOSAVE_MS = 1_500;

/** What the model gets to read. The route rejects anything longer. */
const CONTEXT_CHARS = 4_000;

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "barusan";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days} hari lalu` : new Date(iso).toLocaleDateString("id-ID");
}

/* ------------------------------------------------------------------ editor */

export function DraftEditor({
  draft,
  userId,
  onSaved,
  onClose,
}: {
  draft: Draft;
  userId: string;
  /** Keeps the list behind the editor honest without a refetch. */
  onSaved?: (patch: { title: string; content: string; updated_at: string }) => void;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [title, setTitle] = useState(draft.title);
  const [content, setContent] = useState(draft.content);
  const [state, setState] = useState<SaveState>("saved");

  const [ghost, setGhost] = useState("");
  const [ghostBusy, setGhostBusy] = useState(false);
  const [ghostError, setGhostError] = useState("");

  const taRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** What the user has typed right now, readable from callbacks that outlive a render. */
  const latest = useRef({ title: draft.title, content: draft.content });
  /** What the database is known to hold. */
  const stored = useRef({ title: draft.title, content: draft.content });
  /** Rising counter so a slow write cannot report over a newer one. */
  const seq = useRef(0);
  /**
   * Escape arms the next Tab to move focus instead of asking for a completion.
   * Without it, a caret at the end of a non-empty draft would swallow every Tab
   * and there would be no way to leave the field from the keyboard.
   */
  const tabEscapes = useRef(false);

  const save = async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const next = { ...latest.current };
    if (next.title === stored.current.title && next.content === stored.current.content) return;

    const mine = ++seq.current;
    setState("saving");

    // Scoped by user_id as well as id. RLS already enforces ownership; the extra
    // filter means a tampered id cannot even be used to probe for a row.
    const { data, error } = await supabase
      .from("drafts")
      .update({
        title: next.title,
        content: next.content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.id)
      .eq("user_id", userId)
      .select("id, updated_at")
      .maybeSingle();

    if (mine !== seq.current) return; // a newer save is already in flight

    if (error || !data) {
      setState("error");
      return;
    }
    stored.current = next;
    setState("saved");
    onSaved?.({ ...next, updated_at: data.updated_at });
  };

  // The latest-ref pattern: the unmount cleanup below runs once, so it needs a
  // stable handle onto the current closure rather than the one from first render.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      // Closing the editor is the most likely moment for unsaved keystrokes to
      // exist. Fire and forget — the component is going away, but the request
      // is not tied to it.
      void saveRef.current();
    };
  }, []);

  const edit = (patch: Partial<{ title: string; content: string }>) => {
    latest.current = { ...latest.current, ...patch };
    if (patch.title !== undefined) setTitle(patch.title);
    if (patch.content !== undefined) setContent(patch.content);
    setState("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void saveRef.current(), AUTOSAVE_MS);
  };

  const askCompletion = async () => {
    const text = latest.current.content;
    if (!text.trim()) {
      setGhostError("Tulis dulu satu kalimat, baru gue sambungin.");
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setGhost("");
    setGhostError("");
    setGhostBusy(true);

    try {
      const res = await fetch("/api/autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The tail, not the whole draft. A long piece still gets a suggestion;
        // it is just written from the last few paragraphs of context.
        body: JSON.stringify({ text: text.slice(-CONTEXT_CHARS), draftId: draft.id }),
        signal: ac.signal,
      });

      if (!res.ok) throw new Error(await readErrorBody(res, "Gagal nyambungin kalimat."));

      const json = (await res.json()) as { completion?: string };
      const completion = json.completion ?? "";
      if (!completion) {
        setGhostError("Modelnya lagi mentok. Tambahin satu-dua kata dulu, terus coba lagi.");
        return;
      }
      setGhost(completion);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setGhostError(e instanceof Error ? e.message : "Gagal nyambungin kalimat.");
    } finally {
      if (abortRef.current === ac) setGhostBusy(false);
    }
  };

  const accept = () => {
    if (!ghost) return;
    const merged = latest.current.content + ghost;
    setGhost("");
    edit({ content: merged });
    // Put the caret back where the sentence now ends, or the next keystroke
    // lands wherever it was before the text grew.
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(merged.length, merged.length);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      if (ghost || ghostError) {
        e.preventDefault();
        setGhost("");
        setGhostError("");
      }
      tabEscapes.current = true;
      return;
    }

    if (e.key === "Tab") {
      // Shift+Tab always walks backwards, and an armed Escape lets Tab out.
      if (e.shiftKey || tabEscapes.current) {
        tabEscapes.current = false;
        return;
      }
      if (ghost) {
        e.preventDefault();
        accept();
        return;
      }
      const ta = e.currentTarget;
      const atEnd =
        ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length;
      // Empty draft or caret mid-text: Tab stays Tab and moves focus, which is
      // what every other field on the site does.
      if (!ta.value.trim() || !atEnd || ghostBusy) return;
      e.preventDefault();
      void askCompletion();
      return;
    }

    tabEscapes.current = false;

    if (ghost) {
      if (e.key === "Enter") {
        e.preventDefault();
        accept();
        return;
      }
      // Anything that changes the text or moves the caret invalidates the
      // suggestion. Bare modifiers and F-keys do not.
      if (e.key.length === 1 || e.key.startsWith("Arrow") || e.key === "Backspace" || e.key === "Delete") {
        setGhost("");
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onClose}
          className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-hairline pl-2 pr-3.5 text-mini font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
            <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6 4.6-4.6Z" />
          </svg>
          Semua draf
        </button>

        <span
          // Polite, so a save that lands while someone is typing does not
          // interrupt their screen reader mid-word.
          aria-live="polite"
          className={`text-mini font-semibold ${
            state === "error" ? "text-danger" : state === "saved" ? "text-success" : "text-muted"
          }`}
        >
          {SAVE_LABEL[state]}
        </span>

        {state === "error" && (
          <button
            onClick={() => void save()}
            className="min-h-11 cursor-pointer rounded-full border border-danger/40 px-3.5 text-mini font-semibold text-danger transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-danger/10"
          >
            Simpen ulang
          </button>
        )}
      </div>

      <section className="surface-card rounded-2xl p-4 sm:p-5">
        <label htmlFor="draft-title" className="eyebrow block text-muted">
          Judul
        </label>
        <input
          id="draft-title"
          value={title}
          onChange={(e) => edit({ title: e.target.value })}
          onBlur={() => void save()}
          placeholder="Judul draf"
          maxLength={200}
          className="mt-1.5 w-full rounded-xl border border-transparent bg-transparent px-0 py-1 font-display text-xl font-bold tracking-display-sm text-ink placeholder:text-muted focus:outline-none focus-visible:border-ember focus-visible:px-3 focus-visible:ring-1 focus-visible:ring-ember"
        />

        <div className="mt-3 flex items-center justify-between gap-2">
          <label htmlFor="draft-body" className="eyebrow text-muted">
            Isi
          </label>
          <span className="tabular text-micro text-muted">{content.length} karakter</span>
        </div>

        <div className="skeu-inset relative mt-1.5 rounded-xl border border-hairline bg-obsidian focus-within:border-ember focus-within:ring-1 focus-within:ring-ember">
          {/* Height comes from here, so a suggestion that wraps onto a new line
              grows the box instead of being clipped. The zero-width space keeps
              a trailing newline from collapsing, which would make the mirror one
              line shorter than the textarea. */}
          <div
            aria-hidden="true"
            className="pointer-events-none min-h-64 break-words p-3.5 text-sm leading-relaxed whitespace-pre-wrap"
          >
            <span className="invisible">{content}</span>
            {ghost && <span className="text-muted">{ghost}</span>}
            {ZWSP}
          </div>
          <textarea
            id="draft-body"
            ref={taRef}
            value={content}
            onChange={(e) => {
              if (ghost) setGhost("");
              edit({ content: e.target.value });
            }}
            onKeyDown={onKeyDown}
            onBlur={() => void save()}
            placeholder="Mulai nulis. Tab buat minta sambungan."
            className="absolute inset-0 h-full w-full resize-none overflow-hidden break-words rounded-xl bg-transparent p-3.5 text-sm leading-relaxed text-ink placeholder:text-muted focus:outline-none"
          />
        </div>

        {/* The keyboard shortcut is not the only way in. Tab is a hint, this is
            the affordance — and it is what makes the feature reachable on a
            phone, where there is no Tab key at all. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {ghost ? (
            <>
              <button
                onClick={accept}
                className="min-h-11 cursor-pointer rounded-xl bg-ember px-4 font-display text-mini font-bold text-obsidian transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo"
              >
                Pakai sambungannya
              </button>
              <button
                onClick={() => setGhost("")}
                className="min-h-11 cursor-pointer rounded-xl border border-hairline px-4 text-mini font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:text-ink"
              >
                Buang
              </button>
              <span className="text-micro text-muted">Tab atau Enter buat pakai, Escape buat buang.</span>
            </>
          ) : (
            <>
              <button
                onClick={() => void askCompletion()}
                disabled={ghostBusy || !content.trim()}
                className="min-h-11 cursor-pointer rounded-xl border border-ember/45 px-4 text-mini font-semibold text-ember transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember hover:bg-ember/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ghostBusy ? "Lagi mikirin buat lo..." : "Sambungin kalimat"}
              </button>
              <span className="text-micro text-muted">
                Atau tekan Tab di ujung tulisan. Escape terus Tab kalau mau pindah field.
              </span>
            </>
          )}
        </div>

        {/* The suggestion is rendered as colour, which a screen reader cannot
            see. This is the same text, announced once. */}
        <p aria-live="polite" className="sr-only">
          {ghost ? `Sambungan: ${ghost}` : ""}
        </p>

        {ghostError && (
          <p className="mt-3 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {ghostError}
          </p>
        )}
      </section>

      {/* Instant audience test: netizen comments + editor roast on the live draft. */}
      <DraftReactions text={content} />
    </div>
  );
}

/* --------------------------------------------------------------- workspace */

export function DraftWorkspace({
  initialDrafts,
  userId,
}: {
  initialDrafts: Draft[];
  userId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [drafts, setDrafts] = useState<Draft[]>(initialDrafts);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** Delete is two taps, not one. `confirming` holds the id waiting for the second. */
  const [confirming, setConfirming] = useState<string | null>(null);

  const open = drafts.find((d) => d.id === openId) ?? null;

  const create = async () => {
    setBusy(true);
    setError("");
    const { data, error: insertError } = await supabase
      .from("drafts")
      .insert({ user_id: userId, title: "Draf tanpa judul", content: "" })
      .select()
      .single();
    setBusy(false);

    if (insertError || !data) {
      setError("Gagal bikin draf baru. Coba lagi sebentar lagi ya.");
      return;
    }
    setDrafts((list) => [data, ...list]);
    setOpenId(data.id);
  };

  const remove = async (id: string) => {
    setError("");
    // `.select()` on the delete for the same reason as the update: without it a
    // delete that matched nothing looks identical to one that worked, and the
    // row would vanish from the list while still sitting in the database.
    const { data, error: deleteError } = await supabase
      .from("drafts")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (deleteError || !data) {
      setError("Gagal ngehapus draf itu. Coba lagi.");
      return;
    }
    setConfirming(null);
    setDrafts((list) => list.filter((d) => d.id !== id));
    if (openId === id) setOpenId(null);
  };

  if (open) {
    return (
      <DraftEditor
        // Remount per draft, so no state from the previous one can leak in.
        key={open.id}
        draft={open}
        userId={userId}
        onSaved={(patch) =>
          setDrafts((list) =>
            list.map((d) => (d.id === open.id ? { ...d, ...patch } : d)),
          )
        }
        onClose={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => void create()}
        disabled={busy}
        className="w-full cursor-pointer rounded-xl bg-ember px-5 py-3.5 font-display text-sm font-bold text-obsidian transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Lagi bikin..." : "Draf baru"}
      </button>

      {error && (
        <p className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {drafts.length === 0 ? (
        <div className="surface-card rounded-2xl px-5 py-10 text-center">
          <p className="font-display text-lg font-bold text-ink">Belum ada draf.</p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
            Ya udah, mulai satu. Tulis seadanya, sisanya tinggal tekan Tab.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="surface-card surface-card-interactive flex items-center gap-2 rounded-xl p-3.5"
            >
              <button
                onClick={() => setOpenId(d.id)}
                className="min-w-0 flex-1 cursor-pointer text-left"
              >
                <span className="block truncate font-display text-sm font-bold text-ink">
                  {d.title?.trim() || "Draf tanpa judul"}
                </span>
                <span className="mt-0.5 block truncate text-mini text-muted">
                  {d.content.trim()
                    ? `${d.content.trim().slice(0, 80)} · ${timeAgo(d.updated_at)}`
                    : `Masih kosong · ${timeAgo(d.updated_at)}`}
                </span>
              </button>

              {confirming === d.id ? (
                <span className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => void remove(d.id)}
                    className="min-h-11 cursor-pointer rounded-full border border-danger/40 px-3 text-micro font-semibold text-danger transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-danger/10"
                  >
                    Yakin, hapus
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    className="min-h-11 cursor-pointer rounded-full border border-hairline px-3 text-micro font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:text-ink"
                  >
                    Batal
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirming(d.id)}
                  aria-label={`Hapus draf ${d.title?.trim() || "tanpa judul"}`}
                  className="flex min-h-11 shrink-0 cursor-pointer items-center rounded-full border border-hairline px-3 text-micro font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-danger/40 hover:text-danger"
                >
                  Hapus
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
