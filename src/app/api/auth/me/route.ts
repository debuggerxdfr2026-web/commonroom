import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { withApiErrors } from "@/lib/http";

export const GET = withApiErrors(async (request) => {
  const user = await getCurrentUser(request);
  return NextResponse.json({ user });
});
