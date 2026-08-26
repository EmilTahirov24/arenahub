import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import HtmlLang from "./HtmlLang";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: { default: t("site.name"), template: `%s — ${t("site.name")}` },
    description: t("home.subtitle"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      {/*
        The root layout hard-codes lang="az" because it sits above [locale] and
        cannot see which language was asked for. The first paint is corrected by
        the inline script in app/layout.tsx, which reads the locale out of the
        URL; this component keeps it correct across client-side navigation, which
        a script tag inside the tree cannot do. The served HTML still says "az"
        until <html> moves under [locale] — a forty-file change through the
        routes that carry authentication.
      */}
      <HtmlLang locale={locale} />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </NextIntlClientProvider>
  );
}
