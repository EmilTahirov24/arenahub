"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Account = {
  nickname: string;
  photoUrl: string | null;
  slug: string;
  /** Sahibi olduğu komandanın slug-ı, yoxdursa null. */
  ownedTeamSlug: string | null;
};

type State = {
  account: Account | null;
  /** İlk cavab gələnə qədər true. Bu müddətdə «Giriş» GÖSTƏRİLMƏMƏLİDİR. */
  loading: boolean;
};

const AccountCtx = createContext<State>({ account: null, loading: true });

/**
 * Hesab məlumatını bir dəfə çəkib həm masaüstü, həm mobil menyuya verir.
 *
 * Əvvəl bunu Header serverdə oxuyurdu. Sadə idi, amma `cookies()` oxumaq
 * marşrutu dinamik edir və Header hər səhifədədir — nəticədə saytın heç bir
 * səhifəsi keşlənmirdi. İndi sessiya `/api/me`-dən client tərəfdə gəlir və
 * səhifələrin özü keşlənə bilir.
 *
 * Provider bir dəfə sorğu göndərir; iki menyu eyni nəticəni bölüşür.
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
        // Şəbəkə xətası menyunu sındırmamalıdır — çıxmış kimi göstəririk.
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
