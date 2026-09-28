import { createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const GUEST_COOKIE = "commonroom_guest";
const GUEST_DAYS = 365;
const guestSelect = {
  id: true,
  username: true,
  name: true,
  bio: true,
  avatarUrl: true,
} as const;

function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readGuestToken(request: NextRequest): string | null {
  const token = request.cookies.get(GUEST_COOKIE)?.value;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export async function getGuest(request: NextRequest) {
  const token = readGuestToken(request);
  if (!token) return null;
  const session = await prisma.guestSession.findUnique({
    where: { tokenHash: hashGuestToken(token) },
    include: { user: { select: guestSelect } },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
}

export async function ensureGuest(request: NextRequest) {
  const token = readGuestToken(request);
  if (token) {
    const session = await prisma.guestSession.findUnique({
      where: { tokenHash: hashGuestToken(token) },
      include: { user: { select: guestSelect } },
    });
    if (session && session.expiresAt > new Date()) return { user: session.user, token: null, expiresAt: null };
    if (session) {
      await prisma.guestSession.delete({ where: { id: session.id } });
    }
  }

  const guestToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + GUEST_DAYS * 24 * 60 * 60 * 1000);
  const user = await prisma.$transaction(async (transaction) => {
    const guest = await transaction.user.create({
      data: {
        username: `guest_${randomBytes(8).toString("hex")}`,
        name: `Guest ${randomBytes(2).toString("hex").toUpperCase()}`,
      },
      select: guestSelect,
    });
    await transaction.guestSession.create({
      data: { userId: guest.id, tokenHash: hashGuestToken(guestToken), expiresAt },
    });
    return guest;
  });

  return { user, token: guestToken, expiresAt };
}

export function setGuestCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set(GUEST_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN ?? "http://localhost:3000";
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}
