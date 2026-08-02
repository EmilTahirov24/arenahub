import crypto from "crypto";

const VERIFY_TOKEN_EXPIRY_HOURS = 48;
const RESEND_RATE_LIMIT_MINUTES = 5;
export const RESEND_RATE_LIMIT_SECONDS = RESEND_RATE_LIMIT_MINUTES * 60;

export function generateVerifyToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function verifyTokenExpiry() {
  return new Date(Date.now() + VERIFY_TOKEN_EXPIRY_HOURS * 60 * 60_000);
}

export function isVerifyTokenValid(user: { verifyToken: string | null; verifyTokenExpiry: Date | null }, token: string) {
  return (
    !!user.verifyToken && user.verifyToken === token && !!user.verifyTokenExpiry && user.verifyTokenExpiry > new Date()
  );
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
