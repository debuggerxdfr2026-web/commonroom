import { NextResponse, type NextRequest } from "next/server";
import { getGuest, isSameOrigin } from "@/lib/guest";
import { prisma } from "@/lib/db";
import { errorResponse, readJson, requireId, withApiErrors, type ApiRouteContext } from "@/lib/http";
import { profileSchema } from "@/lib/validation";

export const GET = withApiErrors(async (request: NextRequest, context: ApiRouteContext) => {
  if (!await getGuest(request)) return errorResponse("Guest session not found. Refresh to start a new guest session.", 401);
  const id = requireId((await context?.params)?.id);
  if (!id) return errorResponse("Profile not found.", 404);
  const profile = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, username: true, name: true, bio: true, avatarUrl: true, createdAt: true,
      _count: { select: { followers: true, following: true, posts: true } },
      posts: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, body: true, mediaUrl: true, mediaType: true, createdAt: true },
      },
    },
  });
  return profile ? NextResponse.json({ profile }) : errorResponse("Profile not found.", 404);
});

export const PATCH = withApiErrors(async (request: NextRequest, context: ApiRouteContext) => {
  if (!isSameOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  const user = await getGuest(request);
  if (!user) return errorResponse("Guest session not found. Refresh to start a new guest session.", 401);
  const id = requireId((await context?.params)?.id);
  if (!id || id !== user.id) return errorResponse("You can only edit your own profile.", 403);
  const parsed = await readJson(request, profileSchema);
  if ("response" in parsed) return parsed.response;
  const profile = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, username: true, name: true, bio: true, avatarUrl: true },
  });
  return NextResponse.json({ profile });
});
