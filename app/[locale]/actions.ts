"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth";

/**
 * Signs out from the public site.
 *
 * Deliberately not `playerLogout` from the dashboard, which sends you to
 * /player/login. That is the right destination when you were already inside the
 * dashboard, but someone who was reading a match page and used the header menu
 * has not asked to go anywhere near a login form — dropping them on one is the
 * same disorientation this menu exists to fix. They stay on the site.
 */
export async function logoutToSite() {
  await destroySession();
  redirect("/");
}
