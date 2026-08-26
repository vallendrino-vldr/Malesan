"use client";

import { useState, useTransition } from "react";
import type { Persona } from "@/lib/supabase/database.types";
import {
  createPersona,
  updatePersona,
  deletePersona,
  setDefaultPersona,
  saveCta,
} from "@/app/actions/personas";

type Result = { ok: true } | { ok: false; error: string };

const NAME_MAX = 60;
const VOICE_MAX = 2000;
const LABEL_MAX = 60;

const inputCls =
  "w-full rounded-xl border border-white/[0.1] bg-[#09090b] px-4 py-3 text-sm text-ink placeholder:text-muted/60 transition-all focus:border-ember focus:bg-[#0c0c0e] focus:outline-none focus:ring-2 focus:ring-ember/20 disabled:opacity-60";

export function PersonaManager({ personas }: { personas: Persona[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (action: () => Promise<Result>, done?: () => void) =>
    start(async () => {
      setError(null);
      const result = await action();
      if (result.ok) done?.();
      else setError(result.error);
    });

  return (
    <div className="surface-card rounded-3xl border border-white/[0.08] bg-gradient-to-b from-surface-raised/90 via-surface to-[#0e0e11] p-5 sm:p-6 shadow-xl backdrop-blur-xl transition-all">
      {/* Header with Lucide Icon */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl border border-ember/30 bg-ember/15 text-ember shadow-xs">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-ink">
              Profil Konten &amp; Persona Suara
            </h2>
            <p className="text-xs sm:text-sm text-muted">
              Simpan gaya bicara spesifik untuk akun pribadi, toko, affiliate, atau klien.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Empty State */}
      {personas.length === 0 && editing !== "new" && (
        <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-[#09090b]/60 px-6 py-8 text-center backdrop-blur-xs">
          <div className="flex size-10 items-center justify-center rounded-full bg-white/[0.05] text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5 text-ember/70">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <p className="mt-3 text-xs sm:text-sm font-medium text-ink">
            Belum ada persona tambahan
          </p>
          <p className="mt-1 text-xs text-muted max-w-sm">
            Malesan otomatis menggunakan Profil Utama lo. Tambah persona jika ingin suara berbeda untuk tiap akun.
          </p>
        </div>
      )}

      {/* Persona List */}
      {personas.length > 0 && (
        <ul className="mt-5 space-y-3">
          {personas.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-white/[0.08] bg-[#09090b] p-4.5 shadow-inner transition-all hover:border-white/[0.15]"
            >
              {editing === p.id ? (
                <PersonaForm
                  idPrefix={`persona-${p.id}`}
                  initialName={p.name}
                  initialVoice={p.voice}
                  pending={pending}
                  submitLabel="Simpan Perubahan"
                  onCancel={() => setEditing(null)}
                  onSubmit={(name, voice) =>
                    run(() => updatePersona(p.id, name, voice), () => setEditing(null))
                  }
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm sm:text-base font-bold text-ink">
                        {p.name}
                      </span>
                      {p.is_default && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-micro font-bold text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-400" />
                          Utama
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs sm:text-sm leading-relaxed text-muted">
                    {p.voice}
                  </p>

                  {confirming === p.id ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
                      <span className="text-xs font-semibold text-rose-400">
                        Yakin hapus &quot;{p.name}&quot;?
                      </span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => deletePersona(p.id), () => setConfirming(null))}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 text-xs font-bold text-rose-300 hover:bg-rose-900/60 cursor-pointer"
                      >
                        {pending ? "Menghapus..." : "Iya, Hapus"}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setConfirming(null)}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-white/[0.1] bg-surface px-3 text-xs font-semibold text-muted hover:text-ink cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          setEditing(p.id);
                        }}
                        className="inline-flex h-8.5 items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] bg-surface/80 px-3 text-xs font-semibold text-ink hover:border-ember/40 hover:text-ember cursor-pointer transition-all"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        <span>Edit</span>
                      </button>

                      {!p.is_default && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => setDefaultPersona(p.id))}
                          className="inline-flex h-8.5 items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] bg-surface/80 px-3 text-xs font-semibold text-muted hover:border-emerald-500/40 hover:text-emerald-400 cursor-pointer transition-all"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>Jadikan Utama</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setConfirming(p.id)}
                        className="inline-flex h-8.5 items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] bg-surface/80 px-3 text-xs font-semibold text-muted hover:border-rose-500/40 hover:text-rose-400 cursor-pointer transition-all ml-auto"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add Button / New Form */}
      <div className="mt-5">
        {editing === "new" ? (
          <div className="rounded-2xl border border-ember/30 bg-[#09090b] p-4.5 shadow-inner">
            <PersonaForm
              idPrefix="persona-new"
              initialName=""
              initialVoice=""
              pending={pending}
              submitLabel="Simpan Persona Baru"
              onCancel={() => setEditing(null)}
              onSubmit={(name, voice) =>
                run(() => createPersona(name, voice), () => setEditing(null))
              }
            />
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              setEditing("new");
            }}
            className="group inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-ember/40 bg-ember/10 px-5 font-display text-xs sm:text-sm font-bold text-ember transition-all hover:border-ember hover:bg-ember/20 active:scale-[0.98] cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4 transition-transform group-hover:rotate-90">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>{personas.length === 0 ? "Bikin Profil Tambahan" : "Tambah Persona Baru"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function PersonaForm({
  idPrefix,
  initialName,
  initialVoice,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  initialName: string;
  initialVoice: string;
  pending: boolean;
  submitLabel: string;
  onSubmit: (name: string, voice: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [voice, setVoice] = useState(initialVoice);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name, voice);
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor={`${idPrefix}-name`} className="block text-xs font-bold text-ink">
          Nama Persona / Akun
        </label>
        <input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          disabled={pending}
          placeholder="Misal: Akun Affiliate Skincare / Klien Toko Kopi"
          className={`${inputCls} mt-1.5`}
          required
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor={`${idPrefix}-voice`} className="block text-xs font-bold text-ink">
            Instruksi Gaya Bicara &amp; Karakter
          </label>
          <span className="font-mono text-micro text-muted">
            {voice.length} / {VOICE_MAX}
          </span>
        </div>
        <p className="mt-1 text-micro text-muted">
          Ceritakan target audiens, bahasa santai/formal, platform utama, dan pantangan kata.
        </p>
        <textarea
          id={`${idPrefix}-voice`}
          rows={4}
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          maxLength={VOICE_MAX}
          disabled={pending}
          placeholder="Akun TikTok affiliate skincare untuk cewek 20-30. Gaya bahasa santai, kalimat singkat, gak pernah pakai kata 'sobat'."
          className={`${inputCls} mt-1.5`}
          required
        />
      </div>

      <div className="flex flex-wrap gap-2.5 pt-1">
        <button
          type="submit"
          disabled={pending || !name.trim() || !voice.trim()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-ember px-5 font-display text-xs font-bold text-obsidian shadow-xs transition-all hover:bg-ember-lo active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          {pending ? (
            <>
              <span className="size-3.5 rounded-full border-2 border-obsidian/30 border-t-obsidian animate-spin" />
              <span>Menyimpan...</span>
            </>
          ) : (
            <span>{submitLabel}</span>
          )}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.12] bg-surface px-4 text-xs font-semibold text-muted hover:text-ink cursor-pointer"
        >
          Batal
        </button>
      </div>
    </form>
  );
}

/**
 * High-End CTA Link Injection Settings with Live Content Simulation
 */
export function CtaSettings({
  initial,
}: {
  initial: { url: string; label: string; enabled: boolean };
}) {
  const [url, setUrl] = useState(initial.url);
  const [label, setLabel] = useState(initial.label);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const dirty = url !== initial.url || label !== initial.label || enabled !== initial.enabled;
  const shownLabel = label.trim() || "link gue";
  const shownUrl = url.trim() || "https://tokogue.com";

  const submit = () =>
    start(async () => {
      setError(null);
      setSaved(false);
      const result = await saveCta(url, label, enabled);
      if (result.ok) setSaved(true);
      else setError(result.error);
    });

  return (
    <div className="surface-card rounded-3xl border border-white/[0.08] bg-gradient-to-b from-surface-raised/90 via-surface to-[#0e0e11] p-5 sm:p-6 shadow-xl backdrop-blur-xl transition-all">
      {/* Header with Lucide Icon */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl border border-ember/30 bg-ember/15 text-ember shadow-xs">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-ink">
              Ajakan Penutup (Smart CTA Injection)
            </h2>
            <p className="text-xs sm:text-sm text-muted">
              Malesan menyelipkan ajakan ke link promosi lo secara halus dan natural di akhir konten.
            </p>
          </div>
        </div>
      </div>

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cta-url" className="block text-xs font-bold text-ink">
              Link Tujuan (URL)
            </label>
            <input
              id="cta-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setSaved(false);
              }}
              disabled={pending}
              placeholder="https://tokogue.com"
              className={`${inputCls} mt-1.5`}
            />
          </div>

          <div>
            <label htmlFor="cta-label" className="block text-xs font-bold text-ink">
              Nama Sebutan Link <span className="font-normal text-muted">(Opsional)</span>
            </label>
            <input
              id="cta-label"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setSaved(false);
              }}
              maxLength={LABEL_MAX}
              disabled={pending}
              placeholder="Misal: toko gue / link di bio"
              className={`${inputCls} mt-1.5`}
            />
          </div>
        </div>

        {/* Live Simulation Preview Card */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#08080a] shadow-inner">
          <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-display text-micro font-bold uppercase tracking-wider text-muted">
                Simulasi Penutup Konten
              </span>
            </div>
            <span className="rounded-full border border-white/[0.08] bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted">
              Auto-Contextual
            </span>
          </div>

          <div className="p-4">
            <p className="text-xs sm:text-sm leading-relaxed text-ink/90">
              &ldquo;...nah itu tadi tipsnya. Kalau mau langsung gas praktek, cek aja di{" "}
              <strong className="text-white underline decoration-ember/60 underline-offset-2">
                {shownLabel}
              </strong>{" "}
              — <span className="font-mono text-xs font-medium text-ember">{shownUrl}</span>&rdquo;
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              ✨ Kalimat bervariasi mengikuti topik konten lo. Link hanya muncul 1 kali di bagian akhir tanpa kesan jualan agresif.
            </p>
          </div>
        </div>

        {/* Interactive Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={pending}
          onClick={() => {
            setEnabled(!enabled);
            setSaved(false);
          }}
          className="flex min-h-12 w-full items-center justify-between gap-4 rounded-2xl border border-white/[0.1] bg-[#09090b] px-4 py-3 text-left transition-all hover:border-ember/40 active:scale-[0.99] cursor-pointer"
        >
          <div>
            <span className="block font-display text-xs sm:text-sm font-bold text-ink">
              Aktifkan Ajakan Penutup Otomatis
            </span>
            <span className="block text-micro text-muted">
              {enabled
                ? "Aktif — semua hasil generasi otomatis menyertakan link promosi lo."
                : "Nonaktif — hasil generasi tidak akan menyertakan link luar."}
            </span>
          </div>

          <div
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
              enabled ? "bg-ember" : "bg-surface-raised border border-white/[0.12]"
            }`}
          >
            <span
              className={`absolute top-1 size-4 rounded-full transition-all duration-200 ${
                enabled
                  ? "left-[calc(100%-1.25rem)] bg-obsidian shadow-sm"
                  : "left-1 bg-muted"
              }`}
            />
          </div>
        </button>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={pending || !dirty}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ember px-6 font-display text-xs sm:text-sm font-bold text-obsidian shadow-xs transition-all hover:bg-ember-lo active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {pending ? (
              <>
                <span className="size-3.5 rounded-full border-2 border-obsidian/30 border-t-obsidian animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>Simpan Pengaturan</span>
            )}
          </button>

          {dirty && !pending && (
            <span className="text-xs font-semibold text-amber-400">
              Ada perubahan belum disimpan
            </span>
          )}

          {saved && !dirty && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Pengaturan Berhasil Disimpan!</span>
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
