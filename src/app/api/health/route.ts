import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiErrors } from "@/lib/http";

export const GET = withApiErrors(async () => {
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ status: "ok", database: "connected" });
});
