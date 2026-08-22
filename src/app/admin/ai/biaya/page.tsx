import Link from "next/link";
import { listModels } from "@/app/actions/ai-admin";
import { costSummary } from "@/lib/ai/analytics";
import { getUsdToIdr } from "@/lib/config";
import { verifyAdmin } from "@/lib/admin/guard";
import { CostPanel } from "./CostPanel";

/**
 * costSummary() reads ai_usage_log with the service-role client, so this page
 * gates itself before touching it. listModels() carries its own check; the
 * explicit verifyAdmin() here is for the analytics call, which has none of its
 * own by design — it is a lib function, not an endpoint.
 */
export default async function AdminAiCostPage() {
  await verifyAdmin();

  const [summary, models, usdToIdr] = await Promise.all([
    costSummary(7),
    listModels(),
    getUsdToIdr(),
  ]);

  return (
    <div className="space-y-5">
      <Link href="/admin/ai" className="text-micro text-muted hover:text-ink">
        &larr; Provider
      </Link>
      <CostPanel summary={summary} models={models} usdToIdr={usdToIdr} />
    </div>
  );
}
