import { generateToken, hashToken, tokensMatch } from "@/lib/tokens";

export const RESET_TOKEN_EXPIRY_MINUTES = 60;
const REQUEST_RATE_LIMIT_MINUTES = 15;

/**
 * The raw half goes in the email link, the hashed half into the database — see
 * lib/tokens.ts. A reset link is a full account takeover, so the stored copy
 * must not be usable on its own.
 */
export function createResetToken() {
  const raw = generateToken();
  return { raw, hash: hashToken(raw), expiresAt: resetTokenExpiry() };
}

export function resetTokenExpiry() {
  return new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60_000);
}

/** Look a pending reset up by the token from the link. */
export function resetTokenLookup(raw: string) {
  return hashToken(raw);
}

export function isResetTokenValid(
  user: { resetToken: string | null; resetTokenExpiry: Date | null },
  rawToken: string,
) {
  return tokensMatch(user.resetToken, rawToken) && !!user.resetTokenExpiry && user.resetTokenExpiry > new Date();
}

/**
 * resetTokenExpiry is always issuedAt + RESET_TOKEN_EXPIRY_MINUTES, so the
 * issue time can be derived from it without a dedicated "last requested at"
 * column. Blocks repeated reset requests without needing a migration.
 */
export function wasResetRequestedRecently(user: { resetTokenExpiry: Date | null }) {
  if (!user.resetTokenExpiry) return false;
  const issuedAt = user.resetTokenExpiry.getTime() - RESET_TOKEN_EXPIRY_MINUTES * 60_000;
  return issuedAt > Date.now() - REQUEST_RATE_LIMIT_MINUTES * 60_000;
}
