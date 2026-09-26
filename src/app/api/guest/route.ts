import { NextResponse, type NextRequest } from "next/server";
import { ensureGuest, isSameOrigin, setGuestCookie } from "@/lib/guest";
import { errorResponse, readJson, withApiErrors } from "@/lib/http";
import { guestBootstrapSchema } from "@/lib/validation";

export const POST = withApiErrors(async (request: NextRequest) => {
  if (!isSameOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  const parsed = await readJson(request, guestBootstrapSchema);
  if ("response" in parsed) return parsed.response;
  const guest = await ensureGuest(request);
  const response = NextResponse.json({ user: guest.user });
  if (guest.token && guest.expiresAt) setGuestCookie(response, guest.token, guest.expiresAt);
  return response;
});
