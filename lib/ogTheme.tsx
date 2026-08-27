/**
 * Paylaşım şəkillərinin ortaq çərçivəsi.
 *
 * Şəkillər `next/og` (satori) ilə çəkilir və o, CSS-in yalnız bir hissəsini
 * başa düşür: dəyişənlər (`var(--brand-via)`), Tailwind sinifləri və qlobal
 * stil faylı buraya çatmır. Ona görə rənglər burada təkrar yazılıb — bu,
 * təkrarçılıq deyil, fərqli bir render mühitidir. globals.css dəyişəndə bura da
 * əl ilə yenilənməlidir.
 *
 * Satori-nin ikinci qaydası: birdən çox uşağı olan hər div-də `display: flex`
 * açıq yazılmalıdır, yoxsa render sınır.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export const C = {
  background: "#0a0b10",
  surface: "#111319",
  border: "#262b38",
  foreground: "#e7e9ee",
  muted: "#8b93a7",
  from: "#7c3aed",
  via: "#d946ef",
  to: "#22d3ee",
  live: "#ef4444",
};

export function Frame({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: C.background,
        // Yumşaq işıq: brend hissini verir, mətni oxunaqsız etmir.
        backgroundImage: `radial-gradient(900px 420px at 15% -10%, ${accent ?? C.from}33, transparent), radial-gradient(700px 380px at 100% 110%, ${C.to}22, transparent)`,
        padding: 64,
        position: "relative",
      }}
    >
      {/* Üst kənardakı brend zolağı */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 10,
          background: `linear-gradient(90deg, ${C.from}, ${C.via}, ${C.to})`,
        }}
      />
      {children}
    </div>
  );
}

export function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${C.from}, ${C.via}, ${C.to})`,
        }}
      />
      <div style={{ fontSize: 30, fontWeight: 700, color: C.foreground, letterSpacing: -0.5 }}>
        ArenaHub
      </div>
    </div>
  );
}
