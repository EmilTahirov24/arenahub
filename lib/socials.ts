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

/**
 * Also reports what it threw away.
 *
 * A link that fails the pattern used to vanish without a word: the form said
 * nothing, the field came back empty on the next load, and the only way to find
 * out was to notice the absence. Callers that can show a message should use
 * this and tell the person which link was not accepted.
 */
export function socialsFromFormDataChecked(formData: FormData): {
  socials: PlayerSocials;
  rejected: string[];
} {
  const rejected: string[] = [];

  const clean = (key: keyof PlayerSocials) => {
    const raw = formData.get(`social_${key}`);
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const pattern = new RegExp(`^${SOCIAL_META[key].patternSource}$`, "i");
    if (pattern.test(trimmed)) return trimmed;
    rejected.push(SOCIAL_META[key].label);
    return undefined;
  };

  return {
    socials: {
      instagram: clean("instagram"),
      twitter: clean("twitter"),
      faceit: clean("faceit"),
      twitch: clean("twitch"),
    },
    rejected,
  };
}

export function socialsFromFormData(formData: FormData): PlayerSocials {
  return socialsFromFormDataChecked(formData).socials;
}
