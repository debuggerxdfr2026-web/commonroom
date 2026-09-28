import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  conversation: { findFirst: vi.fn(), create: vi.fn() },
  post: { create: vi.fn(), findUnique: vi.fn() },
  like: { createMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/guest", () => ({
  getGuest: vi.fn(),
  ensureGuest: vi.fn(),
  setGuestCookie: vi.fn(),
  isSameOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/social", () => ({ notify: vi.fn() }));

import { ensureGuest, getGuest, isSameOrigin, setGuestCookie } from "@/lib/guest";
import { notify } from "@/lib/social";
import { POST as createGuest } from "@/app/api/guest/route";
import { GET as getMessages } from "@/app/api/conversations/[id]/messages/route";
import { POST as startConversation } from "@/app/api/conversations/route";
import { POST as createPost } from "@/app/api/posts/route";
import { PUT as likePost } from "@/app/api/posts/[id]/like/route";
import { PATCH as editProfile } from "@/app/api/users/[id]/route";

const guest = {
  id: "guest-1",
  username: "guest_123",
  name: "Guest A12F",
  bio: "",
  avatarUrl: null,
};

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

describe("guest identity and social APIs", () => {
  beforeEach(() => {
    vi.mocked(getGuest).mockReset();
    vi.mocked(ensureGuest).mockReset();
    vi.mocked(setGuestCookie).mockReset();
    vi.mocked(isSameOrigin).mockReturnValue(true);
    vi.mocked(notify).mockReset();
  });

  it("starts a guest identity without creating or returning credentials", async () => {
    const expiresAt = new Date("2027-09-26T00:00:00Z");
    vi.mocked(ensureGuest).mockResolvedValue({ user: guest, token: "opaque-token", expiresAt });

    const response = await createGuest(request("/api/guest", "POST", { username: "chosen-handle" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: guest });
    expect(ensureGuest).toHaveBeenCalledWith(expect.anything());
    expect(setGuestCookie).toHaveBeenCalledWith(expect.anything(), "opaque-token", expiresAt);
  });

  it("rejects cross-origin guest bootstrap before creating an identity", async () => {
    vi.mocked(isSameOrigin).mockReturnValue(false);

    const response = await createGuest(request("/api/guest", "POST", {}));

    expect(response.status).toBe(403);
    expect(ensureGuest).not.toHaveBeenCalled();
  });

  it("creates posts as the current browser guest", async () => {
    vi.mocked(getGuest).mockResolvedValue(guest);
    db.post.create.mockResolvedValue({
      id: "post-1",
      body: "Hello from a guest",
      mediaUrl: null,
      mediaType: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      author: guest,
      likes: [],
      comments: [],
      _count: { likes: 0, comments: 0 },
    });

    const response = await createPost(request("/api/posts", "POST", { body: "Hello from a guest" }));

    expect(response.status).toBe(201);
    expect(db.post.create.mock.calls[0]?.[0].data.authorId).toBe(guest.id);
    expect((await response.json()).post.author).toEqual(guest);
  });

  it("rejects invalid content instead of reporting a post was created", async () => {
    vi.mocked(getGuest).mockResolvedValue(guest);

    const response = await createPost(request("/api/posts", "POST", { body: " " }));

    expect(response.status).toBe(400);
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("rejects oversized JSON bodies before parsing or writing", async () => {
    vi.mocked(getGuest).mockResolvedValue(guest);

    const response = await createPost(request("/api/posts", "POST", { body: "x".repeat(17_000) }));

    expect(response.status).toBe(413);
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("requires a guest session before allowing social actions", async () => {
    vi.mocked(getGuest).mockResolvedValue(null);

    const response = await createPost(request("/api/posts", "POST", { body: "Hello" }));

    expect(response.status).toBe(401);
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("prevents a guest from editing another profile", async () => {
    vi.mocked(getGuest).mockResolvedValue(guest);

    const response = await editProfile(
      request("/api/users/guest-2", "PATCH", { name: "Changed", bio: "Nope" }),
      { params: Promise.resolve({ id: "guest-2" }) },
    );

    expect(response.status).toBe(403);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("makes post likes idempotent and notifies only on the first like", async () => {
    vi.mocked(getGuest).mockResolvedValue(guest);
    db.post.findUnique.mockResolvedValue({ id: "post-1", authorId: "guest-2" });
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

  it("requires a guest identity before reading private messages", async () => {
    vi.mocked(getGuest).mockResolvedValue(null);
    const response = await getMessages(request("/api/conversations/chat-1/messages", "GET"), {
      params: Promise.resolve({ id: "chat-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("does not start a conversation with an inactive guest identity", async () => {
    vi.mocked(getGuest).mockResolvedValue(guest);
    db.user.findUnique.mockResolvedValue({
      id: "guest-2",
      username: "guest_old",
      name: "Guest Old",
      avatarUrl: null,
      guestSession: null,
    });

    const response = await startConversation(request("/api/conversations", "POST", { userId: "guest-2" }));

    expect(response.status).toBe(404);
    expect(db.conversation.create).not.toHaveBeenCalled();
  });
});
