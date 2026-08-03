import "server-only";
import { getAdminSession } from "@/lib/auth";

/**
 * Shared admin guards. `getAdminSession` re-reads the role from the database,
 * so a demotion takes effect immediately instead of living on in the JWT.
 *
 * Policy: any admin may create and edit content; only SUPER_ADMIN may delete
 * things or manage other admins. Before this existed the AdminRole enum was
 * decorative — every EDITOR could delete games, teams and matches.
 */
export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireAdmin();
  if (session.role !== "SUPER_ADMIN") throw new Error("Forbidden: SUPER_ADMIN required");
  return session;
}
