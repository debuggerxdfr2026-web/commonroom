import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, withApiErrors } from "@/lib/http";

export const GET = withApiErrors(async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Sign in to view your feed.", 401);
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      author: { select: { id: true, username: true, name: true, avatarUrl: true } },
      likes: { select: { userId: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        take: 3,
        include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } } },
      },
      _count: { select: { likes: true, comments: true } },
    },
  });
  return NextResponse.json({
    posts: posts.map(({ likes, ...post }) => ({
      ...post,
      likedByMe: likes.some((like) => like.userId === user.id),
    })),
  });
});
