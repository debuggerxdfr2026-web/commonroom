import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, withApiErrors } from "@/lib/http";

export const GET = withApiErrors(async (request) => {
  const user = await getCurrentUser(request);
  if (!user) return errorResponse("Sign in to find people.", 401);
  const people = await prisma.user.findMany({
    where: { id: { not: user.id } },
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
