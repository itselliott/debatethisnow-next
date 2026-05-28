/**
 * /admin — server-gated moderation dashboard.
 *
 * NON-admins get a 404 (not 403) so the page's existence isn't even
 * confirmed. Mirrors [app/routes/admin.py:9-18] verbatim.
 */
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { AdminClient } from "./AdminClient";

export const metadata = { title: "Admin · DebateThis" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_admin) notFound();

  const llmRow = await prisma.appSetting
    .findUnique({ where: { key: "llm_scorer_enabled" } })
    .catch(() => null);
  return (
    <AdminClient
      llmEnabledInitial={llmRow?.value === "1"}
    />
  );
}
