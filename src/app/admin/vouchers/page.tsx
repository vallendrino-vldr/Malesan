import { createServiceRoleClient } from "@/lib/supabase/server";
import { VoucherManager, type Voucher } from "./VoucherManager";

export default async function VouchersPage() {
  const { data } = await createServiceRoleClient()
    .from("vouchers")
    .select("code, credits, is_redeemed, expires_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
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
