import Link from "next/link";
import { listModels, listProviders, modelUsage } from "@/app/actions/ai-admin";
import { getUsdToIdr } from "@/lib/config";
import { ModelRegistry } from "./ModelRegistry";

export default async function AdminAiModelsPage() {
  const [models, providers, usage, usdToIdr] = await Promise.all([
    listModels(),
    listProviders(),
    modelUsage(),
    getUsdToIdr(),
  ]);

  return (
    <div className="space-y-5">
      <Link href="/admin/ai" className="text-micro text-muted hover:text-ink">
        &larr; Otak AI
      </Link>
      <ModelRegistry
        models={models}
        providers={providers}
        usage={usage}
        usdToIdr={usdToIdr}
      />
    </div>
  );
}
