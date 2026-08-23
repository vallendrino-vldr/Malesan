import { MascotSplashScreen } from "@/components/LavaLoader";

/**
 * Admin pages loading screen.
 */
export default function AdminLoading() {
  return (
    <MascotSplashScreen
      title="Malesan lagi ngambil data admin..."
      subtitle="Menghubungkan ke database &amp; metrik sistem."
    />
  );
}
