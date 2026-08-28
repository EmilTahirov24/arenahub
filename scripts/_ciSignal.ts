import fs from "node:fs";

/**
 * CI-yə "bu qaçışda nəsə yazıldı" siqnalı.
 *
 * İş axını reytinq yenidən hesablanmasını yalnız bu siqnal gələndə işlədir.
 * Səbəb ölçüldü: `recompute-ratings.ts` bütün bitmiş matçların Elo tarixçəsini
 * yenidən oynadır və qaçışın 28–58%-ni tutur — iki ardıcıl qaçışda 108 və 278
 * saniyə. Matç sayı artdıqca yalnız uzanır. İdxal heç nə yazmayıbsa reytinq də
 * dəyişə bilməz, yəni həmin vaxt tam israfdır.
 *
 * `GITHUB_OUTPUT` yoxdursa funksiya heç nə etmir — lokal qaçışa təsiri sıfırdır.
 * Skriptlərə məxsusdur və qəsdən `lib/`-ə qoyulmayıb: ora Next tətbiqi idxal
 * edir, CI detalının orada yeri yoxdur.
 */
export function signalWrote(written: number): void {
  const out = process.env.GITHUB_OUTPUT;
  if (!out || written <= 0) return;
  fs.appendFileSync(out, "wrote=true\n");
}
