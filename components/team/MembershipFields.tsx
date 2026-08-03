import type { TeamMembership } from "@/app/generated/prisma/client";

/** Team-internal flags — the owner controls these for every roster member,
 *  including the ones whose profile belongs to their own account. */
export default function MembershipFields({ membership }: { membership: TeamMembership }) {
  return (
    <fieldset className="rounded-md border border-border-subtle p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        Komandadakı yeri
      </legend>
      <label className="flex items-center gap-2 py-1 text-sm">
        <input type="checkbox" name="isStandin" defaultChecked={membership.isStandin} className="accent-brand-via" />
        Stand-in
      </label>
      <label className="flex items-center gap-2 py-1 text-sm">
        <input type="checkbox" name="isCoach" defaultChecked={membership.isCoach} className="accent-brand-via" />
        Məşqçi
      </label>
    </fieldset>
  );
}
