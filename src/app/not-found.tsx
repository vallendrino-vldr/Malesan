import Link from "next/link";
import { Logo } from "@/components/Logo";

/**
 * There was no custom 404 — a broken or mistyped link fell through to Next's
 * default page: white background, black Times New Roman, no way back into the
 * product. On a dark, branded app that is a jarring dead end, and it names an
 * error code rather than offering an action.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-[100dvh] w-full place-items-center bg-obsidian px-5">
      <div className="w-full max-w-sm text-center">
        <Logo markClass="mx-auto h-8" />
        <p className="mt-6 font-display text-5xl font-bold text-hairline">404</p>
        <h1 className="mt-2 font-display text-xl font-bold text-ink">
          Halamannya gak ketemu
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Linknya mungkin salah ketik, atau halamannya udah dipindah. Bukan
          salah lo.
        </p>
        <Link
          href="/"
          className="btn-ember mt-6 inline-flex min-h-11 items-center justify-center rounded-xl px-6 font-display text-sm font-bold text-obsidian"
        >
          Balik ke beranda
        </Link>
      </div>
    </main>
  );
}
