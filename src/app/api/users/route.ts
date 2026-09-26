import { NextResponse } from "next/server";
import { getGuest } from "@/lib/guest";
import { prisma } from "@/lib/db";
import { errorResponse, withApiErrors } from "@/lib/http";

export const GET = withApiErrors(async (request) => {
  const user = await getGuest(request);
  if (!user) return errorResponse("Guest session not found. Refresh to start a new guest session.", 401);
  const people = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      guestSession: { is: { expiresAt: { gt: new Date() } } },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true, username: true, name: true, bio: true, avatarUrl: true,
      followers: { where: { followerId: user.id }, select: { followerId: true } },
    },
  });
  return NextResponse.json({
    people: people.map(({ followers, ...person }) => ({ ...person, following: followers.length > 0 })),
  });
});
