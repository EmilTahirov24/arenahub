import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit testlər — brauzersiz, bazasız, şəbəkəsiz.
 *
 * `e2e/` qovluğu qəsdən kənardadır: orada Playwright öz qaçırıcısı ilə işləyir
 * (`npm run e2e`) və işləyən server tələb edir. Buradakı testlər saf məntiqə
 * baxır, ona görə saniyələr çəkir və CI-də hər push-da qaçır.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
