import { redirect } from "next/navigation";

/** Unit system UI is hidden; app is metric-only for now. */
export default function SettingsUnitsPage() {
  redirect("/settings");
}
