import { listProviders } from "@/app/actions/ai-admin";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ProviderManager } from "./ProviderManager";
import Link from "next/link";

/**
 * The provider fleet.
 *
 * Data is fetched through the same server action the client calls, rather than
 * querying here: that action carries the verifyAdmin() check and the key-
 * stripping that turns a provider row into something safe to send to a browser.
 * Reading the table directly in this component would be one `select("*")` away
 * from shipping encrypted keys to the client.
 */
export default async function AdminAiPage() {
  const providers = await listProviders();

  return (
    <div className="space-y-5">
      <LiveRefresh tables={["ai_providers"]} label="Provider berubah" />
      <ProviderManager providers={providers} />

      <nav className="flex flex-wrap gap-2 border-t border-hairline pt-4">
        {[
          { href: "/admin/ai/models", label: "Model" },
          { href: "/admin/ai/routing", label: "Routing" },
          { href: "/admin/ai/playground", label: "Playground" },
          { href: "/admin/ai/biaya", label: "Biaya" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full border border-hairline px-4 py-2 text-mini text-muted hover:bg-surface hover:text-ink"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
