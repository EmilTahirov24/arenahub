const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export function isLocked(user: { lockUntil: Date | null }): boolean {
  return !!user.lockUntil && user.lockUntil > new Date();
}

export function lockoutMinutesLeft(user: { lockUntil: Date | null }): number {
  if (!user.lockUntil) return 0;
  return Math.max(1, Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000));
}

export function nextFailedAttemptState(currentAttempts: number): {
  failedLoginAttempts: number;
  lockUntil: Date | null;
} {
  const attempts = currentAttempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    return { failedLoginAttempts: 0, lockUntil: new Date(Date.now() + LOCK_MINUTES * 60000) };
  }
  return { failedLoginAttempts: attempts, lockUntil: null };
}

export function lockoutErrorMessage(minutesLeft: number, locale: "az" | "en" = "az") {
  return locale === "az"
    ? `Çox sayda yanlış cəhd. ${minutesLeft} dəqiqə sonra yenidən cəhd edin.`
    : `Too many failed attempts. Try again in ${minutesLeft} minute(s).`;
}
