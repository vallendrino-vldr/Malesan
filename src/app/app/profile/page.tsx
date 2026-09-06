import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BannedGuard } from "@/components/BannedGuard";
import { ProfileClientView } from "./ProfileClientView";

async function requestOrigin(): Promise<string> {
  const h = await headers();
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
  if (profile.is_banned) return <BannedGuard reason={profile.ban_reason} />;

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

  const avatar =
    profile.avatar_url ??
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;

  const totalCredits = (profile.credits_free ?? 0) + (profile.credits_paid ?? 0);

  return (
    <ProfileClientView
      profile={profile}
      referralCount={referralCount}
      referralLink={referralLink}
      avatar={avatar}
      personas={personas ?? []}
      dna={dna}
      totalCredits={totalCredits}
    />
  );
}
