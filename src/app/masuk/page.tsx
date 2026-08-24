import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { MasukWorkspaceView } from "./MasukWorkspaceView";

export const metadata: Metadata = {
  title: "Masuk ke Ruang Kerja — Malesan",
  description: "Masuk ke ruang kerja AI creative companion Malesan untuk membuat ide, script, dan konten kreatif lo.",
  robots: { index: false },
};

export default async function MasukPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; ref?: string }>;
}) {
  const { error, next, ref } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/app");
  }

  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/app";

  return (
    <MasukWorkspaceView
      safeNext={safeNext}
      referralCode={ref}
      serverError={error}
    />
  );
}
