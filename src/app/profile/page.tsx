/**
 * /profile — caller's own profile. Redirects to /profile/<own id> so the
 * detail view is the source of truth for layout.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";

export default async function MyProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(`/profile/${user.id}`);
}
