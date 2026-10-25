import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth";
import { limit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const MAX_BYTES = 4 * 1024 * 1024;

// Check the file's real bytes, not just its name, before storing it.
function sniff(buf: Uint8Array): "jpg" | "png" | "webp" | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (String.fromCharCode(...buf.slice(0, 4)) === "RIFF" && String.fromCharCode(...buf.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "owner") return NextResponse.json({ error: "Sign in again to upload photos." }, { status: 401 });
  const rl = await limit("upload", `u${session.userId}`);
  if (!rl.ok) return NextResponse.json({ error: "That's a lot of photos at once. Wait a minute." }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "Pick a photo to upload." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That photo is over 4 MB. Try a smaller one." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniff(bytes);
  if (!ext) return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 415 });
  const name = `products/${randomUUID()}.${ext}`;

  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(name, Buffer.from(bytes), {
        access: "public", contentType: `image/${ext === "jpg" ? "jpeg" : ext}`, cacheControlMaxAge: 31536000,
      });
      return NextResponse.json({ url: blob.url });
    }
    if (process.env.VERCEL) return NextResponse.json({ error: "Photo storage isn't set up. Add Vercel Blob to the project." }, { status: 503 });
    // Local dev: save into public/uploads.
    const { mkdir, writeFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const file = `${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, file), bytes);
    return NextResponse.json({ url: `/uploads/${file}` });
  } catch (err) {
    logger.error({ err }, "upload failed");
    return NextResponse.json({ error: "That photo didn't upload. Try again." }, { status: 500 });
  }
}
