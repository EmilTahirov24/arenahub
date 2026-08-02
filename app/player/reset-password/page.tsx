import Link from "next/link";
import PlayerResetPasswordForm from "@/components/player/PlayerResetPasswordForm";

export default async function PlayerResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface p-6 text-center">
          <p className="mb-4 text-sm text-live">Sıfırlama linki etibarsızdır.</p>
          <Link href="/player/forgot-password" className="text-sm text-brand-via hover:underline">
            Yenidən sorğu göndər
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <PlayerResetPasswordForm token={token} />
    </div>
  );
}
