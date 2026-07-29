"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { banUser, unbanUser, injectCredits } from "@/app/actions/admin";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchUsers();
  }, [search]);

  async function fetchUsers() {
    setLoading(true);
    const supabase = createClient();
    
    let query = supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
      
    if (search) {
      query = query.ilike("email", `%${search}%`);
    }

    const { data } = await query;
    setUsers(data || []);
    setLoading(false);
  }

  async function handleBan(id: string) {
    const reason = prompt("Alasan ban:");
    if (reason) {
      await banUser(id, reason);
      fetchUsers();
    }
  }

  async function handleUnban(id: string) {
    if (confirm("Yakin mau unban user ini?")) {
      await unbanUser(id);
      fetchUsers();
    }
  }

  async function handleInject(id: string) {
    const amountStr = prompt("Jumlah credit (bisa minus):");
    if (!amountStr) return;
    const amount = parseInt(amountStr);
    if (isNaN(amount)) return alert("Harus angka");
    
    const bucket = confirm("Inject ke paid bucket? (OK = Paid, Cancel = Free)") ? "paid" : "free";
    const reason = prompt("Alasan:") || "admin_injection";

    try {
      await injectCredits(id, amount, bucket, reason);
      alert("Credit injected!");
      fetchUsers();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Users & Bans</h1>

      <div className="mb-6">
        <input 
          type="text" 
          placeholder="Cari email..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md bg-surface border border-hairline rounded-lg px-4 py-2 text-white focus:outline-none focus:border-success"
        />
      </div>

      <div className="bg-surface border border-hairline rounded-2xl overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-obsidian text-muted text-sm border-b border-hairline">
            <tr>
              <th className="px-6 py-3 font-medium">Email</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Credits</th>
              <th className="px-6 py-3 font-medium">Joined</th>
              <th className="px-6 py-3 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 text-sm">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted">Loading...</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="text-white hover:bg-surface-raised/50">
                <td className="px-6 py-4">{u.email}</td>
                <td className="px-6 py-4">
                  {u.is_banned ? (
                    <span className="px-2 py-1 rounded bg-danger/10 text-danger text-xs">Banned: {u.ban_reason}</span>
                  ) : u.is_pro ? (
                    <span className="px-2 py-1 rounded bg-success/10 text-success text-xs">Pro</span>
                  ) : (
                    <span className="px-2 py-1 rounded bg-surface-raised text-muted text-xs">Free</span>
                  )}
                </td>
                <td className="px-6 py-4">{u.credits_free + u.credits_paid}</td>
                <td className="px-6 py-4 text-muted">{new Date(u.created_at).toLocaleDateString("id-ID")}</td>
                <td className="px-6 py-4 text-right flex gap-3 justify-end">
                  <button onClick={() => handleInject(u.id)} className="text-ember hover:text-ember-lo">
                    Inject
                  </button>
                  {u.is_banned ? (
                    <button onClick={() => handleUnban(u.id)} className="text-success hover:text-success">Unban</button>
                  ) : (
                    <button onClick={() => handleBan(u.id)} className="text-danger hover:text-danger">Ban</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
