import Link from "next/link";
import FanResetPasswordForm from "@/components/fan/FanResetPasswordForm";

export default async function FanResetPasswordPage({
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
          <Link href="/fan/forgot-password" className="text-sm text-brand-via hover:underline">
            Yenidən sorğu göndər
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <FanResetPasswordForm token={token} />
    </div>
  );
}
