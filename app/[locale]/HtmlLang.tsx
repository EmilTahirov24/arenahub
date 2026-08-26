"use client";

import { useEffect } from "react";

/**
 * <html lang> atributunu cari dillə uyğunlaşdırır.
 *
 * Əvvəl bu iş komponentin içinə yazılmış xam `<script>` teqi ilə görülürdü.
 * O, serverdən gələn ilk səhifədə işləyirdi, amma client tərəfdəki keçidlərdə
 * YOX — React komponent ağacındakı script teqlərini client render zamanı heç
 * vaxt icra etmir və konsolda bu barədə xəbərdarlıq da verirdi.
 *
 * Nəticə: dil düyməsi ilə /az-dan /en-ə keçəndə sənəd özünü hələ də azərbaycan
 * dilində elan edirdi — yəni dili dəyişməyin ƏSAS yolu düzəlişin işləmədiyi
 * yeganə yol idi. Ekran oxuyucusu ingilis mətnini azərbaycan tələffüzü ilə
 * oxuyurdu.
 *
 * İlk boyanma üçün app/layout.tsx-dəki inline skript cavabdehdir (o, ünvandan
 * oxuyur və render-dən əvvəl işləyir); bu komponent isə sonrakı hər dəyişikliyi
 * tutur. Serverin verdiyi HTML hələ də "az" deyir — onu düzəltmək üçün <html>
 * [locale] altına köçürülməlidir, bu isə /player və /admin-ə ikinci root layout
 * vermək deməkdir.
 */
export default function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return null;
}
