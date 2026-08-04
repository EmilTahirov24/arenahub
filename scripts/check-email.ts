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

  console.log(`Seçilən yol : ${via}`);

  if (via === "console") {
    console.log("\nHeç bir provayder qurulmayıb.");
    console.log("Linklər yalnız server konsoluna yazılır — real istifadəçi heç nə almır.");
    console.log("Həll: SMTP_USER + SMTP_PASS (Gmail App Password), yaxud RESEND_API_KEY.");
    return;
  }

  if (via === "resend") {
    const from = process.env.EMAIL_FROM ?? "(qurulmayıb)";
    console.log(`Göndərici   : ${from}`);
    if (from.includes("resend.dev")) {
      console.log("\nDİQQƏT: bu, Resend-in sınaq göndəricisidir.");
      console.log("Məktub YALNIZ Resend hesabının sahibinə çatır — qeydiyyatdan keçən yad adam heç nə almır.");
      console.log("Həll: Resend-də domen təsdiqləyin, yaxud SMTP_USER + SMTP_PASS qoyun.");
    } else {
      console.log("\nTəsdiqlənmiş domen görünür — istənilən ünvana göndərilməlidir.");
    }
    if (to) console.log(`\n(--to ${to} yalnız SMTP rejimində sınanır; Resend üçün panelindən yoxlayın.)`);
    return;
  }

  // --- SMTP ---------------------------------------------------------------
  const user = process.env.SMTP_USER!;
  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? 465);
  console.log(`Server      : ${host}:${port}`);
  console.log(`Hesab       : ${user}`);
  console.log(`Göndərici   : ${smtpFrom(user)}`);

  const mailer = await smtpTransporter();

  process.stdout.write("\nBağlantı və giriş yoxlanılır... ");
  try {
    await mailer.verify();
    console.log("UĞURLU.");
  } catch (e) {
    console.log("UĞURSUZ.\n");
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`Serverin cavabı: ${msg}`);
    if (/BadCredentials|535/.test(msg)) {
      console.log(
        "\nBu, adətən adi Google şifrəsinin işlədilməsi deməkdir. App Password lazımdır:\n" +
          "  1) hesabda 2 addımlı doğrulama aktiv olmalıdır\n" +
          "  2) myaccount.google.com/apppasswords → 16 simvolluq açar\n" +
          "  3) həmin açar SMTP_PASS-a yazılır (boşluqlar olmadan)",
      );
    }
    process.exitCode = 1;
    return;
  }

  if (!to) {
    console.log("\nKonfiqurasiya qaydasındadır. Əsl məktub göndərmək üçün: --to ad@numune.com");
    return;
  }

  process.stdout.write(`\n${to} ünvanına sınaq məktubu göndərilir... `);
  try {
    const info = await mailer.sendMail({
      from: smtpFrom(user),
      to,
      subject: "ArenaHub — e-poçt yoxlaması",
      html:
        `<div style="font-family:Arial,sans-serif;max-width:480px">` +
        `<h2>ArenaHub</h2><p>Bu, e-poçt qurulumunun yoxlanışıdır. Bunu görürsünüzsə, ` +
        `qeydiyyat və şifrə bərpası məktubları da çatacaq.</p></div>`,
    });
    console.log("GÖNDƏRİLDİ.");
    console.log(`Mesaj kimliyi: ${info.messageId}`);
    console.log("\nPoçt qutusunu yoxlayın — spam qovluğuna da baxın.");
  } catch (e) {
    console.log("UĞURSUZ.");
    console.log(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
