import { inputClass, labelClass } from "@/components/admin/formStyles";
import { SOCIAL_META, type PlayerSocials } from "@/lib/socials";

export default function SocialInputs({ socials }: { socials: PlayerSocials }) {
  return (
    <div>
      {/* Qrup başlığı. Ayrı-ayrı sahələrin adı aşağıda aria-label ilə verilir:
          burada görünən etiket yoxdur, yalnız placeholder var, o isə etiket
          yerinə keçmir — yazmağa başlayan kimi itir və ekran oxuyucusunda
          etibarlı deyil. */}
      <p className={labelClass}>Sosial linklər (istəyə bağlı)</p>
      <div className="space-y-2">
        {(Object.keys(SOCIAL_META) as (keyof PlayerSocials)[]).map((key) => {
          const meta = SOCIAL_META[key];
          return (
            <input
              key={key}
              name={`social_${key}`}
              aria-label={`${meta.label} linki`}
              type="url"
              defaultValue={socials[key] ?? ""}
              placeholder={meta.placeholder}
              pattern={meta.patternSource}
              title={`${meta.label} linki "${meta.placeholder}" formatında olmalıdır`}
              className={inputClass}
            />
          );
        })}
      </div>
    </div>
  );
}
