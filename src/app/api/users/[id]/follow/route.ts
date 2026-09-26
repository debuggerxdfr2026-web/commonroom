import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, requireId, withApiErrors, type ApiRouteContext } from "@/lib/http";
import { notify } from "@/lib/social";

async function follow(request: NextRequest, context: ApiRouteContext | undefined, active: boolean) {
  if (!isSameOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Sign in to connect with people.", 401);
  const targetId = requireId((await context?.params)?.id);
  if (!targetId) return errorResponse("Profile not found.", 404);
  if (targetId === user.id) return errorResponse("You cannot follow yourself.", 400);
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) return errorResponse("Profile not found.", 404);
  let following = active;
  if (active) {
    const result = await prisma.follow.createMany({
      data: [{ followerId: user.id, followingId: targetId }],
      skipDuplicates: true,
    });
    if (result.count > 0) await notify(targetId, user.id, "follow");
  } else {
    await prisma.follow.deleteMany({ where: { followerId: user.id, followingId: targetId } });
    following = false;
  }
  return NextResponse.json({ following });
}

export const PUT = withApiErrors((request: NextRequest, context: ApiRouteContext) => follow(request, context, true));
export const DELETE = withApiErrors((request: NextRequest, context: ApiRouteContext) => follow(request, context, false));
