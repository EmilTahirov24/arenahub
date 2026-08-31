/**
 * Canlı yayım linklərini oxuyan tək yer.
 *
 * Link Liquipedia-dan GƏLMİR və gələ də bilməz. Ölçüldü (2026-09-01): onların
 * matç lentində yayım düymələri var, amma ünvan `Special:Stream/twitch/ESL_
 * Counter-Strike` şəklindədir — bu, Twitch kanalının adı deyil, onların öz
 * daxili açarıdır (Twitch adında defis ola bilmir). Açarı yalnız onların
 * bazası açır, həmin səhifə isə bizə 403 qaytarır — nə skriptə, nə brauzerə.
 * Yəni linki uydurmaq olar, düzəltmək olmaz. Ona görə linki admin yazır.
 *
 * Buradakı iki qayda mühümdür:
 *
 *  1. Yalnız http/https qəbul olunur. Sahə birbaşa `<a href>`-ə düşür və
 *     panelə EDITOR rolu da girə bilir.
 *  2. Kanal linki ilə video linki fərqləndirilir. Kanal linki yalnız yayım
 *     gedərkən doğrudur: matç bitəndən sonra `twitch.tv/blast` həmin an nə
 *     yayımlanırsa ona aparır — yəni bitmiş matçın səhifəsindəki «İzlə»
 *     düyməsi başqa bir matça aparır. YouTube video linki isə qalıcıdır.
 */

export type StreamPlatform = "youtube" | "twitch" | "kick" | "other";

export type StreamInfo = {
  url: string;
  platform: StreamPlatform;
  /** Ekranda göstərilən ad — «YouTube», «Twitch»… */
  label: string;
  /**
   * Link matç bitəndən sonra da doğru qalırmı?
   *
   * Konkret videoya işarə edən link qalıcıdır; kanala işarə edən link yox.
   */
  permanent: boolean;
};

const LABELS: Record<StreamPlatform, string> = {
  youtube: "YouTube",
  twitch: "Twitch",
  kick: "Kick",
  other: "Yayım",
};

/** Host-un həmin domenə (və ya alt-domeninə) aid olması. */
function hostIs(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Ünvanı təhlükəsiz URL-ə çevirir, ya da null.
 *
 * `javascript:` və `data:` kimi sxemlər açıq şəkildə kənarlaşdırılır — sahə
 * `<a href>`-ə düşür və linki yazan super-admin olmaya bilər.
 */
export function normaliseStreamUrl(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.toString();
}

export function parseStream(raw: string | null | undefined): StreamInfo | null {
  const url = normaliseStreamUrl(raw);
  if (!url) return null;

  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

  let platform: StreamPlatform = "other";
  let permanent = false;

  if (hostIs(host, "youtube.com") || host === "youtu.be") {
    platform = "youtube";
    // Konkret video: youtu.be/ID və ya youtube.com/watch?v=ID.
    // Kanal və ya /live isə həmin an nə yayımlanırsa onu göstərir.
    permanent = host === "youtu.be" ? parsed.pathname.length > 1 : parsed.searchParams.has("v");
  } else if (hostIs(host, "twitch.tv")) {
    platform = "twitch";
    // twitch.tv/videos/123 arxivdir; twitch.tv/kanal yalnız canlıdır.
    permanent = parsed.pathname.startsWith("/videos/");
  } else if (hostIs(host, "kick.com")) {
    platform = "kick";
    permanent = parsed.pathname.includes("/videos/");
  }

  return { url, platform, label: LABELS[platform], permanent };
}

/**
 * Bu link həmin statusda göstərilməlidirmi?
 *
 * Bitmiş matçda kanal linki səhv hekayə danışır — ona görə yalnız qalıcı link
 * qalır. Ləğv olunmuş və təxirə salınmış matçda yayım linki mənasızdır.
 */
export function showStream(stream: StreamInfo | null, status: string): boolean {
  if (!stream) return false;
  if (status === "LIVE" || status === "UPCOMING") return true;
  if (status === "FINISHED") return stream.permanent;
  return false;
}
