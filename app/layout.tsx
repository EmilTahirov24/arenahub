import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const DESCRIPTION = "CS2, Dota 2, Valorant və LoL üçün matçlar, komandalar, oyunçular, xəbərlər və canlı statistika bir yerdə.";

export const metadata: Metadata = {
  title: { default: "ArenaHub", template: "%s — ArenaHub" },
  description: DESCRIPTION,
  openGraph: {
    title: "ArenaHub",
    description: DESCRIPTION,
    type: "website",
    siteName: "ArenaHub",
  },
  twitter: {
    card: "summary",
    title: "ArenaHub",
    description: DESCRIPTION,
  },
};

/**
 * Boyanmadan əvvəl işləyən iki düzəliş.
 *
 * Tema: saxlanılmış seçim tətbiq olunmasa, səhifə əvvəl qaranlıq çəkilir və
 * sonra işığa sıçrayır.
 *
 * Dil: <html> bu layoutdadır, [locale] isə altındadır — yəni hansı dilin
 * istəndiyini burada bilmək mümkün deyil və atribut sabit "az" qalırdı. Ünvanın
 * özündən oxumaq bu asılılığı aradan qaldırır və hər tam yüklənmədə işləyir.
 * Client tərəfdəki keçidlər üçün app/[locale]/HtmlLang.tsx var.
 */
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored || "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
  try {
    var m = location.pathname.match(/^\\/(az|en)(\\/|$)/);
    if (m) document.documentElement.lang = m[1];
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="az"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
