"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type FeedbackCategory = "kendala" | "saran" | "pertanyaan" | "lainnya";
export type FeedbackStatus = "baru" | "ditinjau" | "diproses" | "selesai";

export async function submitFeedbackAction(data: {
  category: FeedbackCategory;
  message: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Harus login dulu");

  const msg = data.message.trim();
  if (!msg) throw new Error("Pesan gak boleh kosong");
  if (msg.length > 2000) throw new Error("Pesan maksimal 2000 karakter");

  const { error } = await (supabase.from("user_feedback" as "profiles") as unknown as {
    insert: (row: {
      user_id: string;
      category: FeedbackCategory;
      message: string;
      status: FeedbackStatus;
    }) => Promise<{ error: Error | null }>;
  }).insert({
    user_id: user.id,
    category: data.category,
    message: msg,
    status: "baru",
  });

  if (error) {
    console.error("Gagal kirim feedback:", error);
    throw new Error("Gagal mengirim feedback. Coba lagi bentar ya.");
  }

  // Notify owner via Telegram
  import("@/lib/telegram").then(({ notifyFeedback }) => {
    notifyFeedback({
      email: user.email || "user@malesan",
      rating: 5,
      comment: msg,
      moduleName: data.category,
    }).catch(() => {});
  }).catch(() => {});

  return { success: true };
}

export async function updateFeedbackStatusAction(data: {
  id: string;
  status: FeedbackStatus;
  admin_notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Hanya admin yang bisa update status feedback");
  }

  const serviceRole = createServiceRoleClient();
  const updateData: Record<string, unknown> = {
    status: data.status,
    updated_at: new Date().toISOString(),
  };
  if (typeof data.admin_notes === "string") {
    updateData.admin_notes = data.admin_notes.trim();
  }

  const { error } = await (serviceRole.from("user_feedback" as "profiles") as unknown as {
    update: (row: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: Error | null }>;
    };
  })
    .update(updateData)
    .eq("id", data.id);

  if (error) {
    console.error("Gagal update feedback:", error);
    throw new Error("Gagal update feedback");
  }

  revalidatePath("/admin/feedback");
  return { success: true };
}
