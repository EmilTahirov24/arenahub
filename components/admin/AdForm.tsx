import ImageUpload from "@/components/forms/ImageUpload";
import { todayInputValue } from "@/lib/today";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/formStyles";
import type { AdBanner, AdPlacement } from "@/app/generated/prisma/client";

const PLACEMENTS: { value: AdPlacement; label: string }[] = [
  { value: "SIDEBAR_LEFT", label: "Sol sidebar" },
  { value: "SIDEBAR_RIGHT_TOP", label: "Sağ sidebar (yuxarı)" },
  { value: "SIDEBAR_RIGHT_BOTTOM", label: "Sağ sidebar (aşağı)" },
  { value: "IN_CONTENT", label: "Kontent içi" },
  { value: "MATCH_PAGE_TOP", label: "Matç səhifəsi yuxarı" },
];

function toDateInputValue(date?: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export default async function AdForm({
  ad,
  action,
}: {
  ad?: AdBanner;
  action: (formData: FormData) => Promise<void>;
}) {
  const today = await todayInputValue();

  return (
    <form action={action} className="max-w-lg space-y-4">
      <div>
        <label className={labelClass}>Ad</label>
        <input name="name" required defaultValue={ad?.name} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Yer</label>
        <select name="placement" defaultValue={ad?.placement ?? "SIDEBAR_RIGHT_TOP"} className={inputClass}>
          {PLACEMENTS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <ImageUpload name="imageUrl" label="Şəkil" defaultValue={ad?.imageUrl} />
      <div>
        <label className={labelClass}>Keçid linki</label>
        <input name="linkUrl" type="url" required defaultValue={ad?.linkUrl} className={inputClass} placeholder="https://" />
      </div>
      <div>
        <label className={labelClass}>Alt mətn</label>
        <input name="altText" defaultValue={ad?.altText ?? ""} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Başlama tarixi</label>
          <input
            name="startDate"
            type="date"
            required
            defaultValue={toDateInputValue(ad?.startDate) || today}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Bitmə tarixi</label>
          <input name="endDate" type="date" defaultValue={toDateInputValue(ad?.endDate)} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Çəki (rotasiya üçün)</label>
        <input name="weight" type="number" min={1} defaultValue={ad?.weight ?? 1} className={inputClass} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={ad?.isActive ?? true} />
        Aktiv
      </label>
      <button type="submit" className={primaryButtonClass}>
        Yadda saxla
      </button>
    </form>
  );
}
