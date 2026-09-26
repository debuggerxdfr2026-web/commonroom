import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  post: { findUnique: vi.fn() },
  like: { createMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  isSameOrigin: vi.fn(() => true),
  issueSession: vi.fn(),
  revokeSession: vi.fn(),
  clearSessionCookie: vi.fn(),
  SESSION_COOKIE: "commonroom_session",
}));
vi.mock("@/lib/social", () => ({ notify: vi.fn() }));

import { getCurrentUser } from "@/lib/auth";
import { isSameOrigin, issueSession } from "@/lib/auth";
import { notify } from "@/lib/social";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { PATCH as editProfile } from "@/app/api/users/[id]/route";
import { PUT as likePost } from "@/app/api/posts/[id]/like/route";

function request(path: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      Origin: "http://localhost:3000",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("API authentication and authorization", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(isSameOrigin).mockReturnValue(true);
    vi.mocked(issueSession).mockReset();
  });

  it("does not issue a session for an incorrect password", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "account-1",
      email: "maya@example.test",
      username: "maya",
      name: "Maya",
      bio: "",
      avatarUrl: null,
      passwordHash: await bcrypt.hash("correct horse battery", 4),
    });

    const response = await login(request("/api/auth/login", "POST", {
      email: "maya@example.test",
      password: "wrong password",
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Email or password is incorrect." });
    expect(issueSession).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin login mutation before looking up an account", async () => {
    vi.mocked(isSameOrigin).mockReturnValue(false);
    const response = await login(request("/api/auth/login", "POST", {
      email: "maya@example.test",
      password: "correct horse battery",
    }));

    expect(response.status).toBe(403);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("registers an account with a password hash and starts a session", async () => {
    db.user.findFirst.mockResolvedValue(null);
    db.user.create.mockResolvedValue({
      id: "account-3",
      email: "maya@example.test",
      username: "maya_new",
      name: "Maya Chen",
      bio: "",
      avatarUrl: null,
    });
    const response = await register(request("/api/auth/register", "POST", {
      name: "Maya Chen",
      username: "Maya_New",
      email: "MAYA@example.test",
      password: "correct horse battery",
    }));

    expect(response.status).toBe(201);
    expect(db.user.create.mock.calls[0]?.[0].data.passwordHash).not.toBe("correct horse battery");
    expect(issueSession).toHaveBeenCalledWith("account-3", expect.anything());
  });

  it("prevents a signed-in user from editing another profile", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "account-1", email: "maya@example.test", username: "maya", name: "Maya",
      bio: "", avatarUrl: null,
    });
    const response = await editProfile(
      request("/api/users/account-2", "PATCH", { name: "Changed", bio: "Nope" }),
      { params: Promise.resolve({ id: "account-2" }) },
    );

    expect(response.status).toBe(403);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("makes post likes idempotent and notifies only on the first like", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "account-1", email: "maya@example.test", username: "maya", name: "Maya",
      bio: "", avatarUrl: null,
    });
    db.post.findUnique.mockResolvedValue({ id: "post-1", authorId: "account-2" });
    db.like.createMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    db.like.count.mockResolvedValue(1);

    const first = await likePost(request("/api/posts/post-1/like", "PUT"), {
      params: Promise.resolve({ id: "post-1" }),
    });
    const second = await likePost(request("/api/posts/post-1/like", "PUT"), {
      params: Promise.resolve({ id: "post-1" }),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ likedByMe: true, count: 1 });
    expect(db.like.createMany).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("requires authentication before reading another user's messages", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("@/app/api/conversations/[id]/messages/route");
    const response = await GET(request("/api/conversations/chat-1/messages", "GET"), {
      params: Promise.resolve({ id: "chat-1" }),
    });
    expect(response.status).toBe(401);
  });
});
