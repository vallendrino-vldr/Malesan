import { LavaScreen } from "@/components/LavaLoader";

/**
 * Admin pages each run several counts and aggregates before rendering, so they
 * have the same dead-air problem the app tabs had.
 */
export default function AdminLoading() {
  return <LavaScreen label="Lagi ngambil data..." />;
}
