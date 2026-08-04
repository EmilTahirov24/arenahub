import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { AdminRole } from "@/app/generated/prisma/client";

const COOKIE_NAME = "session";

/**
 * Unset, this used to encode to a zero-length key, which WebCrypto rejects deep
 * inside jose with a bare `DataError` — every login and signup 500s and nothing
 * says why. Fail at the first use with the actual problem instead.
 */
function sessionSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    throw new Error("AUTH_SECRET təyin edilməyib — sessiya imzalana bilmir. Mühit dəyişənlərini yoxlayın.");
  }
  return new TextEncoder().encode(value);
}

export type SessionPayload =
  | { kind: "admin"; id: string; role: AdminRole; issuedAt?: Date }
  | { kind: "player"; id: string; issuedAt?: Date };

export async function createSession(payload: SessionPayload) {
  // `issuedAt` is carried by the JWT's own `iat` claim, not the body.
  const { issuedAt: _ignored, ...claims } = payload;
  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(sessionSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    const issuedAt = payload.iat ? new Date(payload.iat * 1000) : undefined;
    if (payload.kind === "admin") {
      return { kind: "admin", id: payload.id as string, role: payload.role as AdminRole, issuedAt };
    }
    if (payload.kind === "player") {
      return { kind: "player", id: payload.id as string, issuedAt };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Re-reads the admin from the database on every check rather than trusting the
 * 30-day cookie. Without this a deleted admin keeps full access until the token
 * expires, and a demoted SUPER_ADMIN keeps the old role baked into their JWT.
 * The role returned here is always the current one.
 */
export async function getAdminSession() {
  const session = await getSession();
  if (session?.kind !== "admin") return null;

  const { prisma } = await import("@/lib/prisma");
  const admin = await prisma.adminUser.findUnique({ where: { id: session.id }, select: { id: true, role: true } });
  if (!admin) return null;

  return { kind: "admin" as const, id: admin.id, role: admin.role };
}

/**
 * The player behind the cookie, or null.
 *
 * Re-reads the row on every check rather than trusting the 30-day token, so a
 * deleted account loses access at once — and, since these are stateless JWTs
 * with no server-side session table, checks the issue time against
 * `sessionsValidAfter`. That column is stamped when the password is reset, and
 * it is the only thing standing between a stolen cookie and a month of access
 * after the owner has already locked them out.
 */
export async function getPlayerSession() {
  const session = await getSession();
  if (session?.kind !== "player") return null;

  const { prisma } = await import("@/lib/prisma");
  const player = await prisma.player.findUnique({
    where: { id: session.id },
    select: { id: true, sessionsValidAfter: true },
  });
  if (!player) return null;

  if (player.sessionsValidAfter && (!session.issuedAt || session.issuedAt < player.sessionsValidAfter)) {
    return null;
  }

  return session;
}
