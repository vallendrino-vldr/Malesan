"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { approveTopup, rejectTopup } from "@/app/actions/admin";
import Image from "next/image";

export default function AdminTopupsPage() {
  const [topups, setTopups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopups();
  }, []);

  async function fetchTopups() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("topups")
      .select("*, profiles(email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    
    setTopups(data || []);
    setLoading(false);
  }

  async function handleApprove(id: string) {
    await approveTopup(id);
    fetchTopups();
  }

  async function handleReject(id: string) {
    const note = prompt("Alasan reject:");
    if (note !== null) {
      await rejectTopup(id, note);
      fetchTopups();
    }
  }

  if (loading) return <div className="p-8 text-zinc-400">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-8">Antrean Topup</h1>

      {topups.length === 0 ? (
        <div className="text-zinc-500">Gak ada topup yang pending. Mulus!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topups.map(t => (
            <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-zinc-800">
                <div className="text-zinc-400 text-sm mb-1">{t.profiles?.email}</div>
                <div className="text-xl font-bold text-white">Rp {t.amount_idr.toLocaleString("id-ID")}</div>
                <div className="text-emerald-400 text-sm">Untuk {t.credits} credits</div>
                <div className="text-zinc-500 text-xs mt-2">{new Date(t.created_at).toLocaleString("id-ID")}</div>
              </div>
              
              {t.proof_url ? (
                <div className="relative h-64 bg-zinc-950">
                  <Image 
                    src={t.proof_url} 
                    alt="Bukti Transfer" 
                    fill 
                    className="object-contain"
                    unoptimized // using unoptimized because we don't configure domains for next/image
                  />
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center bg-zinc-950 text-zinc-600 text-sm">
                  Gak ada gambar
                </div>
              )}

              <div className="p-4 flex gap-2 mt-auto">
                <button 
                  onClick={() => handleApprove(t.id)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg transition-colors"
                >
                  Approve
                </button>
                <button 
                  onClick={() => handleReject(t.id)}
                  className="flex-1 bg-red-900/50 hover:bg-red-800/50 text-red-400 font-medium py-2 rounded-lg transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
