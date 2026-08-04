import { generateToken, hashToken, tokensMatch } from "@/lib/tokens";

const VERIFY_TOKEN_EXPIRY_HOURS = 48;
const RESEND_RATE_LIMIT_MINUTES = 5;
export const RESEND_RATE_LIMIT_SECONDS = RESEND_RATE_LIMIT_MINUTES * 60;

/**
 * The raw half goes in the email link, the hashed half into the database — see
 * lib/tokens.ts for why. They are returned together so a caller cannot store
 * the wrong one by accident.
 */
export function createVerifyToken() {
  const raw = generateToken();
  return { raw, hash: hashToken(raw), expiresAt: verifyTokenExpiry() };
}

export function verifyTokenExpiry() {
  return new Date(Date.now() + VERIFY_TOKEN_EXPIRY_HOURS * 60 * 60_000);
}

/** Look a pending verification up by the token from the link. */
export function verifyTokenLookup(raw: string) {
  return hashToken(raw);
}

export function isVerifyTokenValid(
  user: { verifyToken: string | null; verifyTokenExpiry: Date | null },
  rawToken: string,
) {
  return tokensMatch(user.verifyToken, rawToken) && !!user.verifyTokenExpiry && user.verifyTokenExpiry > new Date();
}

export function wasVerifyEmailSentRecently(user: { verifyTokenExpiry: Date | null }) {
  return resendAvailableInSeconds(user) > 0;
}

/** Seconds until the resend button should re-enable; 0 if it's available now. */
export function resendAvailableInSeconds(user: { verifyTokenExpiry: Date | null }): number {
  if (!user.verifyTokenExpiry) return 0;
  const issuedAt = user.verifyTokenExpiry.getTime() - VERIFY_TOKEN_EXPIRY_HOURS * 60 * 60_000;
  const availableAt = issuedAt + RESEND_RATE_LIMIT_MINUTES * 60_000;
  return Math.max(0, Math.ceil((availableAt - Date.now()) / 1000));
}
