/**
 * Matçın vaciblik reytinqi.
 *
 * Defolt qiymət (1) HEÇ NƏ göstərmir. Səbəb ölçüldü: production-dakı 2359
 * matçın 100%-i 1 ulduz idi, çünki dəyəri yalnız admin əl ilə qoya bilir və
 * idxal ona toxunmur. Yəni hər kartda eyni beş işarə görünürdü — sıfır məlumat,
 * amma kartın sağ yuxarı küncü tutulurdu.
 *
 * Belə olanda ulduz həqiqi siqnala çevrilir: göründüsə, deməli kimsə bu matçı
 * qəsdən önə çıxarıb. Qayda komponentin özündədir ki, bütün istifadə yerlərində
 * eyni işləsin.
 *
 * Admin paneli reytinqi ayrıca <select> ilə təyin edir, bu komponentlə yox —
 * yəni idarəedici gizlənmir.
 */
export default function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  if (value <= 1) return null;

  return (
    <div className="flex items-center gap-0.5" aria-label={`${value}/${max} stars`}>
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`h-3 w-3 ${i < value ? "fill-brand-via" : "fill-border-subtle"}`}
        >
          <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z" />
        </svg>
      ))}
    </div>
  );
}
