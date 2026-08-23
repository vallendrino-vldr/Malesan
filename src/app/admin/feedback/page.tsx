import { createServiceRoleClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";
import { FeedbackList, type FeedbackItem } from "./FeedbackList";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const serviceRole = createServiceRoleClient();

  type FeedbackRow = {
    id: string;
    user_id: string;
    category: "kendala" | "saran" | "pertanyaan" | "lainnya";
    message: string;
    status: "baru" | "ditinjau" | "diproses" | "selesai";
    admin_notes: string | null;
    created_at: string;
    profiles: {
      display_name: string | null;
      email: string | null;
    } | null;
  };

  const { data: rows } = await (serviceRole.from("user_feedback" as "profiles") as unknown as {
    select: (cols: string) => {
      order: (col: string, opts: { ascending: boolean }) => {
        limit: (n: number) => Promise<{ data: FeedbackRow[] | null }>;
      };
    };
  })
    .select(`
      id,
      user_id,
      category,
      message,
      status,
      admin_notes,
      created_at,
      profiles:user_id (
        display_name,
        email
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  const items: FeedbackItem[] = (rows ?? []).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    category: r.category,
    message: r.message,
    status: r.status,
    admin_notes: r.admin_notes,
    created_at: r.created_at,
    user_name: r.profiles?.display_name || "Kreator",
    user_email: r.profiles?.email || "-",
  }));

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["user_feedback"]} label="Feedback baru masuk" />

      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <span className="eyebrow text-ember">Suara Pengguna</span>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-display-md text-ink">
            Feedback Center
          </h1>
          <p className="mt-1 text-xs text-muted">
            Laporan kendala, permintaan fitur, dan saran langsung dari kreator pengguna Malesan.
          </p>
        </div>
      </header>

      <FeedbackList initialItems={items} />
    </div>
  );
}