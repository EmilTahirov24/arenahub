import crypto from "crypto";

/**
 * Single-use secrets that travel by email: verification and password reset.
 *
 * The raw value goes in the link; only its SHA-256 hash is stored. Anyone who
 * can read the database — a leaked backup, a replica, a read-only analytics
 * account — would otherwise hold every pending reset link in usable form, and a
 * reset link is a full account takeover.
 *
 * SHA-256 with no salt or stretching is the right choice here, unlike for
 * passwords: the input is already 256 bits of `randomBytes`, so there is
 * nothing to brute-force and nothing to rainbow-table. Salting would only break
 * the ability to look the row up by hash.
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Length-independent comparison. Both sides are fixed-length hex here, so this
 * is belt-and-braces rather than strictly necessary — but the moment someone
 * compares a raw token with `===` this is the helper they should reach for.
 */
export function tokensMatch(storedHash: string | null, raw: string): boolean {
  if (!storedHash) return false;
  const a = Buffer.from(storedHash);
  const b = Buffer.from(hashToken(raw));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
