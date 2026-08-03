import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth";
import { saveUpload } from "@/lib/storage";
import { rateLimit } from "@/lib/rateLimit";

/**
 * SVG is deliberately excluded: it is an active-content format, and uploads are
 * served from this site's own origin, so an <script> inside an .svg would run
 * with the visitor's session.
 */
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_SIZE = 5 * 1024 * 1024;

/** Leading bytes that must match the claimed type — `file.type` comes from the client. */
const MAGIC: Record<string, number[][]> = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // "RIFF", with "WEBP" at offset 8
};

function magicMatches(bytes: Buffer, type: string) {
  const signatures = MAGIC[type];
  if (!signatures) return false;
  const headerOk = signatures.some((sig) => sig.every((b, i) => bytes[i] === b));
  if (!headerOk) return false;
  if (type === "image/webp") return bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return true;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`upload:${session.id}`, 20, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many uploads, try again later" }, { status: 429 });
  }

  // Reject oversized bodies before formData() buffers the whole thing into memory.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_SIZE + 1024) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 413 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!magicMatches(bytes, file.type)) {
    return NextResponse.json({ error: "File content does not match its type" }, { status: 400 });
  }

  const filename = `${randomUUID()}.${ext}`;
  const url = await saveUpload(bytes, filename, file.type);

  return NextResponse.json({ url });
}
