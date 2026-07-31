"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";

/**
 * A module tile that admits it has been tapped.
 *
 * Opening Hook Lab, Script or Repurpose is a real navigation, and the page it
 * loads runs `auth.getUser()`, a profile read and a config read against a
 * database in Singapore before it can render anything. On a phone on mobile
 * data that is seconds during which the screen does not change at all.
 *
 * From the outside that is indistinguishable from a tap that missed — so people
 * tap again, and the reported symptom is "harus klik 2 kali", especially in
 * Safari. The tap was never the problem; the silence was.
 *
 * `useLinkStatus` flips the moment the navigation starts, so the tile can say
 * so immediately while the server does its work. It also disables further taps,
 * which is the part that actually stops the double-fire.
 */
export function NavTile({
  href,
  title,
  cost,
}: {
  href: string;
  title: string;
  cost: number;
}) {
  return (
    <Link
      href={href}
      className="skeu skeu-press group flex min-h-[68px] cursor-pointer flex-col justify-center rounded-xl border border-hairline bg-surface-raised px-3 py-3 text-center transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/45"
    >
      <TileBody title={title} cost={cost} />
    </Link>
  );
}

/**
 * Must be a child of <Link> — `useLinkStatus` reads the status of the nearest
 * Link above it, so calling it in the same component that renders the Link
 * would always report idle.
 */
function TileBody({ title, cost }: { title: string; cost: number }) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span className="flex items-center justify-center gap-1">
        <span
          className={`truncate text-mini font-bold ${
            pending ? "text-ember" : "text-ink group-hover:text-ember-lo"
          }`}
        >
          {title}
        </span>
        {pending ? (
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-3 shrink-0 animate-spin fill-ember"
          >
            <path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-3 shrink-0 fill-muted transition-colors group-hover:fill-ember"
          >
            <path d="M8.6 16.6 13.2 12 8.6 7.4 10 6l6 6-6 6-1.4-1.4Z" />
          </svg>
        )}
      </span>
      <span className="mt-1 block font-mono text-micro text-ember-lo">
        {pending ? "buka…" : `${cost} kredit`}
      </span>
    </>
  );
}
