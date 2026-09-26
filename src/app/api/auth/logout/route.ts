import { NextResponse } from "next/server";
import { clearSessionCookie, isSameOrigin, revokeSession } from "@/lib/auth";
import { errorResponse, withApiErrors } from "@/lib/http";

export const POST = withApiErrors(async (request) => {
  if (!isSameOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  await revokeSession(request);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
});
