import Link from "next/link";
import { listModels, listProviders } from "@/app/actions/ai-admin";
import { Playground } from "./Playground";

export default async function AdminAiPlaygroundPage() {
  const [models, providers] = await Promise.all([listModels(), listProviders()]);

  return (
    <div className="space-y-5">
      <Link href="/admin/ai" className="text-micro text-muted hover:text-ink">
        &larr; Provider
      </Link>
      <Playground models={models} providers={providers} />
    </div>
  );
}
