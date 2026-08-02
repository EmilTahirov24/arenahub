import "server-only";

/**
 * Real email via Resend once RESEND_API_KEY is set; otherwise the link is
 * just logged to the server console so password reset still works in local
 * dev without any email provider configured — same fallback shape as
 * lib/storage.ts for Vercel Blob.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string, locale: "az" | "en" = "az") {
  const subject = locale === "az" ? "ArenaHub — Şifrə sıfırlama" : "ArenaHub — Password reset";
  const html = renderResetEmailHtml(resetUrl, locale);

  if (!process.env.RESEND_API_KEY) {
    console.log(`[dev-mode] Password reset link for ${to}: ${resetUrl}`);
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.EMAIL_FROM || "ArenaHub <onboarding@resend.dev>";

  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    console.error("Resend error, falling back to console log:", error);
    console.log(`[fallback] Password reset link for ${to}: ${resetUrl}`);
  }
}

export async function sendVerificationEmail(to: string, verifyUrl: string, locale: "az" | "en" = "az") {
  const subject = locale === "az" ? "ArenaHub — Emailinizi təsdiqləyin" : "ArenaHub — Verify your email";
  const html = renderVerifyEmailHtml(verifyUrl, locale);

  if (!process.env.RESEND_API_KEY) {
    console.log(`[dev-mode] Verification link for ${to}: ${verifyUrl}`);
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.EMAIL_FROM || "ArenaHub <onboarding@resend.dev>";

  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    console.error("Resend error, falling back to console log:", error);
    console.log(`[fallback] Verification link for ${to}: ${verifyUrl}`);
  }
}

function renderVerifyEmailHtml(verifyUrl: string, locale: "az" | "en") {
  const heading = locale === "az" ? "Emailinizi təsdiqləyin" : "Verify your email";
  const body =
    locale === "az"
      ? "ArenaHub-da qeydiyyatdan keçdiyiniz üçün təşəkkürlər. Hesabınızı aktivləşdirmək üçün aşağıdakı düyməyə klikləyin."
      : "Thanks for registering on ArenaHub. Click the button below to confirm your email and activate your account.";
  const button = locale === "az" ? "Emaili təsdiqlə" : "Verify email";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0a0b10; color: #e6e6f0;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">ArenaHub</h1>
      <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">${heading}</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #a0a0b8;">${body}</p>
      <a href="${verifyUrl}" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: linear-gradient(90deg,#8b5cf6,#d946ef,#06b6d4); color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">${button}</a>
      <p style="font-size: 12px; color: #6b6b80; margin-top: 24px; word-break: break-all;">${verifyUrl}</p>
    </div>
  `;
}

function renderResetEmailHtml(resetUrl: string, locale: "az" | "en") {
  const heading = locale === "az" ? "Şifrənizi sıfırlayın" : "Reset your password";
  const body =
    locale === "az"
      ? "Şifrənizi sıfırlamaq üçün aşağıdakı düyməyə klikləyin. Bu link 1 saat ərzində etibarlıdır. Əgər bu sorğunu siz göndərməmisinizsə, bu emaili gözardı edə bilərsiniz."
      : "Click the button below to reset your password. This link is valid for 1 hour. If you did not request this, you can safely ignore this email.";
  const button = locale === "az" ? "Şifrəni sıfırla" : "Reset password";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0a0b10; color: #e6e6f0;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">ArenaHub</h1>
      <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">${heading}</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #a0a0b8;">${body}</p>
      <a href="${resetUrl}" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: linear-gradient(90deg,#8b5cf6,#d946ef,#06b6d4); color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">${button}</a>
      <p style="font-size: 12px; color: #6b6b80; margin-top: 24px; word-break: break-all;">${resetUrl}</p>
    </div>
  `;
}
