import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, withApiErrors, type ApiRouteContext } from "@/lib/http";

const mediaTypes: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

export const runtime = "nodejs";

export const GET = withApiErrors(async (request: NextRequest, context: ApiRouteContext) => {
  if (!await getCurrentUser(request)) return errorResponse("Sign in to view shared media.", 401);
  const filename = (await context?.params)?.filename;
  const match = filename?.match(/^([0-9a-f-]{36})\.(jpg|png|webp|mp4|webm)$/i);
  if (!match) return errorResponse("Media not found.", 404);
  const extension = match[2]!.toLowerCase();
  const filePath = path.join(process.cwd(), "storage", "uploads", `${match[1]}.${extension}`);
  let contents: Buffer;
  try {
    contents = await readFile(filePath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return errorResponse("Media not found.", 404);
    }
    throw error;
  }
  return new NextResponse(new Uint8Array(contents), {
    headers: {
      "Content-Type": mediaTypes[extension]!,
      "Content-Length": String(contents.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
});
