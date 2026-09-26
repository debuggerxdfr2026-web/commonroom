import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { commentSchema } from "@/lib/validation";
import { errorResponse, readJson, requireId, withApiErrors, type ApiRouteContext } from "@/lib/http";
import { notify } from "@/lib/social";

export const GET = withApiErrors(async (request: NextRequest, context: ApiRouteContext) => {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Sign in to view comments.", 401);
  const id = requireId((await context?.params)?.id);
  if (!id) return errorResponse("Post not found.", 404);
  const exists = await prisma.post.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return errorResponse("Post not found.", 404);
  const comments = await prisma.comment.findMany({
    where: { postId: id },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } } },
  });
  return NextResponse.json({ comments });
});

export const POST = withApiErrors(async (request: NextRequest, context: ApiRouteContext) => {
  if (!isSameOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Sign in to comment.", 401);
  const id = requireId((await context?.params)?.id);
  if (!id) return errorResponse("Post not found.", 404);
  const parsed = await readJson(request, commentSchema);
  if ("response" in parsed) return parsed.response;
  const post = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });
  if (!post) return errorResponse("Post not found.", 404);
  const comment = await prisma.comment.create({
    data: { postId: id, userId: user.id, body: parsed.data.body },
    include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } } },
  });
  await notify(post.authorId, user.id, "comment", id);
  return NextResponse.json({ comment }, { status: 201 });
});
