"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Account = {
  nickname: string;
  photoUrl: string | null;
  slug: string;
  /** The slug of the team they own, or null if there is none. */
  ownedTeamSlug: string | null;
};

type State = {
  account: Account | null;
  /** True until the first answer arrives. "Sign in" MUST NOT be shown meanwhile. */
  loading: boolean;
};

const AccountCtx = createContext<State>({ account: null, loading: true });

/**
 * Fetches the account once and hands it to both the desktop and mobile menus.
 *
 * The Header used to read this on the server. That was simpler, but reading
 * `cookies()` makes a route dynamic, and the Header is on every page - so no
 * page on the site could be cached. Now the session arrives from `/api/me` on
 * the client and the pages themselves can be cached.
 *
 * The provider sends one request; the two menus share the result.
 */
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ account: null, loading: true });

  useEffect(() => {
    let alive = true;
    fetch("/api/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { player: null }))
      .then((d) => {
        if (alive) setState({ account: d?.player ?? null, loading: false });
      })
      .catch(() => {
        // A network error must not break the menu - it renders as signed out.
        if (alive) setState({ account: null, loading: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  return <AccountCtx.Provider value={state}>{children}</AccountCtx.Provider>;
}

export function useAccount() {
  return useContext(AccountCtx);
}
