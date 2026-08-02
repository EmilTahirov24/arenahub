import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import AdminUserForm from "@/components/admin/AdminUserForm";
import { createAdminUser } from "../actions";

export default async function NewAdminUserPage() {
  const session = await getAdminSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/admin");

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Yeni istifadəçi</h1>
      <AdminUserForm action={createAdminUser} />
    </div>
  );
}
