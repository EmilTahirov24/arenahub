import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { AdminRole } from "@/app/generated/prisma/client";

const COOKIE_NAME = "session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

export type SessionPayload = { kind: "admin"; id: string; role: AdminRole } | { kind: "player"; id: string };

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

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
    const { payload } = await jwtVerify(token, secret);
    if (payload.kind === "admin") {
      return { kind: "admin", id: payload.id as string, role: payload.role as AdminRole };
    }
    if (payload.kind === "player") {
      return { kind: "player", id: payload.id as string };
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

export async function getPlayerSession() {
  const session = await getSession();
  if (session?.kind !== "player") return null;

  const { prisma } = await import("@/lib/prisma");
  const player = await prisma.player.findUnique({ where: { id: session.id }, select: { id: true } });
  if (!player) return null;

  return session;
}
