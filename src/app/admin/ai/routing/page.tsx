import Link from "next/link";
import { listModels, listProviders, listRoutes } from "@/app/actions/ai-admin";
import { RoutingManager } from "./RoutingManager";

export default async function AdminAiRoutingPage() {
  const [routes, models, providers] = await Promise.all([
    listRoutes(),
    listModels(),
    listProviders(),
  ]);

  return (
    <div className="space-y-5">
      <Link href="/admin/ai" className="text-micro text-muted hover:text-ink">
        &larr; Provider
      </Link>
      <RoutingManager routes={routes} models={models} providers={providers} />
    </div>
  );
}
