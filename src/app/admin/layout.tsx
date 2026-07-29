import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/masuk");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/app");
  }

  return (
    <div className="min-h-screen bg-obsidian text-white flex">
      <aside className="w-64 bg-zinc-950 border-r border-zinc-900 flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-black text-white">malesan<span className="text-emerald-500">.admin</span></h2>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Link href="/admin" className="block px-4 py-2 rounded-lg hover:bg-zinc-900 transition-colors">
            Dashboard
          </Link>
          <Link href="/admin/topups" className="block px-4 py-2 rounded-lg hover:bg-zinc-900 transition-colors">
            Approval Topup
          </Link>
          <Link href="/admin/vouchers" className="block px-4 py-2 rounded-lg hover:bg-zinc-900 transition-colors">
            Voucher Generator
          </Link>
          <Link href="/admin/users" className="block px-4 py-2 rounded-lg hover:bg-zinc-900 transition-colors">
            Users & Bans
          </Link>
        </nav>
        <div className="p-4 border-t border-zinc-900">
          <Link href="/app" className="text-sm text-zinc-500 hover:text-white transition-colors">
            &larr; Balik ke App
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
