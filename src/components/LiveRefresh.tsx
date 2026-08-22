"use client";

import { useEffect, useId, useState } from "react";
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
  onChange,
  silent,
  pollMs,
}: {
  tables: string[];
  /** Shown when something changed, so the update is not silent. */
  label?: string;
  /**
   * For pages that hold their own data in client state. `router.refresh()`
   * re-runs server components; it does nothing for a `useEffect` fetch, so a
   * client-side list would show the toast and then not actually change. Passing
   * a refetch here is what makes those pages honest.
   */
  onChange?: () => void;
  /** Suppress the toast when an ancestor is already announcing the same change. */
  silent?: boolean;
  /**
   * Optional fallback for high-write tables intentionally not published to
   * Realtime. Polling runs only while the tab is visible and never shows a
   * misleading "new data" toast.
   */
  pollMs?: number;
}) {
  const router = useRouter();
  const [pulse, setPulse] = useState(false);
  // Two LiveRefresh instances watching the same table — a layout badge and the
  // page below it — would otherwise open two channels on one topic.
  const instance = useId();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pulseTimer: ReturnType<typeof setTimeout> | undefined;

    const refresh = (announce: boolean) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (announce) {
          setPulse(true);
          if (pulseTimer) clearTimeout(pulseTimer);
          pulseTimer = setTimeout(() => setPulse(false), 1400);
        }
        if (onChange) onChange();
        else router.refresh();
      }, announce ? 400 : 0);
    };

    const channel = supabase.channel(`live:${tables.join("-")}:${instance}`);

    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        // Coalesce: one admin action often touches several tables at once.
        refresh(true);
      });
    }

    channel.subscribe();

    const poll =
      pollMs && pollMs >= 5_000
        ? setInterval(() => {
            if (document.visibilityState === "visible") refresh(false);
          }, pollMs)
        : undefined;
    const onVisible = () => {
      if (pollMs && document.visibilityState === "visible") refresh(false);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      if (pulseTimer) clearTimeout(pulseTimer);
      if (poll) clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
    // `tables` is a literal array at every call site; joining it keeps the
    // dependency stable without asking callers to memoise.
  }, [router, instance, onChange, pollMs, tables.join("-")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pulse || silent) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4"
    >
      <span className="rounded-full border border-ember/35 bg-ember/15 px-3 py-1.5 text-micro font-semibold text-ember-lo backdrop-blur-sm">
        {label ?? "Data baru masuk"}
      </span>
    </div>
  );
}
