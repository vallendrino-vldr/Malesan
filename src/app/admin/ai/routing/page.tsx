import Link from "next/link";
import { listModels, listProviders, listRoutes, brainStatus } from "@/app/actions/ai-admin";
import { RoutingManager } from "./RoutingManager";

export default async function AdminAiRoutingPage() {
  const [routes, models, providers, brain] = await Promise.all([
    listRoutes(),
    listModels(),
    listProviders(),
    brainStatus(),
  ]);

  return (
    <div className="space-y-5">
      <Link href="/admin/ai" className="text-micro text-muted hover:text-ink">
        &larr; Otak AI
      </Link>
      <RoutingManager
        routes={routes}
        models={models}
        providers={providers}
        brainLabel={brain.primary?.label ?? "Gemini bawaan"}
      />
    </div>
  );
}
