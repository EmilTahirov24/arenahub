"use client";

import { useEffect } from "react";

/**
 * Keeps the <html lang> attribute in step with the current language.
 *
 * This used to be done by a raw `<script>` tag written inside the component.
 * It worked on the first page from the server but NOT on client-side
 * navigations - React never executes script tags in the component tree during
 * a client render, and warned about it in the console.
 *
 * The result: switching from /az to /en with the language button left the
 * document still declaring itself Azerbaijani - so the MAIN way of changing
 * language was the one way the fix did not work. A screen reader read the
 * English text with Azerbaijani pronunciation.
 *
 * The first paint is handled by the inline script in app/layout.tsx (it reads
 * the address and runs before render); this component catches every change
 * after that. The HTML the server sends still says "az" - fixing that means
 * moving <html> under [locale], which means giving /player and /admin a
 * second root layout.
 */
export default function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return null;
}
