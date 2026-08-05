import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import PageShell from "@/components/layout/PageShell";

// See the note in ../terms/page.tsx: force-static empties `cookies()`, which
// would show a signed-in visitor the logged-out header on this page alone.
export const dynamic = "force-dynamic";

const CONTENT = {
  az: {
    title: "Məxfilik Siyasəti",
    updated: "Son yenilənmə: 2026",
    sections: [
      {
        h: "1. Hansı məlumatları toplayırıq",
        p: "Komanda/oyunçu hesabı yaradarkən: email ünvanı, şifrə (şifrələnmiş şəkildə saxlanılır, oxunaqlı formada heç vaxt saxlanmır), ad/nickname, ölkə, rol və istəyə bağlı olaraq yüklədiyiniz şəkil və sosial media linkləri.",
      },
      {
        h: "2. Məlumatlardan necə istifadə edirik",
        p: "Bu məlumatlar yalnız hesabınızı təsdiqləmək, profil məlumatlarınızı platformada göstərmək və hesabınızı idarə etməyinizə imkan vermək üçün istifadə olunur. Şəxsi məlumatlarınız satılmır.",
      },
      {
        h: "3. Cookie və yerli saxlama",
        p: "Girişinizi yadda saxlamaq üçün bir sessiya cookie-si istifadə olunur (yalnız zəruri, marketinq məqsədli deyil). Tema seçiminiz (dark/light) brauzerinizin yerli yaddaşında (localStorage) saxlanılır.",
      },
      {
        h: "4. Məlumatların paylaşılması",
        p: "Məlumatlarınız üçüncü tərəflərlə satılmır və ya paylaşılmır, qanuni tələb olmadığı təqdirdə.",
      },
      {
        h: "5. Məlumatların saxlanma müddəti",
        p: "Hesabınız aktiv olduğu müddətcə məlumatlarınız saxlanılır. Hesabınızı silmək istəsəniz, admin panel vasitəsilə bizimlə əlaqə saxlaya bilərsiniz.",
      },
      {
        h: "6. Hüquqlarınız",
        p: "Öz məlumatlarınıza baxmaq, düzəltmək və ya silinməsini tələb etmək hüququnuz var. Bunun üçün bizimlə əlaqə saxlayın.",
      },
      {
        h: "7. Əlaqə",
        p: "Məxfiliklə bağlı suallarınız üçün admin panel vasitəsilə bizimlə əlaqə saxlaya bilərsiniz.",
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Last updated: 2026",
    sections: [
      {
        h: "1. What we collect",
        p: "When creating a team/player account: email address, password (stored hashed, never in plain text), name/nickname, country, role, and optionally an uploaded photo and social media links.",
      },
      {
        h: "2. How we use it",
        p: "This information is used solely to authenticate your account, display your public profile on the Platform, and let you manage your account. We do not sell your personal data.",
      },
      {
        h: "3. Cookies and local storage",
        p: "A session cookie is used to keep you signed in (strictly necessary, not for marketing). Your theme preference (dark/light) is stored in your browser's local storage.",
      },
      {
        h: "4. Data sharing",
        p: "Your data is not sold or shared with third parties, except where required by law.",
      },
      {
        h: "5. Data retention",
        p: "Your information is retained while your account is active. If you wish to delete your account, please contact us via the admin panel.",
      },
      {
        h: "6. Your rights",
        p: "You have the right to access, correct, or request deletion of your personal data. Contact us to exercise these rights.",
      },
      {
        h: "7. Contact",
        p: "For privacy-related questions, please reach out to us via the admin panel.",
      },
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "en" ? CONTENT.en.title : CONTENT.az.title };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = locale === "en" ? CONTENT.en : CONTENT.az;

  return (
    <PageShell showDefaultWidgets={false}>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display mb-1 text-2xl font-bold">{c.title}</h1>
        <p className="mb-6 text-xs text-foreground-muted">{c.updated}</p>
        <div className="space-y-5">
          {c.sections.map((s) => (
            <div key={s.h}>
              <h2 className="font-display mb-1 text-base font-semibold">{s.h}</h2>
              <p className="text-sm leading-relaxed text-foreground-muted">{s.p}</p>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
