import { redirect } from "next/navigation";

export default function DesktopRedirect() {
  redirect("/app?download=1");
}
