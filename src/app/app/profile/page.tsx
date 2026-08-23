import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CopyField } from "@/components/CopyField";
import { PersonaManager, CtaSettings } from "@/components/PersonaManager";

/**
 * The referral origin comes from the request, not an env var.
 *
 * This page handed out `http://localhost:3000/masuk?ref=...` on the deployed
 * site, because it read `NEXT_PUBLIC_APP_URL` and that variable was never set in
 * production — so it silently used the dev fallback. Anyone who shared their
 * link shared a dead one.
 *
 * The rest of the referral chain is intact and was verified: `/masuk` reads
 * `?ref`, passes it to the sign-in button, `/auth/callback` writes
 * `referred_by`, and `processReferral` grants 10 credits to each side on the
 * referee's first generation. The programme has zero rows in `referrals` purely
 * because the link it distributed could never resolve for anyone else.
 *
 * Reading the host from headers means it is correct on localhost, on every
 * Vercel preview URL, and on a custom domain, with nothing to configure.
 */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  // Vercel terminates TLS at the edge, so the protocol only survives in
  // x-forwarded-proto; `host` alone would give the right domain over the wrong
  // scheme.
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, referrals!referrals_referrer_id_fkey(count)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // Both reads are owner-scoped and covered by RLS. `personas` legitimately has
  // no rows for most people — an empty list is the empty state, not a failure —
  // and `creator_dna` is absent until onboarding runs, hence maybeSingle().
  const [{ data: personas }, { data: dna }] = await Promise.all([
    supabase
      .from("personas")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("creator_dna")
      .select("cta_url, cta_label, cta_enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const referralCount = profile.referrals[0]?.count || 0;
  const referralLink = `${await requestOrigin()}/masuk?ref=${profile.referral_code}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <a
        href="/app?tab=profil"
        className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3.5 py-2 text-mini font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/35 hover:text-ink"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
          <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6 4.6-4.6Z" />
        </svg>
        Balik
      </a>
      <h1 className="mt-4 font-display text-2xl font-bold tracking-display-md text-ink">
        Profil lo
      </h1>

      <div className="space-y-6">
        <PersonaManager personas={personas ?? []} />

        <CtaSettings
          initial={{
            url: dna?.cta_url ?? "",
            label: dna?.cta_label ?? "",
            enabled: dna?.cta_enabled ?? false,
          }}
        />

        <div className="surface-card rounded-2xl p-5">
          <h2 className="font-display text-lg font-bold text-ink">Program referral</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">Ajak temen pakai Malesan. Lo dapet 10 kredit begitu dia kelar generate konten pertamanya — dan dia juga dapet 10. Gak ada batasnya.</p>
          
          <div className="mt-4">
            <CopyField value={referralLink} label="Link referral lo" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-hairline bg-obsidian p-3.5">
              <div className="eyebrow mb-1 text-muted">Temen yang join</div>
              <div className="font-display text-2xl font-bold text-ink">{referralCount}</div>
            </div>
            <div className="rounded-xl border border-success/20 bg-success/10 p-3.5">
              <div className="eyebrow mb-1 text-success">Bonus didapat</div>
              <div className="font-display text-2xl font-bold text-success">{referralCount * 10} <span className="text-xs font-normal text-success/60">kredit</span></div>
            </div>
          </div>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <h2 className="font-display text-lg font-bold text-ink">Informasi akun</h2>
          <div className="mt-3 space-y-3.5">
            <div>
              <div className="eyebrow text-muted">Email</div>
              <div className="mt-0.5 text-sm text-ink">{profile.email}</div>
            </div>
            <div>
              <div className="eyebrow text-muted">Status</div>
              <div className="mt-0.5 text-sm">
                {profile.is_pro ? (
                  <span className="font-semibold text-success">Pro</span>
                ) : (
                  <span className="text-ink">Free</span>
                )}
              </div>
            </div>
            
            <div className="pt-4 border-t border-hairline">
              <a
                href="/app/onboarding"
                className="inline-block cursor-pointer rounded-lg border border-hairline bg-surface-raised px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember-lo"
              >
                Atur profil utama
              </a>
              <p className="mt-2 text-micro leading-relaxed text-muted">
                Ini patokan dasar Malesan waktu belum ada profil tambahan yang dipilih.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
