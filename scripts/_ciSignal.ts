import fs from "node:fs";

/**
 * CI-yə "reytinq köhnəldi" siqnalı.
 *
 * İş axını reytinq yenidən hesablanmasını yalnız bu siqnal gələndə işlədir.
 * Səbəb ölçüldü: `recompute-ratings.ts` bütün bitmiş matçların Elo tarixçəsini
 * yenidən oynadır və qaçışın 28–58%-ni tutur — iki ardıcıl qaçışda 108 və 278
 * saniyə. Matç sayı artdıqca yalnız uzanır. İdxal heç nə yazmayıbsa reytinq də
 * dəyişə bilməz, yəni həmin vaxt tam israfdır.
 *
 * DİQQƏT: sayğac yazılan sətir sayı DEYİL. İlk variantda elə idi və səhv idi:
 * bilet hər qaçışda ~260 matç qaytarır və hamısı yenidən yazılır, yəni siqnal
 * həmişə gedirdi və qənaət heç vaxt baş vermirdi. İndi yalnız reytinqə təsir
 * edən dəyişiklik sayılır — matçın statusu və ya qalibi.
 *
 * `GITHUB_OUTPUT` yoxdursa funksiya heç nə etmir — lokal qaçışa təsiri sıfırdır.
 * Skriptlərə məxsusdur və qəsdən `lib/`-ə qoyulmayıb: ora Next tətbiqi idxal
 * edir, CI detalının orada yeri yoxdur.
 */
export function signalRatingsStale(changed: number): void {
  const out = process.env.GITHUB_OUTPUT;
  if (!out || changed <= 0) return;
  fs.appendFileSync(out, "ratings_stale=true\n");
}
