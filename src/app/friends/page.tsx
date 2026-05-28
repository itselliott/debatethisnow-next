/**
 * /friends — server-component guard around a client widget that drives
 * search + requests + list.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { FriendsClient } from "./FriendsClient";

export const metadata = { title: "Friends · DebateThis" };

export default async function FriendsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <FriendsClient viewerId={user.id} />;
}
