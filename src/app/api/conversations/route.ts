import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { conversationSchema } from "@/lib/validation";
import { errorResponse, readJson, withApiErrors } from "@/lib/http";

export const GET = withApiErrors(async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Sign in to view conversations.", 401);
  const conversations = await prisma.conversation.findMany({
    where: { members: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    include: {
      members: {
        where: { userId: { not: user.id } },
        include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } } },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return NextResponse.json({ conversations });
});

export const POST = withApiErrors(async (request: NextRequest) => {
  if (!isSameOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Sign in to start a conversation.", 401);
  const parsed = await readJson(request, conversationSchema);
  if ("response" in parsed) return parsed.response;
  if (parsed.data.userId === user.id) return errorResponse("Choose someone else to message.", 400);
  const other = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, username: true, name: true, avatarUrl: true },
  });
  if (!other) return errorResponse("That person could not be found.", 404);
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { members: { some: { userId: user.id } } },
        { members: { some: { userId: other.id } } },
      ],
    },
    include: {
      members: {
        where: { userId: { not: user.id } },
        include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } } },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (existing) return NextResponse.json({ conversation: existing });
  const conversation = await prisma.conversation.create({
    data: {
      members: { create: [{ userId: user.id }, { userId: other.id }] },
    },
    include: {
      members: {
        where: { userId: { not: user.id } },
        include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } } },
      },
      messages: true,
    },
  });
  return NextResponse.json({ conversation }, { status: 201 });
});
