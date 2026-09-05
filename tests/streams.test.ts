import { describe, it, expect } from "vitest";
import { normaliseStreamUrl, parseStream, showStream } from "@/lib/streams";

/**
 * The field is typed in by an admin — including EDITOR, the lower-trust role —
 * and lands directly in an <a href>.
 */
describe("normaliseStreamUrl", () => {
  it("accepts http and https", () => {
    expect(normaliseStreamUrl("https://www.twitch.tv/blast")).toBe("https://www.twitch.tv/blast");
    expect(normaliseStreamUrl("  https://youtu.be/abc  ")).toBe("https://youtu.be/abc");
  });

  it("rejects script-bearing and non-web schemes", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd"]) {
      expect(normaliseStreamUrl(bad), bad).toBeNull();
    }
  });

  it("rejects anything that is not a URL at all", () => {
    for (const bad of ["blast", "", "   ", null, undefined]) {
      expect(normaliseStreamUrl(bad)).toBeNull();
    }
  });
});

describe("parseStream", () => {
  it("names the platform, including on subdomains", () => {
    expect(parseStream("https://www.twitch.tv/blast")?.platform).toBe("twitch");
    expect(parseStream("https://youtube.com/watch?v=x")?.platform).toBe("youtube");
    expect(parseStream("https://youtu.be/x")?.platform).toBe("youtube");
    expect(parseStream("https://kick.com/blast")?.platform).toBe("kick");
    expect(parseStream("https://blast.tv/live")?.platform).toBe("other");
  });

  /**
   * A channel link only means something while the stream is running: after the
   * match, twitch.tv/blast shows whatever is live NOW — a different match. A
   * link to a specific video keeps pointing at the same thing forever.
   */
  it("separates permanent video links from channel links", () => {
    expect(parseStream("https://www.youtube.com/watch?v=abc")?.permanent).toBe(true);
    expect(parseStream("https://youtu.be/abc")?.permanent).toBe(true);
    expect(parseStream("https://www.twitch.tv/videos/998877")?.permanent).toBe(true);

    expect(parseStream("https://www.youtube.com/@BLASTPremier/live")?.permanent).toBe(false);
    expect(parseStream("https://www.twitch.tv/blastpremier")?.permanent).toBe(false);
    expect(parseStream("https://kick.com/blast")?.permanent).toBe(false);
  });
});

describe("showStream", () => {
  const channel = parseStream("https://www.twitch.tv/blastpremier");
  const video = parseStream("https://www.youtube.com/watch?v=abc");

  it("shows a channel link before and during the match", () => {
    expect(showStream(channel, "UPCOMING")).toBe(true);
    expect(showStream(channel, "LIVE")).toBe(true);
  });

  it("hides a channel link once the match is over", () => {
    expect(showStream(channel, "FINISHED")).toBe(false);
  });

  it("keeps a video link as the replay", () => {
    expect(showStream(video, "FINISHED")).toBe(true);
  });

  it("shows nothing for a cancelled or postponed match, or with no link", () => {
    expect(showStream(channel, "CANCELLED")).toBe(false);
    expect(showStream(channel, "POSTPONED")).toBe(false);
    expect(showStream(null, "LIVE")).toBe(false);
  });
});
