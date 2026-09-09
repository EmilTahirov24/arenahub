/**
 * The one place that understands stream links.
 *
 * The link does NOT come from Liquipedia, and cannot. Measured on 2026-09-01:
 * their match ticker does carry stream buttons, but the address is of the form
 * `Special:Stream/twitch/ESL_Counter-Strike` — which is not a Twitch channel
 * name (a Twitch name cannot contain a hyphen) but their own internal key.
 * Only their database resolves it, and that page returns 403 to us, to a script
 * and to a real browser alike. The link could be invented; it could not be
 * derived. So an admin enters it.
 *
 * Two rules here carry the weight:
 *
 *  1. Only http and https are accepted. The field goes straight into an
 *     `<a href>`, and the panel is reachable by the EDITOR role too.
 *  2. A channel link is distinguished from a video link. A channel link is only
 *     true while the stream is running: once the match is over,
 *     `twitch.tv/blast` points at whatever is live at that moment — so a
 *     "watch" button on yesterday's match sends the reader to a different one.
 *     A YouTube video link stays true.
 */

export type StreamPlatform = "youtube" | "twitch" | "kick" | "other";

export type StreamInfo = {
  url: string;
  platform: StreamPlatform;
  /** The name shown on screen — "YouTube", "Twitch"… */
  label: string;
  /**
   * Does the link stay true after the match ends?
   *
   * A link to a specific video does; a link to a channel does not.
   */
  permanent: boolean;
};

const LABELS: Record<StreamPlatform, string> = {
  youtube: "YouTube",
  twitch: "Twitch",
  kick: "Kick",
  other: "Stream",
};

/** Whether the host is that domain, or a subdomain of it. */
function hostIs(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Turns the input into a safe URL, or null.
 *
 * Schemes such as `javascript:` and `data:` are rejected outright: the value
 * ends up in an `<a href>`, and whoever typed it need not be a super admin.
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
    // A specific video: youtu.be/ID or youtube.com/watch?v=ID.
    // A channel, or /live, shows whatever happens to be on at the time.
    permanent = host === "youtu.be" ? parsed.pathname.length > 1 : parsed.searchParams.has("v");
  } else if (hostIs(host, "twitch.tv")) {
    platform = "twitch";
    // twitch.tv/videos/123 is an archive; twitch.tv/channel is live only.
    permanent = parsed.pathname.startsWith("/videos/");
  } else if (hostIs(host, "kick.com")) {
    platform = "kick";
    permanent = parsed.pathname.includes("/videos/");
  }

  return { url, platform, label: LABELS[platform], permanent };
}

/**
 * Should this link be shown at this status?
 *
 * On a finished match a channel link tells the wrong story, so only a permanent
 * link survives. On a cancelled or postponed match a stream link means nothing
 * at all.
 */
export function showStream(stream: StreamInfo | null, status: string): boolean {
  if (!stream) return false;
  if (status === "LIVE" || status === "UPCOMING") return true;
  if (status === "FINISHED") return stream.permanent;
  return false;
}
