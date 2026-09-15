"use client";

import { useAccount } from "./AccountContext";

/**
 * The "Edit" link - for the owner only.
 *
 * This used to be decided on the server: the page called `getPlayerSession()`
 * and checked whether the viewer owned that profile or team. The price paid
 * for one link was that no player or team page (over 1,400 of them) could be
 * cached - reading `cookies()` makes a route dynamic.
 *
 * Now the comparison happens on the client and the page itself is cached. The
 * link appears after hydration; since it is a secondary affordance only the
 * owner ever sees, that is acceptable.
 */
export default function OwnerEditLink({
  href,
  label,
  match,
  className,
}: {
  href: string;
  label: string;
  /** The match that decides whether the viewer owns this page. */
  match: { kind: "player"; slug: string } | { kind: "team"; slug: string };
  className?: string;
}) {
  const { account } = useAccount();
  if (!account) return null;

  const mine =
    match.kind === "player" ? account.slug === match.slug : account.ownedTeamSlug === match.slug;
  if (!mine) return null;

  // /player sits outside the [locale] segment, so this is a plain <a> - the
  // i18n Link would add a locale prefix to the address.
  return (
    <a href={href} className={className}>
      {label}
    </a>
  );
}
