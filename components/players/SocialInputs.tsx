import { inputClass, labelClass } from "@/components/admin/formStyles";
import { SOCIAL_META, type PlayerSocials } from "@/lib/socials";

export default function SocialInputs({ socials }: { socials: PlayerSocials }) {
  return (
    <div>
      <p className={labelClass}>Sosial linklər (istəyə bağlı)</p>
      <div className="space-y-2">
        {(Object.keys(SOCIAL_META) as (keyof PlayerSocials)[]).map((key) => {
          const meta = SOCIAL_META[key];
          return (
            <input
              key={key}
              name={`social_${key}`}
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
