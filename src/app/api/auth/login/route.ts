import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { isSameOrigin, issueSession } from "@/lib/auth";
import { errorResponse, readJson, withApiErrors } from "@/lib/http";
import { loginSchema } from "@/lib/validation";

export const POST = withApiErrors(async (request) => {
  if (!isSameOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  const parsed = await readJson(request, loginSchema);
  if ("response" in parsed) return parsed.response;
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, username: true, name: true, bio: true, avatarUrl: true, passwordHash: true },
  });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return errorResponse("Email or password is incorrect.", 401);
  }
  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
    },
  });
  await issueSession(user.id, response);
  return response;
});
