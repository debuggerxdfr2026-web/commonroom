import { NextResponse, type NextRequest } from "next/server";
import { getGuest, isSameOrigin } from "@/lib/guest";
import { prisma } from "@/lib/db";
import { messageSchema } from "@/lib/validation";
import { errorResponse, readJson, requireId, withApiErrors, type ApiRouteContext } from "@/lib/http";
import { notify } from "@/lib/social";

async function getAuthorizedConversation(id: string, userId: string) {
  return prisma.conversation.findFirst({
    where: { id, members: { some: { userId } } },
    select: { id: true },
  });
}

export const GET = withApiErrors(async (request: NextRequest, context: ApiRouteContext) => {
  const user = await getGuest(request);
  if (!user) return errorResponse("Guest session not found. Refresh to start a new guest session.", 401);
  const id = requireId((await context?.params)?.id);
  if (!id) return errorResponse("Conversation not found.", 404);
  if (!await getAuthorizedConversation(id, user.id)) {
    return errorResponse("Conversation not found.", 404);
  }
  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { sender: { select: { id: true, username: true, name: true, avatarUrl: true } } },
  });
  return NextResponse.json({ messages });
});

export const POST = withApiErrors(async (request: NextRequest, context: ApiRouteContext) => {
  if (!isSameOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  const user = await getGuest(request);
  if (!user) return errorResponse("Guest session not found. Refresh to start a new guest session.", 401);
  const id = requireId((await context?.params)?.id);
  if (!id) return errorResponse("Conversation not found.", 404);
  if (!await getAuthorizedConversation(id, user.id)) {
    return errorResponse("Conversation not found.", 404);
  }
  const parsed = await readJson(request, messageSchema);
  if ("response" in parsed) return parsed.response;
  const message = await prisma.$transaction(async (transaction) => {
    const saved = await transaction.message.create({
      data: { conversationId: id, senderId: user.id, body: parsed.data.body },
      include: { sender: { select: { id: true, username: true, name: true, avatarUrl: true } } },
    });
    await transaction.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return saved;
  });
  const members = await prisma.conversationParticipant.findMany({
    where: { conversationId: id, userId: { not: user.id } },
    select: { userId: true },
  });
  await Promise.all(members.map((member) => notify(member.userId, user.id, "message", id)));
  return NextResponse.json({ message }, { status: 201 });
});
