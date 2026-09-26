import { NextResponse } from "next/server";
import { getGuest, isSameOrigin } from "@/lib/guest";
import { prisma } from "@/lib/db";
import { errorResponse, readJson, withApiErrors } from "@/lib/http";
import { postSchema } from "@/lib/validation";

export const POST = withApiErrors(async (request) => {
  if (!isSameOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  const user = await getGuest(request);
  if (!user) return errorResponse("Guest session not found. Refresh to start a new guest session.", 401);
  const parsed = await readJson(request, postSchema);
  if ("response" in parsed) return parsed.response;
  if (parsed.data.mediaUrl && !parsed.data.mediaType) {
    return errorResponse("Choose whether your attachment is an image or video.", 400);
  }
  const post = await prisma.post.create({
    data: { ...parsed.data, authorId: user.id },
    include: {
      author: { select: { id: true, username: true, name: true, avatarUrl: true } },
      likes: { select: { userId: true } },
      comments: true,
      _count: { select: { likes: true, comments: true } },
    },
  });
  return NextResponse.json({ post: { ...post, likedByMe: false } }, { status: 201 });
});
