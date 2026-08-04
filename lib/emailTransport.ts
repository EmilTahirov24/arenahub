/**
 * How an email leaves the building — provider choice, sender address, and the
 * SMTP connection itself.
 *
 * Deliberately **not** `server-only`, unlike lib/email.ts which imports it. The
 * point is that `scripts/check-email.ts` can exercise the real decisions rather
 * than a copy of them: a diagnostic that reimplements the logic it is meant to
 * check will happily agree with itself while production does something else.
 * Nothing here touches a request, a session or the database, so it is safe
 * outside the server bundle.
 */

export type EmailTransport = "smtp" | "resend" | "console";

/**
 * Which way out the message goes.
 *
 * SMTP wins when it is configured, because it is the option that actually
 * reaches strangers. Resend will not send to an arbitrary address until a
 * domain has been verified with it, and verifying a domain means owning one —
 * on the sandbox sender (`onboarding@resend.dev`) every message silently goes
 * nowhere except the Resend account holder's own inbox, which is
 * indistinguishable from working when you are the one testing it.
 *
 * A plain mailbox has no such restriction: Gmail with an app password sends as
 * the account and reaches anyone, capped around 500 a day. Once a domain is
 * verified in Resend, drop the SMTP_* variables and Resend takes over again —
 * it is the better long-term answer for deliverability and volume.
 */
export function emailTransport(): EmailTransport {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  if (process.env.RESEND_API_KEY) return "resend";
  return "console";
}

/**
 * Gmail rejects a From that is not the authenticated account, and most other
 * providers rewrite it silently — so the configured address is only honoured
 * when it really is the mailbox we are signed in to.
 *
 * Says so out loud when it overrides the configuration: a stale `EMAIL_FROM`
 * left pointing at the old provider would otherwise be ignored without a word,
 * and whoever set it would go on believing it was in use.
 */
export function smtpFrom(user: string): string {
  const configured = process.env.EMAIL_FROM;
  if (configured && !configured.includes(user)) {
    console.warn(
      `EMAIL_FROM ("${configured}") is not the SMTP_USER mailbox (${user}), so it was ignored — ` +
        `the provider would reject or rewrite it. Sending as "ArenaHub <${user}>" instead.`,
    );
  }
  return configured?.includes(user) ? configured : `ArenaHub <${user}>`;
}

/** Built once and reused: a new connection per email is slow and rude. */
let mailer: import("nodemailer").Transporter | null = null;

export async function smtpTransporter() {
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

/** Dropped after a failure so a dead connection is not reused. */
export function resetSmtpTransporter() {
  mailer = null;
}
