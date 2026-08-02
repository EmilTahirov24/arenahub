"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth";

export async function adminLogout() {
  await destroySession();
  redirect("/admin/login");
}
