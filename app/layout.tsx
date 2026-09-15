import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { siteUrl } from "@/lib/siteUrl";
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
  // The share images need an ABSOLUTE address - Telegram, Discord and X cannot
  // open a relative path. Without this Next warns and falls back to localhost,
  // or to Vercel's temporary domain that changes on every deploy; so the image
  // on an old shared link breaks after a while.
  metadataBase: new URL(siteUrl()),
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
 * Two corrections that run before the first paint.
 *
 * Theme: without applying the stored choice the page is drawn dark first and
 * then jumps to light.
 *
 * Language: <html> is in this layout and [locale] sits below it - so there is
 * no way to know here which language was asked for, and the attribute stayed
 * fixed at "az". Reading it from the address itself removes that dependency
 * and works on every full load. Client-side navigations are handled by
 * app/[locale]/HtmlLang.tsx.
 */
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    // With no choice made, the device's own mode. This simply said "dark"
    // before, so a visitor whose system was in light mode never saw the light
    // theme without pressing the button.
    //
    // The attribute is SET either way - not left to a media query - because
    // every light rule hangs off the data-theme="light" selector, and writing
    // them twice would mean fixing two places for every new colour.
    var theme = stored ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);

    // With no choice made, the site follows the system mode changing in an open window.
    if (!stored && window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function (e) {
        if (localStorage.getItem("theme")) return;
        document.documentElement.setAttribute("data-theme", e.matches ? "light" : "dark");
      });
    }
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
