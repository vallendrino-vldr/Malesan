"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Makes a server-rendered page react to database changes.
 *
 * The admin panel only ever showed a snapshot from the moment it rendered, so a
 * top-up that arrived thirty seconds ago was invisible until someone thought to
 * reload. Realtime was not "misconfigured" — `supabase_realtime` had zero tables
 * published, so nothing could ever have arrived.
 *
 * This subscribes to the tables a page cares about and calls `router.refresh()`
 * when one changes. Refreshing rather than patching local state is deliberate:
 * the page already knows how to render itself from the database, and a second
 * copy of that logic in the client is a second thing to keep correct.
 *
 * Refreshes are coalesced on a short timer. A single approval writes to `topups`,
 * `profiles` and `credit_ledger` in quick succession, and three refreshes for one
 * logical event is both wasteful and visibly flickery.
 *
 * RLS applies to realtime exactly as it does to queries, so a regular user is
 * only ever notified about their own rows.
 */
export function LiveRefresh({
  tables,
  label,
}: {
  tables: string[];
  /** Shown when something changed, so the update is not silent. */
  label?: string;
}) {
  const router = useRouter();
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase.channel(`live:${tables.join("-")}`);

    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        // Coalesce: one admin action often touches several tables at once.
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          setPulse(true);
          router.refresh();
          setTimeout(() => setPulse(false), 1400);
        }, 400);
      });
    }

    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // `tables` is a literal array at every call site; joining it keeps the
    // dependency stable without asking callers to memoise.
  }, [router, tables.join("-")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pulse) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4"
    >
      <span className="rounded-full border border-ember/35 bg-ember/15 px-3 py-1.5 text-[11px] font-semibold text-ember-lo backdrop-blur-sm">
        {label ?? "Data baru masuk"}
      </span>
    </div>
  );
}
