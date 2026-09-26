import { NextResponse, type NextRequest } from "next/server";
import { getGuest, isSameOrigin } from "@/lib/guest";
import { prisma } from "@/lib/db";
import { errorResponse, requireId, withApiErrors, type ApiRouteContext } from "@/lib/http";
import { notify } from "@/lib/social";

async function setLike(request: NextRequest, context: ApiRouteContext | undefined, active: boolean) {
  if (!isSameOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  const user = await getGuest(request);
  if (!user) return errorResponse("Guest session not found. Refresh to start a new guest session.", 401);
  const id = requireId((await context?.params)?.id);
  if (!id) return errorResponse("Post not found.", 404);
  const post = await prisma.post.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!post) return errorResponse("Post not found.", 404);
  let likedByMe = false;
  if (active) {
    const result = await prisma.like.createMany({
      data: [{ userId: user.id, postId: id }],
      skipDuplicates: true,
    });
    likedByMe = true;
    if (result.count > 0) await notify(post.authorId, user.id, "like", id);
  } else {
    await prisma.like.deleteMany({ where: { userId: user.id, postId: id } });
  }
  const count = await prisma.like.count({ where: { postId: id } });
  return NextResponse.json({ likedByMe, count });
}

export const PUT = withApiErrors((request: NextRequest, context: ApiRouteContext) => setLike(request, context, true));
export const DELETE = withApiErrors((request: NextRequest, context: ApiRouteContext) => setLike(request, context, false));
