import Link from "next/link";
import { brainOverview, type Health } from "@/lib/ai/brain";
import { getFleet } from "@/lib/ai/registry";
import { getGeminiPoolQuota } from "@/lib/gemini/pool-report";

/**
 * The AI, summarised for whoever owns the business.
 *
 * Replaces a per-key Gemini table that reported "Key 1: 40 requests, 2 errors".
 * That number cannot answer the only question this page is asked — is my product
 * working — and it went stale the moment the Brain started routing somewhere
 * other than Gemini.
 *
 * Three facts, in the order they matter: what is running, is it healthy, and is
 * there a backup if it stops. Key indices, request counts and upstream error
 * strings live behind advanced settings, where someone debugging will look.
 */

const DOT: Record<Health, { cls: string; label: string }> = {
  healthy: { cls: "bg-ember", label: "sehat" },
  warning: { cls: "bg-ember/60", label: "ada gangguan" },
  limit: { cls: "bg-ember/60", label: "kena limit" },
  error: { cls: "bg-danger", label: "bermasalah" },
};

export async function AiHealthCard() {
  const [{ routes }, geminiQuota] = await Promise.all([
    getFleet(),
    getGeminiPoolQuota(),
  ]);
  const brain = await brainOverview(
    routes.filter((r) => r.is_active).map((r) => r.feature),
  );

  const liveBackup = brain.fallbacks.find((f) => f.active);

  return (
    <section className="surface-card rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-ember-lo">Otak AI</p>
          {brain.primary ? (
            <>
              <p className="mt-1 font-display text-mini font-bold text-ink">
                {brain.primary.label}
              </p>
              <p className="text-micro text-muted">{brain.primary.provider}</p>
            </>
          ) : (
            <p className="mt-1 text-mini text-muted">Belum diatur — pakai Gemini bawaan</p>
          )}
        </div>

        {brain.primary && (
          <span className="flex shrink-0 items-center gap-1.5 text-micro text-muted">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${
                DOT[brain.primary.active ? brain.primary.health : "error"].cls
              }`}
            />
            {DOT[brain.primary.active ? brain.primary.health : "error"].label}
          </span>
        )}
      </div>

      {geminiQuota && (
        <div className="mt-2.5 rounded-lg bg-surface-raised/60 border border-white/[0.05] p-2.5 space-y-1 text-micro">
          <div className="flex items-center justify-between">
            <span className="text-muted">Sisa Kuota Hari Ini:</span>
            <span className="font-mono font-bold text-ink">
              {geminiQuota.remaining.toLocaleString("id-ID")}
              <span className="text-muted font-normal"> / {geminiQuota.capacity.toLocaleString("id-ID")} req</span>
              <span className="text-emerald-400 font-medium"> ({geminiQuota.percentRemaining.toFixed(0)}%)</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-muted">
            <span>Reset Limit Harian:</span>
            <span className="text-ink font-medium">
              14:00 WIB <span className="text-muted font-normal">({geminiQuota.countdownText})</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-muted">
            <span>Biaya Kas / Valuasi:</span>
            <span className="text-ink">
              <span className="text-emerald-400 font-bold">Rp 0</span>
              <span className="text-muted"> (~Rp 10/req pasar)</span>
            </span>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-hairline pt-3 text-micro">
        <span className="text-muted">
          Cadangan:{" "}
          {liveBackup ? (
            <span className="text-ink">{liveBackup.label}</span>
          ) : (
            <span className="text-danger">belum ada yang siap</span>
          )}
        </span>
        <span className="text-muted">{brain.followingCount} fitur ngikut</span>
        <Link
          href="/admin/ai"
          className="ml-auto text-ember-lo underline-offset-2 hover:underline"
        >
          Atur &rarr;
        </Link>
      </div>
    </section>
  );
}
