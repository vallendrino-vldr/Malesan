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

/**
 * The two settings that change how every future generation sounds: the saved
 * voices, and the link the AI is allowed to close with.
 *
 * Structural copy of what the actions return. Declared here rather than
 * imported so nothing but async functions ever crosses the "use server"
 * boundary — the shape is three keys wide and TypeScript matches it by shape.
 */
type Result = { ok: true } | { ok: false; error: string };

const NAME_MAX = 60;
const VOICE_MAX = 2000;
const LABEL_MAX = 60;

const inputCls =
  "w-full resize-none rounded-xl border border-hairline bg-obsidian px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember disabled:opacity-60";

const btnCls =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-hairline bg-surface-raised px-4 text-mini font-semibold text-ink transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember-lo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember disabled:opacity-60";

export function PersonaManager({ personas }: { personas: Persona[] }) {
  // One id at a time, or "new" for the create form. Two open editors would let
  // someone type into a row they think is saved and lose it on the next click.
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
    <div className="surface-card rounded-2xl p-5">
      <h2 className="font-display text-lg font-bold text-ink">Profil konten</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Punya akun pribadi, toko, affiliate, atau klien? Simpan cara ngomongnya di
        sini, lalu tinggal pilih waktu bikin konten. Profil default kepilih otomatis.
      </p>

      {error && (
        <p className="mt-3 rounded-xl border border-danger/50 bg-surface px-3.5 py-2.5 text-mini text-danger">
          {error}
        </p>
      )}

      {personas.length === 0 && editing !== "new" && (
        <p className="mt-4 rounded-xl border border-dashed border-hairline px-4 py-6 text-center text-mini leading-relaxed text-muted">
          Belum ada profil tambahan. Profil utama lo tetap bisa dipakai.
        </p>
      )}

      {personas.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {personas.map((p) => (
            <li key={p.id} className="rounded-xl border border-hairline bg-obsidian p-3.5">
              {editing === p.id ? (
                <PersonaForm
                  idPrefix={`persona-${p.id}`}
                  initialName={p.name}
                  initialVoice={p.voice}
                  pending={pending}
                  submitLabel="Simpan perubahan"
                  onCancel={() => setEditing(null)}
                  onSubmit={(name, voice) =>
                    run(() => updatePersona(p.id, name, voice), () => setEditing(null))
                  }
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{p.name}</span>
                    {p.is_default && (
                      <span className="rounded-full border border-ember/50 px-2 py-0.5 text-micro font-semibold text-ember">
                        Utama
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-3 text-mini leading-relaxed text-muted">{p.voice}</p>

                  {confirming === p.id ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-mini text-danger">Hapus &quot;{p.name}&quot;?</span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => deletePersona(p.id), () => setConfirming(null))}
                        className={`${btnCls} border-danger/50 text-danger hover:border-danger hover:text-danger`}
                      >
                        {pending ? "Lagi ngapus..." : "Iya, hapus"}
                      </button>
                      <button type="button" disabled={pending} onClick={() => setConfirming(null)} className={btnCls}>
                        Batal
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          setEditing(p.id);
                        }}
                        className={btnCls}
                      >
                        Edit
                      </button>
                      {!p.is_default && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => setDefaultPersona(p.id))}
                          className={btnCls}
                        >
                          Jadiin utama
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setConfirming(p.id)}
                        className={`${btnCls} text-muted hover:border-danger/50 hover:text-danger`}
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        {editing === "new" ? (
          <div className="rounded-xl border border-hairline bg-obsidian p-3.5">
            <PersonaForm
              idPrefix="persona-new"
              initialName=""
              initialVoice=""
              pending={pending}
              submitLabel="Simpen profil ini"
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
            className={btnCls}
          >
            {personas.length === 0 ? "Bikin profil tambahan" : "Tambah profil"}
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
    >
      <label htmlFor={`${idPrefix}-name`} className="block text-mini font-semibold text-ink">
        Nama profil
      </label>
      <input
        id={`${idPrefix}-name`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={NAME_MAX}
        disabled={pending}
        placeholder="Akun pribadi"
        className={`${inputCls} mt-1.5`}
      />

      <label htmlFor={`${idPrefix}-voice`} className="mt-3 block text-mini font-semibold text-ink">
        Yang bikin profil ini beda?
      </label>
      <p className="mt-1 text-micro leading-relaxed text-muted">
        Ceritain niche, target orangnya, tujuan, platform utama, dan cara ngomongnya.
        Gak perlu rapi — satu paragraf juga cukup.
      </p>
      <textarea
        id={`${idPrefix}-voice`}
        rows={4}
        value={voice}
        onChange={(e) => setVoice(e.target.value)}
        maxLength={VOICE_MAX}
        disabled={pending}
        placeholder="Akun affiliate skincare buat cewek 20–30. Fokus jualan halus di TikTok, bahasanya santai, kalimat pendek, gak pernah pakai kata ‘sobat’."
        className={`${inputCls} mt-1.5`}
      />
      <p className="mt-1 tabular text-micro text-muted">
        {voice.length.toLocaleString("id-ID")} / {VOICE_MAX.toLocaleString("id-ID")} karakter
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className={`${btnCls} border-ember/50 text-ember hover:border-ember`}
        >
          {pending ? "Lagi nyimpen..." : submitLabel}
        </button>
        <button type="button" disabled={pending} onClick={onCancel} className={btnCls}>
          Batal
        </button>
      </div>
    </form>
  );
}

/**
 * The closing CTA.
 *
 * The preview is a mock of the SHAPE, not the sentence the model will write —
 * the prompt asks for one casual line that fits whatever was just generated, so
 * promising exact wording here would be a lie. What it does show honestly is
 * where the link lands and what it gets called, which is the part the owner is
 * actually deciding.
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
    <div className="surface-card rounded-2xl p-5">
      <h2 className="font-display text-lg font-bold text-ink">Ajakan penutup</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Kalau nyala, tiap hasil bakal nutup dengan ajakan ke link lo — ditulis natural
        sama Malesan, nyambung sama isi kontennya, dan cuma sekali di paling akhir.
      </p>

      <form
        className="mt-4 space-y-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div>
          <label htmlFor="cta-url" className="block text-mini font-semibold text-ink">
            Link lo
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
          <label htmlFor="cta-label" className="block text-mini font-semibold text-ink">
            Sebutannya apa? <span className="font-normal text-muted">(opsional)</span>
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
            placeholder="toko gue"
            className={`${inputCls} mt-1.5`}
          />
          <p className="mt-1 text-micro leading-relaxed text-muted">
            Dikosongin? Link-nya disebut apa adanya.
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-obsidian p-3.5">
          <div className="eyebrow text-muted">Kira-kira nutupnya gini</div>
          <p className="mt-1.5 text-mini leading-relaxed text-ink">
            &ldquo;...oke segitu dulu. Kalau mau lanjut, mampir aja ke {shownLabel} —{" "}
            <span className="break-all text-ember">{shownUrl}</span>&rdquo;
          </p>
          <p className="mt-1.5 text-micro leading-relaxed text-muted">
            Kalimatnya beda-beda tiap hasil, nyesuain kontennya. Yang pasti cuma: link lo muncul
            sekali, di paling akhir, gak jualan keras.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={pending}
          onClick={() => {
            setEnabled(!enabled);
            setSaved(false);
          }}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-obsidian px-3.5 py-2.5 text-left transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember disabled:opacity-60"
        >
          <span>
            <span className="block text-sm font-semibold text-ink">Nyalain ajakan penutup</span>
            <span className="block text-micro text-muted">
              {enabled ? "Nyala — semua hasil bakal nutup ke link lo." : "Mati — hasilnya gak nyebut link lo sama sekali."}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-[var(--duration-standard)] ease-heat ${
              enabled ? "border-ember bg-ember/30" : "border-hairline bg-surface-raised"
            }`}
          >
            <span
              className={`absolute top-1/2 size-4 -translate-y-1/2 rounded-full transition-all duration-[var(--duration-standard)] ease-heat ${
                enabled ? "left-[calc(100%-1.25rem)] bg-ember" : "left-1 bg-muted"
              }`}
            />
          </span>
        </button>

        {error && (
          <p className="rounded-xl border border-danger/50 bg-surface px-3.5 py-2.5 text-mini text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || !dirty}
            className={`${btnCls} border-ember/50 text-ember hover:border-ember`}
          >
            {pending ? "Lagi nyimpen..." : "Simpan"}
          </button>
          {dirty && !pending && (
            <span className="text-micro text-muted">Ada perubahan yang belum kesimpen.</span>
          )}
          {saved && !dirty && <span className="text-micro text-success">Kesimpen.</span>}
        </div>
      </form>
    </div>
  );
}
