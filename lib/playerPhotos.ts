import photos from "@/data/player-photos.json";

/**
 * Credit for a player photograph, or null when we did not supply the picture.
 *
 * CC BY and CC BY-SA — every licence in `data/player-photos.json` — REQUIRE the
 * author to be named wherever the work is used. That is a condition of the
 * licence, not a courtesy, which is why the credit is rendered from the same
 * file the download script reads rather than typed in beside the image.
 *
 * A photo a player uploaded themselves is their own and has no entry here; the
 * lookup is by the file path, so a blob-storage URL simply returns null.
 */
export type PhotoCredit = {
  nickname: string;
  file: string;
  license: string;
  author: string;
  source: string;
  checked: string;
};

const BY_SLUG = photos as Record<string, PhotoCredit>;

export function photoCredit(photoUrl: string | null | undefined): PhotoCredit | null {
  if (!photoUrl?.startsWith("/players/")) return null;
  const slug = photoUrl.slice("/players/".length).replace(/\.jpg$/, "");
  return BY_SLUG[slug] ?? null;
}

/** Every credit, for the /credits page. Sorted by the name a reader would look for. */
export function allPhotoCredits(): PhotoCredit[] {
  return Object.values(BY_SLUG).sort((a, b) =>
    a.nickname.localeCompare(b.nickname, undefined, { sensitivity: "base" }),
  );
}

/**
 * True when the licence obliges the crop to carry the same licence.
 *
 * Kəsmə törəmə əsərdir. CC BY-SA-da törəmə əsər eyni lisenziya altında
 * yayılmalıdır, ona görə həmin şəkillər ayrıca işarələnir.
 */
export function isShareAlike(license: string): boolean {
  return /-sa\b/i.test(license.replace(/\s+/g, "-"));
}
