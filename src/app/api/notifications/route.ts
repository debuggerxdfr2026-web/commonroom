import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, withApiErrors } from "@/lib/http";

export const GET = withApiErrors(async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Sign in to view notifications.", 401);
  const notifications = await prisma.notification.findMany({
    where: { recipientId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { id: true, username: true, name: true, avatarUrl: true } } },
  });
  return NextResponse.json({ notifications });
});

export const PATCH = withApiErrors(async (request: NextRequest) => {
  if (!isSameOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Sign in to update notifications.", 401);
  await prisma.notification.updateMany({
    where: { recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
});
