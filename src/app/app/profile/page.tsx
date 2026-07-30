import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CopyField } from "@/components/CopyField";

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

  const referralCount = profile.referrals[0]?.count || 0;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const referralLink = `${baseUrl}/masuk?ref=${profile.referral_code}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <a
        href="/app?tab=profil"
        className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/35 hover:text-ink"
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
                Edit Creator DNA
              </a>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                Makin lengkap DNA lo, makin nyambung hasil generate-nya.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
