import { describe, it, expect } from "vitest";
import { SITE_TIME_ZONE, toDateKey, isDateKey, dayRange, siteFormat } from "@/lib/dates";

/**
 * The worst bug this project shipped: date formatting ran in the server's zone,
 * which on Vercel is UTC, so a match starting 13:00 in Baku was published as
 * 09:00 — four hours early, silently, for everyone. These tests pin the fix.
 */
describe("site timezone", () => {
  it("is Baku, not the server's zone", () => {
    expect(SITE_TIME_ZONE).toBe("Asia/Baku");
  });

  it("formats an instant in Baku time, not UTC", () => {
    const noonUtc = new Date("2026-08-29T09:00:00.000Z");
    const shown = siteFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(noonUtc);
    expect(shown).toBe("13:00");
  });
});

describe("toDateKey", () => {
  it("uses the Baku day, so late-evening UTC is already tomorrow", () => {
    // 21:30 UTC is 01:30 the next day in Baku (+04:00).
    expect(toDateKey(new Date("2026-08-29T21:30:00.000Z"))).toBe("2026-08-30");
  });

  it("keeps the same day just after Baku midnight", () => {
    expect(toDateKey(new Date("2026-08-29T20:00:00.000Z"))).toBe("2026-08-30");
    expect(toDateKey(new Date("2026-08-29T19:59:00.000Z"))).toBe("2026-08-29");
  });
});

/**
 * `?date=` is public input. Without validation `?date=abc` reached Prisma as an
 * Invalid Date and threw inside the streamed part of the page — a 200 shell
 * with a broken list. It also gave every junk value its own cache entry.
 */
describe("isDateKey", () => {
  it("accepts a real day", () => {
    expect(isDateKey("2026-08-29")).toBe(true);
  });

  it("rejects junk, empty and undefined", () => {
    for (const bad of ["abc", "", "2026-8-9", "29-08-2026", undefined]) {
      expect(isDateKey(bad)).toBe(false);
    }
  });

  it("rejects a day that does not exist instead of silently sliding to March", () => {
    // JS turns 2026-02-31 into 2026-03-03 without complaining.
    expect(isDateKey("2026-02-31")).toBe(false);
  });
});

describe("dayRange", () => {
  it("spans one Baku day, not one UTC day", () => {
    const { start, end } = dayRange("2026-08-29");
    expect(start.toISOString()).toBe("2026-08-28T20:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-29T19:59:59.999Z");
  });

  it("covers a match played just after midnight in Baku", () => {
    const { start, end } = dayRange("2026-08-29");
    const lateNightInBaku = new Date("2026-08-28T21:00:00.000Z"); // 01:00, 29 Aug in Baku
    expect(lateNightInBaku >= start && lateNightInBaku <= end).toBe(true);
  });
});
