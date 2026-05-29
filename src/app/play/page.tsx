/**
 * /play — anonymous "challenge a friend without signing up" entry
 * point. Public, indexable for SEO. The page itself is just a
 * client wrapper around the form; if the visitor IS signed in, we
 * redirect them to the dashboard (the proper challenge dialog lives
 * there).
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { PlayClient } from "./PlayClient";

export const metadata: Metadata = {
  title: "Challenge a friend — no sign-up · DebateThis",
  description:
    "Pick a topic, get a link, send it to a friend. Debate them live. Sign up after if you want to keep the win on your record.",
};

export default async function PlayPage() {
  const user = await getCurrentUser();
  // Already authed users shouldn't see the anon flow — bounce them
  // to the dashboard's normal challenge dialog. Guests stay (they
  // can issue more anon challenges if they want).
  if (user && !user.is_guest) {
    redirect("/dashboard");
  }
  return <PlayClient />;
}
