"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import type { AdminRole } from "@/app/generated/prisma/client";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
}

async function requireSuperAdmin() {
  await requireAdmin();
  const session = await getAdminSession();
  if (session!.role !== "SUPER_ADMIN") throw new Error("Forbidden");
  return session!;
}

export async function createAdminUser(formData: FormData) {
  await requireSuperAdmin();
  const password = String(formData.get("password") ?? "");
  if (!password) throw new Error("Şifrə tələb olunur");
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.adminUser.create({
    data: {
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      name: String(formData.get("name") ?? ""),
      role: String(formData.get("role") ?? "EDITOR") as AdminRole,
      passwordHash,
    },
  });
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateAdminUser(id: string, formData: FormData) {
  await requireSuperAdmin();
  const password = String(formData.get("password") ?? "");

  const data: { email: string; name: string; role: AdminRole; passwordHash?: string } = {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    name: String(formData.get("name") ?? ""),
    role: String(formData.get("role") ?? "EDITOR") as AdminRole,
  };
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  await prisma.adminUser.update({ where: { id }, data });
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function deleteAdminUser(id: string) {
  const session = await requireSuperAdmin();
  if (id === session.id) throw new Error("Öz hesabınızı silə bilməzsiniz");
  await prisma.adminUser.delete({ where: { id } });
  revalidatePath("/admin/users");
  redirect("/admin/users");
}
