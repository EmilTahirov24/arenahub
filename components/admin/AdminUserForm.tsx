import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/formStyles";
import type { AdminUser } from "@/app/generated/prisma/client";

const ROLES = ["SUPER_ADMIN", "EDITOR"] as const;

export default function AdminUserForm({
  user,
  action,
}: {
  user?: AdminUser;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="max-w-lg space-y-4">
      <div>
        <label htmlFor="admin-user-email" className={labelClass}>Email</label>
        <input id="admin-user-email" name="email" type="email" required defaultValue={user?.email} className={inputClass} />
      </div>
      <div>
        <label htmlFor="admin-user-name" className={labelClass}>Ad</label>
        <input id="admin-user-name" name="name" required defaultValue={user?.name} className={inputClass} />
      </div>
      <div>
        <label htmlFor="admin-user-role" className={labelClass}>Rol</label>
        <select id="admin-user-role" name="role" defaultValue={user?.role ?? "EDITOR"} className={inputClass}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="admin-user-password" className={labelClass}>{user ? "Yeni şifrə (boş saxlaya bilərsiniz)" : "Şifrə"}</label>
        <input id="admin-user-password" name="password" type="password" required={!user} className={inputClass} />
      </div>
      <button type="submit" className={primaryButtonClass}>
        Yadda saxla
      </button>
    </form>
  );
}
