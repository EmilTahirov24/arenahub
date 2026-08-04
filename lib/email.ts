import "server-only";

/**
 * Whether the message actually left the building.
 *
 * This used to be `void`: a Resend rejection was written to the server console
 * and swallowed, so registration carried on and told the user their link was on
 * its way when nothing had been sent. Callers now have to look at the result —
 * a signup whose email silently failed is a dead account.
 */
export type EmailResult = { ok: true; delivered: boolean } | { ok: false; reason: string };

/** No provider configured: the link goes to the console so local dev works. */
const LOGGED_TO_CONSOLE: EmailResult = { ok: true, delivered: false };

/**
 * Which way out the message goes.
 *
 * SMTP wins when it is configured, because it is the option that actually
 * reaches strangers. Resend will not send to an arbitrary address until a
 * domain has been verified with it, and verifying a domain means owning one —
 * on the sandbox sender (`onboarding@resend.dev`) every message silently goes
 * nowhere except the Resend account holder's own inbox, which is indis-
 * tinguishable from working when you are the one testing it.
 *
 * A plain mailbox has no such restriction: Gmail with an app password sends as
 * the account and reaches anyone, capped around 500 a day. Once a domain is
 * verified in Resend, drop the SMTP_* variables and Resend takes over again —
 * it is the better long-term answer for deliverability and volume.
 */
function transport(): "smtp" | "resend" | "console" {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  if (process.env.RESEND_API_KEY) return "resend";
  return "console";
}

/**
 * Gmail rejects a From that is not the authenticated account, and most other
 * providers rewrite it silently — so the configured address is only honoured
 * when it really is the mailbox we are signed in to.
 */
function smtpFrom(user: string): string {
  const configured = process.env.EMAIL_FROM;
  return configured?.includes(user) ? configured : `ArenaHub <${user}>`;
}

/** Built once and reused: a new connection per email is slow and rude. */
let mailer: import("nodemailer").Transporter | null = null;

async function smtpTransporter() {
  if (mailer) return mailer;
  const nodemailer = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT ?? 465);
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS after connecting.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });
  return mailer;
}

/**
 * Real email via Resend once RESEND_API_KEY is set; otherwise the link is
 * just logged to the server console so password reset still works in local
 * dev without any email provider configured — same fallback shape as
 * lib/storage.ts for Vercel Blob.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  locale: "az" | "en" = "az",
): Promise<EmailResult> {
  return send({
    to,
    url: resetUrl,
    label: "Password reset",
    subject: locale === "az" ? "ArenaHub — Şifrə sıfırlama" : "ArenaHub — Password reset",
    html: renderResetEmailHtml(resetUrl, locale),
  });
}

export async function sendVerificationEmail(
  to: string,
  verifyUrl: string,
  locale: "az" | "en" = "az",
): Promise<EmailResult> {
  return send({
    to,
    url: verifyUrl,
    label: "Verification",
    subject: locale === "az" ? "ArenaHub — Emailinizi təsdiqləyin" : "ArenaHub — Verify your email",
    html: renderVerifyEmailHtml(verifyUrl, locale),
  });
}

async function send(msg: { to: string; url: string; label: string; subject: string; html: string }): Promise<EmailResult> {
  const via = transport();

  if (via === "console") {
    console.log(`[dev-mode] ${msg.label} link for ${msg.to}: ${msg.url}`);
    return LOGGED_TO_CONSOLE;
  }

  try {
    if (via === "smtp") {
      const user = process.env.SMTP_USER!;
      const mail = await smtpTransporter();
      await mail.sendMail({
        from: smtpFrom(user),
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
      });
      return { ok: true, delivered: true };
    }

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Resend's sandbox sender only delivers to the account owner's own inbox,
    // so leaving EMAIL_FROM unset — or leaving it pointed at resend.dev — means
    // real users never receive anything. Worth saying out loud rather than
    // discovering it from silence.
    const from = process.env.EMAIL_FROM;
    if (!from || from.includes("resend.dev")) {
      console.warn(
        "EMAIL_FROM uses Resend's sandbox sender, which only reaches the Resend account owner. " +
          "Verify a domain in Resend, or set SMTP_USER/SMTP_PASS to send through a real mailbox.",
      );
    }

    const { error } = await resend.emails.send({
      from: from || "ArenaHub <onboarding@resend.dev>",
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
    });

    if (error) {
      console.error(`Resend rejected the ${msg.label.toLowerCase()} email:`, error);
      console.log(`[fallback] ${msg.label} link for ${msg.to}: ${msg.url}`);
      return { ok: false, reason: error.message ?? "Resend error" };
    }

    return { ok: true, delivered: true };
  } catch (e) {
    // A thrown error used to escape the server action entirely, leaving the
    // caller half-done — an account created but no session, for instance.
    console.error(`Sending the ${msg.label.toLowerCase()} email via ${via} threw:`, e);
    console.log(`[fallback] ${msg.label} link for ${msg.to}: ${msg.url}`);

    // A dead connection must not be reused on the next attempt.
    if (via === "smtp") mailer = null;

    return { ok: false, reason: e instanceof Error ? e.message : "unknown error" };
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
