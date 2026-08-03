import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import PageShell from "@/components/layout/PageShell";

export const dynamic = "force-static";

const CONTENT = {
  az: {
    title: "İstifadə Şərtləri",
    updated: "Son yenilənmə: 2026",
    sections: [
      {
        h: "1. Ümumi müddəalar",
        p: "Bu İstifadə Şərtləri ArenaHub platformasından (\"Platforma\") istifadəni tənzimləyir. Platformadan istifadə edərək bu şərtləri qəbul etmiş sayılırsınız.",
      },
      {
        h: "2. Platformanın təsviri",
        p: "ArenaHub müxtəlif esports oyunları üzrə matç, komanda, oyunçu, turnir və xəbər məlumatlarını təqdim edən bir platformadır. Komandalar və oyunçular öz hesablarını yaradıb məlumatlarını idarə edə bilərlər.",
      },
      {
        h: "3. Hesab yaratmaq",
        p: "Qeydiyyatdan keçərkən düzgün məlumat verməyisiniz xahiş olunur. Hesabınızın təhlükəsizliyinə (şifrənizin gizli saxlanmasına) görə siz məsuliyyət daşıyırsınız. Bir şəxs/qurum üçün yalnız bir hesab yaradılmalıdır.",
      },
      {
        h: "4. İstifadəçi məzmunu",
        p: "Yüklədiyiniz şəkillər (loqo, profil şəkli və s.) üçün bütün hüquqi məsuliyyət sizə aiddir — yalnız istifadə hüququnuz olan materialları yükləməlisiniz. Başqasının müəllif hüququ ilə qorunan materialını icazəsiz yükləmək qadağandır və aşkar olunduqda həmin məzmun silinəcək, hesab bağlana bilər.",
      },
      {
        h: "5. Qadağan olunan davranış",
        p: "Platformaya zərər vermək, təhlükəsizlik tədbirlərini yan keçməyə cəhd etmək, saxta məlumat yaymaq və ya digər istifadəçilərə xələl gətirən hərəkətlər qadağandır.",
      },
      {
        h: "6. Xidmətin dəyişməsi və dayandırılması",
        p: "Platforma istənilən vaxt dəyişdirilə, məhdudlaşdırıla və ya dayandırıla bilər. Şərtləri pozan hesablar xəbərdarlıq edilmədən bağlana bilər.",
      },
      {
        h: "7. Məsuliyyətin məhdudlaşdırılması",
        p: "Platforma \"olduğu kimi\" təqdim olunur, məlumatların dəqiqliyinə görə tam zəmanət verilmir. Platformanın istifadəsindən yaranan hər hansı zərərə görə məsuliyyət daşımırıq, qanunun icazə verdiyi həddə.",
      },
      {
        h: "8. Əlaqə",
        p: "Suallarınız üçün admin panel vasitəsilə bizimlə əlaqə saxlaya bilərsiniz.",
      },
    ],
  },
  en: {
    title: "Terms of Service",
    updated: "Last updated: 2026",
    sections: [
      {
        h: "1. General",
        p: "These Terms of Service govern your use of the ArenaHub platform (\"Platform\"). By using the Platform, you agree to these terms.",
      },
      {
        h: "2. Description of the Platform",
        p: "ArenaHub provides match, team, player, tournament and news information across several esports titles. Teams and players may create their own accounts to manage their information.",
      },
      {
        h: "3. Creating an account",
        p: "You are asked to provide accurate information when registering. You are responsible for keeping your account secure, including your password. Only one account should be created per person or organization.",
      },
      {
        h: "4. User content",
        p: "You are solely responsible for any images you upload (logos, profile photos, etc.) — only upload material you have the right to use. Uploading another party's copyrighted material without permission is prohibited; such content will be removed and the account may be suspended if discovered.",
      },
      {
        h: "5. Prohibited conduct",
        p: "You may not attempt to damage the Platform, circumvent its security measures, spread false information, or interfere with other users.",
      },
      {
        h: "6. Changes and termination",
        p: "The Platform may be changed, restricted, or discontinued at any time. Accounts that violate these terms may be suspended without prior notice.",
      },
      {
        h: "7. Limitation of liability",
        p: "The Platform is provided \"as is\" without full guarantee of data accuracy. We are not liable for any damages arising from use of the Platform, to the extent permitted by law.",
      },
      {
        h: "8. Contact",
        p: "For questions, please reach out to us via the admin panel.",
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

export default async function TermsPage({
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
