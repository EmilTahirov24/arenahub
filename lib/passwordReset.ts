import crypto from "crypto";

export const RESET_TOKEN_EXPIRY_MINUTES = 60;
const REQUEST_RATE_LIMIT_MINUTES = 15;

export function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function resetTokenExpiry() {
  return new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60_000);
}

export function isResetTokenValid(user: { resetToken: string | null; resetTokenExpiry: Date | null }, token: string) {
  return !!user.resetToken && user.resetToken === token && !!user.resetTokenExpiry && user.resetTokenExpiry > new Date();
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
