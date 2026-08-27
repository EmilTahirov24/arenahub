import { cacheLife } from "next/cache";

/**
 * Bu günün tarixi, `<input type="date">` üçün.
 *
 * Formalarda "bu gün" defaultu `new Date()` ilə hesablanırdı. Cache Components
 * bunu prerender maneəsi kimi tutur: render-dən render-ə dəyişən dəyər statik
 * qabığa qoyula bilməz, çünki qabıq nə vaxt yaradıldığından asılı olardı.
 *
 * Tarix gündə bir dəfə dəyişir, ona görə gün müddətinə keşlənir — nəticə həm
 * sabitdir, həm də praktikada həmişə doğru.
 */
export async function todayInputValue(): Promise<string> {
  "use cache";
  cacheLife("days");
  return new Date().toISOString().slice(0, 10);
}
