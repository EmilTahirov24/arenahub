import "server-only";
import { writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local disk in dev; Vercel Blob in prod once BLOB_READ_WRITE_TOKEN is set
 * (e.g. after running `vercel blob store add` / linking a Blob store).
 * Local disk uploads do not survive a serverless deploy, so this must
 * switch automatically the moment the token exists — no code changes needed.
 */
export async function saveUpload(bytes: Buffer, filename: string, contentType: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(filename, bytes, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  const filePath = path.join(process.cwd(), "public", "uploads", filename);
  await writeFile(filePath, bytes);
  return `/uploads/${filename}`;
}
