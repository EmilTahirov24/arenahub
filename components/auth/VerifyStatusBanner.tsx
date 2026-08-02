"use client";

import { useSearchParams } from "next/navigation";

export default function VerifyStatusBanner() {
  const params = useSearchParams();
  const verify = params.get("verify");

  if (verify === "success") {
    return (
      <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
        Email təsdiqləndi. İndi daxil ola bilərsiniz.
      </p>
    );
  }

  if (verify === "invalid") {
    return (
      <p className="mb-4 rounded-md border border-live/30 bg-live/10 px-3 py-2 text-xs text-live">
        Təsdiq linki etibarsızdır və ya vaxtı bitib.
      </p>
    );
  }

  return null;
}
