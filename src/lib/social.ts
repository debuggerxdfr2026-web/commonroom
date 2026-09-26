import { prisma } from "@/lib/db";

export async function notify(
  recipientId: string,
  actorId: string,
  type: "follow" | "like" | "comment" | "message",
  referenceId?: string,
) {
  if (recipientId === actorId) return;
  await prisma.notification.create({
    data: { recipientId, actorId, type, referenceId },
  });
}
