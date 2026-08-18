import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Request, Response } from "express";
import type { User } from "../drizzle/schema";
import {
  createSessionRecord,
  getSessionUserByTokenHash,
  removeSessionRecord,
  touchUserSignIn,
} from "./db";

export const APP_SESSION_COOKIE = "casal_clean_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;

export function verifyPassword(password: string, passwordHash: string | null) {
  if (!passwordHash) return false;
  const [salt, expectedHash] = passwordHash.split(":");
  if (!salt || !expectedHash) return false;
  const candidate = scryptSync(password, salt, 64).toString("hex");
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(candidate, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getCookieOptions(req: Request) {
  const forwardedProtocol = req.headers["x-forwarded-proto"];
  const isHttps = req.protocol === "https" || forwardedProtocol === "https";
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || isHttps,
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function createUserSession(req: Request, res: Response, userId: number) {
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await createSessionRecord(getTokenHash(token), userId, expiresAt);
  await touchUserSignIn(userId);
  res.cookie(APP_SESSION_COOKIE, token, {
    ...getCookieOptions(req),
    maxAge: SESSION_DURATION_MS,
  });
}

export async function clearUserSession(req: Request, res: Response) {
  const token = parseCookieHeader(req.headers.cookie ?? "")[APP_SESSION_COOKIE];
  if (token) await removeSessionRecord(getTokenHash(token));
  res.clearCookie(APP_SESSION_COOKIE, getCookieOptions(req));
}

export async function getAuthenticatedUser(req: Request): Promise<User | null> {
  const token = parseCookieHeader(req.headers.cookie ?? "")[APP_SESSION_COOKIE];
  if (!token) return null;
  const session = await getSessionUserByTokenHash(getTokenHash(token));
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return session.user;
}

export function sanitizeUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}
