import { createServiceRoleClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = createServiceRoleClient();

  // Basic stats
  const { count: usersCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  const { count: topupsCount } = await supabase.from("topups").select("*", { count: "exact", head: true }).eq("status", "pending");
  const { count: generationsCount } = await supabase.from("generations").select("*", { count: "exact", head: true });

  const { data: usage } = await supabase.rpc("gemini_pool_used_today");

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-8">Dashboard Admin</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="text-zinc-400 text-sm mb-2">Total Users</div>
          <div className="text-4xl font-black text-white">{usersCount || 0}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="text-zinc-400 text-sm mb-2">Pending Topup</div>
          <div className="text-4xl font-black text-white">{topupsCount || 0}</div>
          {topupsCount && topupsCount > 0 ? (
            <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
          ) : null}
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="text-zinc-400 text-sm mb-2">Total Generations</div>
          <div className="text-4xl font-black text-white">{generationsCount || 0}</div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-white mb-4">Gemini API Quota Hari Ini</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-950 text-zinc-400 text-sm border-b border-zinc-800">
            <tr>
              <th className="px-6 py-3 font-medium">Key Index</th>
              <th className="px-6 py-3 font-medium">Requests</th>
              <th className="px-6 py-3 font-medium">Errors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {usage?.map((u: any) => (
              <tr key={u.key_index} className="text-white">
                <td className="px-6 py-4">Key {u.key_index}</td>
                <td className="px-6 py-4">{u.requests} <span className="text-zinc-500 text-sm">/ 1500 (Free limits)</span></td>
                <td className="px-6 py-4 text-red-400">{u.errors}</td>
              </tr>
            ))}
            {(!usage || usage.length === 0) && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-zinc-500">Belum ada usage hari ini</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
