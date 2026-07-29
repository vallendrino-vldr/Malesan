import { createServiceRoleClient } from "@/lib/supabase/server";
import { createVoucher } from "@/app/actions/admin";

export default async function VouchersPage() {
  const serviceRole = createServiceRoleClient();
  const { data: vouchers } = await serviceRole
    .from("vouchers")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-black text-white mb-8">Voucher Generator (Superpower)</h1>
      
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Generate Voucher Baru</h2>
        <form action={async (formData) => {
          "use server";
          const code = formData.get("code") as string;
          const credits = parseInt(formData.get("credits") as string);
          const daysValid = parseInt(formData.get("days") as string);
          if (code && credits && daysValid) {
            await createVoucher(code, credits, daysValid);
          }
        }} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Kode Voucher</label>
            <input name="code" type="text" placeholder="SUMMER50" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 uppercase" />
          </div>
          <div className="w-32">
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Total Credit</label>
            <input name="credits" type="number" min="1" placeholder="50" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500" />
          </div>
          <div className="w-32">
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Masa Berlaku (Hari)</label>
            <input name="days" type="number" min="1" defaultValue="7" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500" />
          </div>
          <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-6 py-3 rounded-xl transition-colors">
            Generate
          </button>
        </form>
      </div>

      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-zinc-900/50">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Kode</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Credits</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Kadaluarsa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {vouchers?.map((v) => (
              <tr key={v.code} className="hover:bg-zinc-900/20">
                <td className="px-6 py-4">
                  <span className="font-mono text-emerald-400 font-bold bg-emerald-400/10 px-2 py-1 rounded">{v.code}</span>
                </td>
                <td className="px-6 py-4 font-bold text-white">+{v.credits}</td>
                <td className="px-6 py-4">
                  {v.is_redeemed ? (
                    <span className="text-zinc-500">Redeemed</span>
                  ) : (
                    <span className="text-emerald-500 font-bold">Active</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-zinc-400">
                  {v.expires_at ? new Date(v.expires_at).toLocaleDateString("id-ID") : "-"}
                </td>
              </tr>
            ))}
            {!vouchers?.length && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                  Belum ada voucher.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
