export type PlayerSocials = {
  instagram?: string;
  twitter?: string;
  faceit?: string;
  twitch?: string;
};

export function parseSocials(value: unknown): PlayerSocials {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const pick = (key: string) => (typeof v[key] === "string" && v[key] ? (v[key] as string) : undefined);
  return {
    instagram: pick("instagram"),
    twitter: pick("twitter"),
    faceit: pick("faceit"),
    twitch: pick("twitch"),
  };
}

export function socialsFromFormData(formData: FormData): PlayerSocials {
  const clean = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    instagram: clean(formData.get("social_instagram")),
    twitter: clean(formData.get("social_twitter")),
    faceit: clean(formData.get("social_faceit")),
    twitch: clean(formData.get("social_twitch")),
  };
}
