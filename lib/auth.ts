import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { AdminRole } from "@/app/generated/prisma/client";

const COOKIE_NAME = "session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

export type SessionPayload =
  | { kind: "admin"; id: string; role: AdminRole }
  | { kind: "team"; id: string }
  | { kind: "player"; id: string }
  | { kind: "fan"; id: string };

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
    if (payload.kind === "team") {
      return { kind: "team", id: payload.id as string };
    }
    if (payload.kind === "player") {
      return { kind: "player", id: payload.id as string };
    }
    if (payload.kind === "fan") {
      return { kind: "fan", id: payload.id as string };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getAdminSession() {
  const session = await getSession();
  return session?.kind === "admin" ? session : null;
}

export async function getTeamSession() {
  const session = await getSession();
  return session?.kind === "team" ? session : null;
}

export async function getPlayerSession() {
  const session = await getSession();
  return session?.kind === "player" ? session : null;
}

export async function getFanSession() {
  const session = await getSession();
  return session?.kind === "fan" ? session : null;
}
