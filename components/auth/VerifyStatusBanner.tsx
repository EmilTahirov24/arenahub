"use client";

import { useSearchParams } from "next/navigation";

/**
 * Outcome of the email-confirmation link, shown on the login page it redirects
 * to. "expired" is kept separate from "invalid" because the two need different
 * things from the reader: an expired link means log in and press resend, an
 * invalid one means the link was mistyped or truncated by a mail client.
 */
export default function VerifyStatusBanner() {
  const params = useSearchParams();
  const verify = params.get("verify");

  if (params.get("reset") === "success") {
    return (
      <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-positive">
        Şifrəniz dəyişdirildi. Yeni şifrə ilə daxil olun.
      </p>
    );
  }

  if (verify === "success") {
    return (
      <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-positive">
        Email təsdiqləndi. İndi daxil ola bilərsiniz.
      </p>
    );
  }

  if (verify === "expired") {
    return (
      <p className="mb-4 rounded-md border border-live/30 bg-live/10 px-3 py-2 text-xs text-live">
        Təsdiq linkinin vaxtı bitib. Daxil olub yeni link göndərə bilərsiniz.
      </p>
    );
  }

  if (verify === "invalid") {
    return (
      <p className="mb-4 rounded-md border border-live/30 bg-live/10 px-3 py-2 text-xs text-live">
        Təsdiq linki tanınmadı. Linki tam kopyalayın və ya daxil olub yenisini göndərin.
      </p>
    );
  }

  return null;
}
