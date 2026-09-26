import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { readJson, withApiErrors, errorResponse } from "@/lib/http";
import { isSameOrigin, issueSession } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";

export const POST = withApiErrors(async (request) => {
  if (!isSameOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  const parsed = await readJson(request, registerSchema);
  if ("response" in parsed) return parsed.response;
  const { email, username, name, password } = parsed.data;
  const duplicate = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });
  if (duplicate) {
    return errorResponse(
      duplicate.email === email ? "That email is already registered." : "That username is already taken.",
      409,
    );
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, username, name, passwordHash },
    select: { id: true, email: true, username: true, name: true, bio: true, avatarUrl: true },
  });
  const response = NextResponse.json({ user }, { status: 201 });
  await issueSession(user.id, response);
  return response;
});
