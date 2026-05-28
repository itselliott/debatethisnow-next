/**
 * /settings — language picker (Phase 5), per-user prefs (Phase 5),
 * account deletion link.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { SettingsClient } from "./SettingsClient";

export const metadata = { title: "Settings · DebateThis" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <SettingsClient username={user.username} isAdmin={user.is_admin} />;
}
