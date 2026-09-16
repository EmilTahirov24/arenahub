/**
 * Answers one question: will a password-reset link actually reach the person
 * who asked for it?
 *
 *   npx tsx scripts/check-email.ts                     # configuration only
 *   npx tsx scripts/check-email.ts --to ad@numune.com  # sends a real message
 *
 * Reads the same `lib/emailTransport.ts` the app does, so it reports what
 * production will really do rather than what the environment looks like.
 *
 * No secret is ever printed.
 */
import "dotenv/config";
import { emailTransport, smtpFrom, smtpTransporter } from "../lib/emailTransport";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const to = arg("--to");
  const via = emailTransport();

  console.log(`Route chosen : ${via}`);

  if (via === "console") {
    console.log("\nNo provider is configured.");
    console.log("Links are only written to the server console - a real user receives nothing.");
    console.log("Fix: SMTP_USER + SMTP_PASS (a Gmail App Password), or RESEND_API_KEY.");
    return;
  }

  if (via === "resend") {
    const from = process.env.EMAIL_FROM ?? "(not configured)";
    console.log(`Sender      : ${from}`);
    if (from.includes("resend.dev")) {
      console.log("\nCAUTION: this is Resend's sandbox sender.");
      console.log("Mail reaches ONLY the Resend account holder - a stranger who registers receives nothing.");
      console.log("Fix: verify a domain with Resend, or set SMTP_USER + SMTP_PASS.");
    } else {
      console.log("\nA verified domain is in use - it should send to any address.");
    }
    if (to) console.log(`\n(--to ${to} is only exercised in SMTP mode; for Resend, check their dashboard.)`);
    return;
  }

  // --- SMTP ---------------------------------------------------------------
  const user = process.env.SMTP_USER!;
  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? 465);
  console.log(`Server      : ${host}:${port}`);
  console.log(`Account     : ${user}`);
  console.log(`Sender      : ${smtpFrom(user)}`);

  const mailer = await smtpTransporter();

  process.stdout.write("\nChecking the connection and the login... ");
  try {
    await mailer.verify();
    console.log("OK.");
  } catch (e) {
    console.log("FAILED.\n");
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`The server said: ${msg}`);
    if (/BadCredentials|535/.test(msg)) {
      console.log(
        "\nThis usually means an ordinary Google password was used. An App Password is needed:\n" +
          "  1) two-step verification has to be on for the account\n" +
          "  2) myaccount.google.com/apppasswords -> a 16-character key\n" +
          "  3) that key goes into SMTP_PASS (with no spaces)",
      );
    }
    process.exitCode = 1;
    return;
  }

  if (!to) {
    console.log("\nThe configuration is sound. To send a real message: --to name@example.com");
    return;
  }

  process.stdout.write(`\nSending a test message to ${to}... `);
  try {
    const info = await mailer.sendMail({
      from: smtpFrom(user),
      to,
      subject: "ArenaHub - email check",
      html:
        `<div style="font-family:Arial,sans-serif;max-width:480px">` +
        `<h2>ArenaHub</h2><p>This is a check of the email setup. If you can see it, ` +
        `registration and password-reset messages will arrive too.</p></div>`,
    });
    console.log("SENT.");
    console.log(`Mesaj kimliyi: ${info.messageId}`);
    console.log("\nCheck the mailbox - look in the spam folder too.");
  } catch (e) {
    console.log("FAILED.");
    console.log(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
