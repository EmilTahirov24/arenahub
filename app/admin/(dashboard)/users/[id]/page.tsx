import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import AdminUserForm from "@/components/admin/AdminUserForm";
import { updateAdminUser, deleteAdminUser } from "../actions";
import { dangerButtonClass } from "@/components/admin/formStyles";

export default async function EditAdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/admin");

  const { id } = await params;
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) notFound();

  const updateWithId = updateAdminUser.bind(null, id);
  const deleteWithId = deleteAdminUser.bind(null, id);

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">{user.email}</h1>
      <AdminUserForm user={user} action={updateWithId} />
      {id !== session.id && (
        <form action={deleteWithId} className="mt-8">
          <button type="submit" className={dangerButtonClass}>
            İstifadəçini sil
          </button>
        </form>
      )}
    </div>
  );
}
