import Link from "next/link";
import { listModels, listProviders } from "@/app/actions/ai-admin";
import { ModelRegistry } from "./ModelRegistry";

export default async function AdminAiModelsPage() {
  const [models, providers] = await Promise.all([listModels(), listProviders()]);

  return (
    <div className="space-y-5">
      <Link href="/admin/ai" className="text-micro text-muted hover:text-ink">
        &larr; Provider
      </Link>
      <ModelRegistry models={models} providers={providers} />
    </div>
  );
}
