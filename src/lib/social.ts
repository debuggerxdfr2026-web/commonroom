import { prisma } from "@/lib/db";

export async function notify(
  recipientId: string,
  actorId: string,
  type: "follow" | "like" | "comment" | "message",
  referenceId?: string,
) {
  if (recipientId === actorId) return;
  const recipientSession = await prisma.guestSession.findUnique({
    where: { userId: recipientId },
    select: { expiresAt: true },
  });
  if (!recipientSession || recipientSession.expiresAt <= new Date()) return;
  await prisma.notification.create({
    data: { recipientId, actorId, type, referenceId },
  });
}
