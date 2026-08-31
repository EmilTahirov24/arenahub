import { composite, readableOn } from "@/lib/contrast";

// Pilin fonu accent rənginin 10%-idir, ona görə oxunaqlılıq həmin qarışığa
// qarşı hesablanır, təmiz səthə qarşı yox.
//
// Səthlər `globals.css`-dəkilərin ƏN PİS halıdır və hər iki temada bu, ən açıq
// səthdir — `--surface-raised`. Səbəb hər iki halda eynidir: fon nə qədər mətnin
// işıqlılığına yaxınlaşsa, kontrast bir o qədər azalır.
//
// Bu, ilk cəhddə səhv seçilmişdi: işıqlı tema üçün `#ffffff` yazılmışdı, yəni
// ən nikbin hal. Nəticədə hesablanan rənglər 4.06–4.32 verdi — düzəliş
// edilmişdi, amma yenə həddin altında. Ölçülən fonlar (`#f1e9e2`, `#f2dfe7`,
// `#eedce2`, `#ece9ea`) məhz `--surface-raised` ilə üst-üstə düşür.
// İşıqlı dəyər `--surface-raised` (#f0f0f7) DEYİL, ondan bir az tünddür.
//
// Səbəb 2026-08-31-də ölçüldü: hero zolağının marka çaları gücləndiriləndə
// (`globals.css`, --ambient-a/b) pillərin altındakı ən pis fon artıq ən açıq
// SƏTH deyil, həmin çalar oldu. axe dörd pil üçün 4.34–4.43 verdi — hədd 4.5.
//
// Dəyər uydurulmayıb: brauzerdə hero mətninin altındakı REAL pikselin ən tünd
// nöqtəsi ölçüldü və #e4e4f4 çıxdı. Pillər ondan da aşağıdadır, yəni orada fon
// daha açıqdır — bu dəyər ehtiyatlı tərəfdədir.
const DARK_SURFACE = "#171a22";
const LIGHT_SURFACE = "#e4e4f4";

export default function GameChip({
  name,
  color,
  className = "",
}: {
  name: string;
  color: string;
  className?: string;
}) {
  // İki rəng hesablanır, çünki eyni accent iki temada əks istiqamətə düzəlir:
  // tünd fonda açılmalı, açıq fonda qaraldılmalıdır. Inline stil temaya reaksiya
  // verə bilmir, ona görə hər ikisi CSS dəyişəni kimi verilir və seçimi
  // `globals.css`-dəki qayda edir.
  const onDark = readableOn(color, composite(color, 0.1, DARK_SURFACE));
  const onLight = readableOn(color, composite(color, 0.1, LIGHT_SURFACE));

  return (
    <span
      className={`game-chip inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}
      style={
        {
          "--chip-fg-dark": onDark,
          "--chip-fg-light": onLight,
          backgroundColor: `${color}1a`,
          border: `1px solid ${color}40`,
        } as React.CSSProperties
      }
    >
      {name}
    </span>
  );
}
