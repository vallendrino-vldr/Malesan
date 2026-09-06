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
import { useLanguage } from "@/lib/i18n/LanguageContext";

type Result = { ok: true } | { ok: false; error: string };

const NAME_MAX = 60;
const VOICE_MAX = 2000;
const LABEL_MAX = 60;

const PLATFORMS = ["tiktok", "instagram", "youtube", "x", "threads"];

const inputCls =
  "w-full rounded-xl border border-white/[0.1] bg-[#09090b] px-4 py-3 text-sm text-ink placeholder:text-muted/60 transition-all focus:border-ember focus:bg-[#0c0c0e] focus:outline-none focus:ring-2 focus:ring-ember/20 disabled:opacity-60";

export function PersonaManager({ personas }: { personas: Persona[] }) {
  const { dict, language } = useLanguage();
  const pr = dict.profile;

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
              {pr.personaTitle}
            </h2>
            <p className="text-xs sm:text-sm text-muted">
              {pr.personaSubtitle}
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
            {pr.personaEmptyTitle}
          </p>
          <p className="mt-1 text-xs text-muted max-w-sm">
            {pr.personaEmptyDesc}
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
                  submitLabel={pr.personaSaveChange}
                  onCancel={() => setEditing(null)}
                  onSubmit={(name, voice) =>
                    run(() => updatePersona(p.id, name, voice, language), () => setEditing(null))
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
                          {pr.personaBadgePrimary}
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
                        {pr.personaDeleteConfirm(p.name)}
                      </span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => deletePersona(p.id, language), () => setConfirming(null))}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 text-xs font-bold text-rose-300 hover:bg-rose-900/60 cursor-pointer"
                      >
                        {pending ? pr.personaDeleting : pr.personaDeleteAction}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setConfirming(null)}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-white/[0.1] bg-surface px-3 text-xs font-semibold text-muted hover:text-ink cursor-pointer"
                      >
                        {pr.personaCancel}
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
                        <span>{pr.personaEdit}</span>
                      </button>

                      {!p.is_default && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => setDefaultPersona(p.id, language))}
                          className="inline-flex h-8.5 items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] bg-surface/80 px-3 text-xs font-semibold text-muted hover:border-emerald-500/40 hover:text-emerald-400 cursor-pointer transition-all"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>{pr.personaSetPrimary}</span>
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
                        <span>{pr.personaDelete}</span>
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
          <div className="rounded-2xl border border-ember/30 bg-[#09090b] p-4.5 sm:p-6 shadow-inner">
            <PersonaForm
              idPrefix="persona-new"
              initialName=""
              initialVoice=""
              pending={pending}
              submitLabel={pr.personaSaveNew}
              onCancel={() => setEditing(null)}
              onSubmit={(name, voice) =>
                run(() => createPersona(name, voice, language), () => setEditing(null))
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
            <span>{personas.length === 0 ? pr.personaCreateAdditional : pr.personaAddNew}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Interactive 3-Step Wizard for Adding/Editing Persona Profiles
 * (Identical structured flow to Onboarding: Context -> Voice/Tone -> Detail/Platform)
 */
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
  const { language, dict } = useLanguage();
  const pr = dict.profile;
  const isEn = language === "en";

  const [mode, setMode] = useState<"wizard" | "manual">(() => (initialVoice ? "manual" : "wizard"));
  const [step, setStep] = useState(0);

  // Manual raw fields
  const [name, setName] = useState(initialName);
  const [manualVoice, setManualVoice] = useState(initialVoice);

  // Wizard structured fields
  const [f, setF] = useState({
    name: initialName,
    niche: "",
    industry: "",
    work_context: "sendiri",
    client_brief: "",
    target_audience: "",
    goals: "",
    persona_style_index: 0,
    humor_level: 5,
    content_pillars: "",
    banned_words: "",
    platforms: ["tiktok", "instagram"] as string[],
  });

  const setField = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const togglePlatform = (p: string) =>
    setF((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(p)
        ? prev.platforms.filter((x) => x !== p)
        : [...prev.platforms, p],
    }));

  // Compile wizard structured fields into a coherent AI persona prompt
  const compileVoice = () => {
    const parts: string[] = [];
    if (f.niche.trim()) parts.push(isEn ? `Niche/Topic: ${f.niche.trim()}` : `Niche/Topik: ${f.niche.trim()}`);
    if (f.industry.trim()) parts.push(isEn ? `Industry: ${f.industry.trim()}` : `Industri: ${f.industry.trim()}`);

    const isClientContext = f.work_context === "klien" || f.work_context === "client";
    const isBrandContext = f.work_context === "brand" || f.work_context === "business";

    if (isClientContext) {
      parts.push(isEn ? `Context: Content created for client (${f.client_brief.trim() || "business client"}). Professional & objective perspective.` : `Konteks: Konten dibuat untuk klien (${f.client_brief.trim() || "klien bisnis"}). Sudut pandang profesional & objektif.`);
    } else if (isBrandContext) {
      parts.push(isEn ? `Context: Business/brand account (${f.client_brief.trim() || "brand"}). Company representative tone.` : `Konteks: Akun bisnis/brand (${f.client_brief.trim() || "brand"}). Nada perwakilan bisnis.`);
    } else {
      parts.push(isEn ? `Context: Creator personal brand. First-person perspective ('I').` : `Konteks: Personal brand kreator. Sudut pandang orang pertama ('gue').`);
    }

    if (f.target_audience.trim()) parts.push(isEn ? `Target Audience: ${f.target_audience.trim()}` : `Target Audiens: ${f.target_audience.trim()}`);
    const selectedStyle = pr.personaStyles[f.persona_style_index ?? 0] || pr.personaStyles[0];
    if (selectedStyle) parts.push(isEn ? `Tone/Style: ${selectedStyle}` : `Gaya Bahasa: ${selectedStyle}`);
    parts.push(isEn ? `Humor Level: ${f.humor_level}/10` : `Tingkat Humor: ${f.humor_level}/10`);
    if (f.goals.trim()) parts.push(isEn ? `Content Goal: ${f.goals.trim()}` : `Tujuan Konten: ${f.goals.trim()}`);
    if (f.platforms.length > 0) parts.push(isEn ? `Primary Platforms: ${f.platforms.join(", ")}` : `Platform Utama: ${f.platforms.join(", ")}`);
    if (f.content_pillars.trim()) parts.push(isEn ? `Content Pillars: ${f.content_pillars.trim()}` : `Pilar Konten: ${f.content_pillars.trim()}`);
    if (f.banned_words.trim()) parts.push(isEn ? `Forbidden Words: ${f.banned_words.trim()}` : `Kata Haram: ${f.banned_words.trim()}`);

    return parts.join(" | ");
  };

  const handleWizardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = f.name.trim() || name.trim() || (isEn ? "New Persona" : "Persona Baru");
    const finalVoice = compileVoice();
    onSubmit(finalName, finalVoice);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(name.trim(), manualVoice.trim());
  };

  const wizardSteps = [
    { title: pr.personaStep1Title, desc: pr.personaStep1Desc },
    { title: pr.personaStep2Title, desc: pr.personaStep2Desc },
    { title: pr.personaStep3Title, desc: pr.personaStep3Desc },
  ];

  return (
    <div className="space-y-4">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("wizard")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              mode === "wizard"
                ? "bg-ember/20 text-ember border border-ember/40 shadow-xs"
                : "text-muted hover:text-ink"
            }`}
          >
            <span className="flex items-center gap-1.5 justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5 text-ember"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              <span>{pr.personaTabWizard}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("manual");
              if (!manualVoice && f.niche) {
                setManualVoice(compileVoice());
              }
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              mode === "manual"
                ? "bg-ember/20 text-ember border border-ember/40 shadow-xs"
                : "text-muted hover:text-ink"
            }`}
          >
            {pr.personaTabManual}
          </button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted hover:text-ink cursor-pointer"
        >
          {pr.personaClose}
        </button>
      </div>

      {mode === "wizard" ? (
        <form onSubmit={handleWizardSubmit} className="space-y-5">
          {/* Step indicator */}
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/[0.08] bg-[#070709] p-1.5">
            {wizardSteps.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => setStep(i)}
                className={`flex flex-col items-center justify-center rounded-xl py-2 text-center transition-all cursor-pointer ${
                  i === step
                    ? "border border-ember/40 bg-ember/15 text-ember shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span className="font-display text-xs font-bold">{s.title}</span>
                <span className="hidden sm:inline-block text-[10px] text-muted/80">{s.desc}</span>
              </button>
            ))}
          </div>

          {/* STEP 1: Konteks & Niche */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink">
                  {pr.personaFieldName} <span className="text-ember font-bold">*</span>
                </label>
                <input
                  value={f.name}
                  onChange={(e) => setField("name", e.target.value)}
                  maxLength={NAME_MAX}
                  placeholder={pr.personaPlaceholderName}
                  className={`${inputCls} mt-1.5`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink">
                  {pr.personaFieldNiche} <span className="text-ember font-bold">*</span>
                </label>
                <input
                  value={f.niche}
                  onChange={(e) => setField("niche", e.target.value)}
                  placeholder={pr.personaPlaceholderNiche}
                  className={`${inputCls} mt-1.5`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink">
                  {pr.personaFieldAudienceWho}
                </label>
                <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
                  {pr.personaWorkContexts.map((w) => {
                    const on = f.work_context === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setField("work_context", w.id)}
                        className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                          on
                            ? "border-ember/60 bg-ember/15 shadow-xs"
                            : "border-white/[0.08] bg-[#070709] hover:border-white/[0.18]"
                        }`}
                      >
                        <p className={`font-display text-xs font-bold ${on ? "text-ember" : "text-ink"}`}>
                          {w.label}
                        </p>
                        <p className="mt-1 text-micro text-muted leading-tight">{w.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(f.work_context === "klien" || f.work_context === "client" || f.work_context === "brand" || f.work_context === "business") && (
                <div>
                  <label className="block text-xs font-bold text-ink">
                    {pr.personaFieldClientBrief}
                  </label>
                  <textarea
                    rows={2}
                    value={f.client_brief}
                    onChange={(e) => setField("client_brief", e.target.value)}
                    placeholder={pr.personaPlaceholderClientBrief}
                    className={`${inputCls} mt-1.5`}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-ink">
                  {pr.personaFieldIndustry} <span className="font-normal text-muted">{pr.personaOptional}</span>
                </label>
                <input
                  value={f.industry}
                  onChange={(e) => setField("industry", e.target.value)}
                  placeholder={pr.personaPlaceholderIndustry}
                  className={`${inputCls} mt-1.5`}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Karakter & Nada Suara */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink">
                  {pr.personaFieldTargetAudience}
                </label>
                <input
                  value={f.target_audience}
                  onChange={(e) => setField("target_audience", e.target.value)}
                  placeholder={pr.personaPlaceholderTargetAudience}
                  className={`${inputCls} mt-1.5`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink">
                  {pr.personaFieldStyle}
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pr.personaStyles.map((ps, idx) => {
                    const on = (f.persona_style_index ?? 0) === idx;
                    return (
                      <button
                        key={ps}
                        type="button"
                        onClick={() => setField("persona_style_index", idx)}
                        className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                          on
                            ? "border-ember bg-ember/15 text-ember shadow-xs font-bold"
                            : "border-white/[0.1] bg-[#070709] text-muted hover:text-ink"
                        }`}
                      >
                        {ps}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-bold text-ink">
                  <span>{pr.personaFieldHumor}</span>
                  <span className="font-mono text-ember">{f.humor_level} / 10</span>
                </div>
                <div className="mt-2 flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#070709] p-3.5">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={f.humor_level}
                    onChange={(e) => setField("humor_level", Number(e.target.value))}
                    className="h-2 flex-1 accent-ember cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink">
                  {pr.personaFieldGoals} <span className="font-normal text-muted">{pr.personaOptional}</span>
                </label>
                <input
                  value={f.goals}
                  onChange={(e) => setField("goals", e.target.value)}
                  placeholder={pr.personaPlaceholderGoals}
                  className={`${inputCls} mt-1.5`}
                />
              </div>
            </div>
          )}

          {/* STEP 3: Detail, Platform & Live Preview */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink">
                  {pr.personaFieldPlatforms}
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => {
                    const on = f.platforms.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePlatform(p)}
                        className={`rounded-xl border px-3.5 py-2 text-xs font-bold capitalize transition-all cursor-pointer ${
                          on
                            ? "border-ember bg-ember/20 text-ember shadow-xs"
                            : "border-white/[0.1] bg-[#070709] text-muted hover:text-ink"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink">
                  {pr.personaFieldPillars} <span className="font-normal text-muted">{pr.personaCommaSeparated}</span>
                </label>
                <input
                  value={f.content_pillars}
                  onChange={(e) => setField("content_pillars", e.target.value)}
                  placeholder={pr.personaPlaceholderPillars}
                  className={`${inputCls} mt-1.5`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink">
                  {pr.personaFieldBannedWords} <span className="font-normal text-muted">{pr.personaCommaSeparated}</span>
                </label>
                <input
                  value={f.banned_words}
                  onChange={(e) => setField("banned_words", e.target.value)}
                  placeholder={pr.personaPlaceholderBannedWords}
                  className={`${inputCls} mt-1.5`}
                />
              </div>

              {/* Live Compiled Prompt Preview */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#070709] p-3.5">
                <div className="flex items-center justify-between text-micro font-bold uppercase tracking-wider text-muted">
                  <span>{pr.personaPreviewTitle}</span>
                  <span className="text-ember font-semibold">{pr.personaPreviewSubtitle}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink/85 italic">
                  &ldquo;{compileVoice() || pr.personaPreviewPlaceholder}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-between border-t border-white/[0.08] pt-4">
            {step === 0 ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.12] bg-surface px-4 text-xs font-semibold text-muted hover:text-ink cursor-pointer"
              >
                {pr.personaCancel}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.12] bg-surface px-4 text-xs font-semibold text-muted hover:text-ink cursor-pointer"
              >
                {pr.personaBtnBack}
              </button>
            )}

            {step < 2 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-ember px-5 font-display text-xs font-bold text-obsidian shadow-xs hover:bg-ember-lo active:scale-[0.98] cursor-pointer"
              >
                <span>{pr.personaBtnNextStep(step + 2)}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending || !f.name.trim() || !f.niche.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-ember px-6 font-display text-xs font-bold text-obsidian shadow-xs hover:bg-ember-lo active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {pending ? (
                  <>
                    <span className="size-3.5 rounded-full border-2 border-obsidian/30 border-t-obsidian animate-spin" />
                    <span>{pr.personaSaving}</span>
                  </>
                ) : (
                  <>
                    <span>{submitLabel}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      ) : (
        /* MANUAL RAW FORM */
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label htmlFor={`${idPrefix}-name`} className="block text-xs font-bold text-ink">
              {pr.personaFieldName} <span className="text-ember font-bold">*</span>
            </label>
            <input
              id={`${idPrefix}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX}
              disabled={pending}
              placeholder={pr.personaPlaceholderName}
              className={`${inputCls} mt-1.5`}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor={`${idPrefix}-voice`} className="block text-xs font-bold text-ink">
                {pr.personaFieldManualVoice} <span className="text-ember font-bold">*</span>
              </label>
              <span className="font-mono text-micro text-muted">
                {manualVoice.length} / {VOICE_MAX}
              </span>
            </div>
            <p className="mt-1 text-micro text-muted">
              {pr.personaManualVoiceHint}
            </p>
            <textarea
              id={`${idPrefix}-voice`}
              rows={4}
              value={manualVoice}
              onChange={(e) => setManualVoice(e.target.value)}
              maxLength={VOICE_MAX}
              disabled={pending}
              placeholder={pr.personaPlaceholderManualVoice}
              className={`${inputCls} mt-1.5`}
              required
            />
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="submit"
              disabled={pending || !name.trim() || !manualVoice.trim()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-ember px-5 font-display text-xs font-bold text-obsidian shadow-xs transition-all hover:bg-ember-lo active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {pending ? (
                <>
                  <span className="size-3.5 rounded-full border-2 border-obsidian/30 border-t-obsidian animate-spin" />
                  <span>{pr.personaSaving}</span>
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
              {pr.personaCancel}
            </button>
          </div>
        </form>
      )}
    </div>
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
  const { dict, language } = useLanguage();
  const pr = dict.profile;

  const [url, setUrl] = useState(initial.url);
  const [label, setLabel] = useState(initial.label);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const dirty = url !== initial.url || label !== initial.label || enabled !== initial.enabled;
  const shownLabel = label.trim() || pr.ctaDefaultLabel;
  const shownUrl = url.trim() || pr.ctaDefaultUrl;

  const submit = () =>
    start(async () => {
      setError(null);
      setSaved(false);
      const result = await saveCta(url, label, enabled, language);
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
              {pr.ctaTitle}
            </h2>
            <p className="text-xs sm:text-sm text-muted">
              {pr.ctaSubtitle}
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
              {pr.ctaUrlLabel}
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
              placeholder={pr.ctaUrlPlaceholder}
              className={`${inputCls} mt-1.5`}
            />
          </div>

          <div>
            <label htmlFor="cta-label" className="block text-xs font-bold text-ink">
              {pr.ctaNameLabel} <span className="font-normal text-muted">{pr.personaOptional}</span>
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
              placeholder={pr.ctaNamePlaceholder}
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
                {pr.ctaSimTitle}
              </span>
            </div>
            <span className="rounded-full border border-white/[0.08] bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted">
              {pr.ctaSimBadge}
            </span>
          </div>

          <div className="p-4">
            <p className="text-xs sm:text-sm leading-relaxed text-ink/90">
              &ldquo;{pr.ctaSimExampleBefore}
              <strong className="text-white underline decoration-ember/60 underline-offset-2">
                {shownLabel}
              </strong>
              {pr.ctaSimExampleAfter}
              <span className="font-mono text-xs font-medium text-ember">{shownUrl}</span>&rdquo;
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted flex items-start gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember shrink-0 mt-0.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              <span>{pr.ctaSimNote}</span>
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
              {pr.ctaToggleTitle}
            </span>
            <span className="block text-micro text-muted">
              {enabled
                ? pr.ctaToggleActiveDesc
                : pr.ctaToggleInactiveDesc}
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
                <span>{pr.ctaSaving}</span>
              </>
            ) : (
              <span>{pr.ctaSaveBtn}</span>
            )}
          </button>

          {dirty && !pending && (
            <span className="text-xs font-semibold text-amber-400">
              {pr.ctaUnsavedNotice}
            </span>
          )}

          {saved && !dirty && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>{pr.ctaSavedSuccess}</span>
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
