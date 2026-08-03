export type PlayerSocials = {
  instagram?: string;
  twitter?: string;
  faceit?: string;
  twitch?: string;
};

// Single source of truth for both the HTML `pattern` attribute (client-side,
// gives an immediate native validation message) and the server-side check
// below (defense in depth — a form's `pattern` can be bypassed).
export const SOCIAL_META: Record<keyof PlayerSocials, { label: string; placeholder: string; patternSource: string }> = {
  instagram: {
    label: "Instagram",
    placeholder: "https://instagram.com/istifadeci_adi",
    patternSource: "https?://(www\\.)?instagram\\.com/.+",
  },
  twitter: {
    label: "X / Twitter",
    placeholder: "https://x.com/istifadeci_adi",
    patternSource: "https?://(www\\.)?(x|twitter)\\.com/.+",
  },
  faceit: {
    label: "Faceit",
    placeholder: "https://www.faceit.com/en/players/nickname",
    patternSource: "https?://(www\\.)?faceit\\.com/.+",
  },
  twitch: {
    label: "Twitch",
    placeholder: "https://twitch.tv/istifadeci_adi",
    patternSource: "https?://(www\\.)?twitch\\.tv/.+",
  },
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
  const clean = (key: keyof PlayerSocials) => {
    const raw = formData.get(`social_${key}`);
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const pattern = new RegExp(`^${SOCIAL_META[key].patternSource}$`, "i");
    return pattern.test(trimmed) ? trimmed : undefined;
  };
  return {
    instagram: clean("instagram"),
    twitter: clean("twitter"),
    faceit: clean("faceit"),
    twitch: clean("twitch"),
  };
}
