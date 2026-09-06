import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { VoucherManager, type Voucher } from "./VoucherManager";

export default async function VouchersPage() {
  const { data } = await createServiceRoleClient()
    .from("vouchers")
    .select("code, credits, is_redeemed, expires_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-ink"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Kembali ke Ringkasan
        </Link>
      </div>

      <header>
        <h1 className="font-display text-xl font-bold text-ink">Voucher</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Kode buat nambah kredit user tanpa transfer. Tap kodenya buat nyalin.
        </p>
      </header>

      <VoucherManager vouchers={(data as Voucher[]) ?? []} />
    </div>
  );
}
