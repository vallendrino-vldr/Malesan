import { LavaScreen } from "@/components/LavaLoader";

/**
 * Route-level loading UI for /app.
 *
 * Next streams this the instant a navigation starts, before any server work
 * runs. Without it the previous screen just sat there through auth, the profile
 * read and the per-tab queries — which is exactly what "klik tab lemot banget,
 * loading gak ada keterangan" describes. The delay was real, but the total
 * absence of feedback is what made it feel broken.
 */
export default function AppLoading() {
  return <LavaScreen label="Bentar, lagi nyiapin..." />;
}
