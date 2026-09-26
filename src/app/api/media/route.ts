import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { errorResponse, withApiErrors } from "@/lib/http";

export const runtime = "nodejs";
const MAX_BYTES = 10 * 1024 * 1024;

function identifyMedia(bytes: Uint8Array): { type: "image" | "video"; extension: string } | null {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { type: "image", extension: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { type: "image", extension: "jpg" };
  }
  if (bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    return { type: "image", extension: "webp" };
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 &&
      bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { type: "video", extension: "webm" };
  }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") {
    return { type: "video", extension: "mp4" };
  }
  return null;
}

export const POST = withApiErrors(async (request) => {
  if (!isSameOrigin(request)) return errorResponse("Request origin could not be verified.", 403);
  if (!await getCurrentUser(request)) return errorResponse("Sign in to upload media.", 401);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES + 64 * 1024) {
    return errorResponse("Media must be 10 MB or smaller.", 413);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Upload request is malformed. Please choose the file again.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return errorResponse("Choose an image or video to upload.", 400);
  if (file.size === 0 || file.size > MAX_BYTES) {
    return errorResponse("Media must be between 1 byte and 10 MB.", 413);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = identifyMedia(bytes);
  if (!detected) return errorResponse("That file is not a supported image or video.", 415);
  const filename = `${randomUUID()}.${detected.extension}`;
  const uploadDirectory = path.join(process.cwd(), "storage", "uploads");
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(path.join(uploadDirectory, filename), bytes, { flag: "wx" });
  return NextResponse.json({ url: `/api/media/${filename}`, type: detected.type }, { status: 201 });
});
