import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const db = vi.hoisted(() => ({
  guestSession: { findUnique: vi.fn(), delete: vi.fn() },
  notification: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: db }));

import { ensureGuest, getGuest, setGuestCookie } from "@/lib/guest";
import { notify } from "@/lib/social";

const guest = {
  id: "guest-1",
  username: "guest_123",
  name: "Guest A12F",
  bio: "",
  avatarUrl: null,
};

describe("browser guest identity", () => {
  const transaction = {
    user: { create: vi.fn() },
    guestSession: { create: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    transaction.user.create.mockResolvedValue(guest);
    db.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );
  });

  it("creates a credential-free profile and persists only a token hash", async () => {
    const before = Date.now();
    const result = await ensureGuest(new NextRequest("http://localhost:3000/api/guest"));
    const after = Date.now();
    if (typeof result.token !== "string" || !(result.expiresAt instanceof Date)) {
      throw new Error("Expected a newly created guest identity.");
    }
    const { token, expiresAt } = result;
    const userData = transaction.user.create.mock.calls[0]?.[0].data;
    const sessionData = transaction.guestSession.create.mock.calls[0]?.[0].data;

    expect(result.user).toEqual(guest);
    expect(userData).toMatchObject({
      username: expect.stringMatching(/^guest_[a-f0-9]{16}$/),
      name: expect.stringMatching(/^Guest [A-F0-9]{4}$/),
    });
    expect(userData).not.toHaveProperty("email");
    expect(userData).not.toHaveProperty("passwordHash");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sessionData).toEqual({
      userId: guest.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt,
    });
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 365 * 24 * 60 * 60 * 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 365 * 24 * 60 * 60 * 1000);

    const response = NextResponse.json({ user: result.user });
    setGuestCookie(response, token, expiresAt);
    expect(response.cookies.get("commonroom_guest")).toMatchObject({
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("resolves the guest from the opaque browser cookie", async () => {
    const token = "a".repeat(43);
    const expiresAt = new Date(Date.now() + 60_000);
    db.guestSession.findUnique.mockResolvedValue({ id: "session-1", expiresAt, user: guest });
    const request = new NextRequest("http://localhost:3000/api/feed", {
      headers: { Cookie: `commonroom_guest=${token}` },
    });

    await expect(getGuest(request)).resolves.toEqual(guest);
    expect(db.guestSession.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: createHash("sha256").update(token).digest("hex") },
      include: { user: { select: { id: true, username: true, name: true, bio: true, avatarUrl: true } } },
    });
  });

  it("does not resolve an expired guest identity", async () => {
    db.guestSession.findUnique.mockResolvedValue({
      id: "session-1",
      expiresAt: new Date(Date.now() - 1),
      user: guest,
    });
    const request = new NextRequest("http://localhost:3000/api/feed", {
      headers: { Cookie: `commonroom_guest=${"b".repeat(43)}` },
    });

    await expect(getGuest(request)).resolves.toBeNull();
  });

  it("does not create notifications for expired guest profiles", async () => {
    db.guestSession.findUnique.mockResolvedValue(null);

    await notify("guest-1", "guest-2", "follow");

    expect(db.notification.create).not.toHaveBeenCalled();
  });
});
