-- Sessions issued before this instant are refused.
--
-- Session cookies are stateless 30-day JWTs with no server-side record, so
-- until now a stolen cookie kept working after the owner reset their password.
-- The password reset sets this column, and lib/auth.ts compares it against the
-- token's issued-at claim.
ALTER TABLE "Player" ADD COLUMN "sessionsValidAfter" TIMESTAMP(3);

-- Verification and reset tokens are now stored as SHA-256 hashes rather than
-- the exact secret that was mailed out. Existing rows still hold plaintext, and
-- there is no way to convert them — hashing is one-way and the raw value is the
-- thing we no longer keep. They are cleared instead: those links stop working,
-- which is correct, and the affected users simply request a new one. Both token
-- types are short-lived anyway (48 hours and 60 minutes).
UPDATE "Player"
SET "verifyToken" = NULL,
    "verifyTokenExpiry" = NULL,
    "resetToken" = NULL,
    "resetTokenExpiry" = NULL
WHERE "verifyToken" IS NOT NULL OR "resetToken" IS NOT NULL;
