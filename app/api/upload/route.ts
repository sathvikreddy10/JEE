import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { log } from "@/backend/lib/logger";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml"]);
const MAX_SIZE = 5 * 1024 * 1024;

const EXT_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export async function POST(req: NextRequest) {
  log.api("POST", "/api/upload");
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const caption = (form.get("caption") as string | null) || "";

    if (!file) {
      log.warn("Upload rejected: no file");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      log.warn(`Upload rejected: bad type ${file.type}`);
      return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      log.warn(`Upload rejected: too large ${file.size} bytes`);
      return NextResponse.json({ error: `Max size 5MB, got ${file.size}` }, { status: 400 });
    }

    const ext = EXT_MAP[file.type] || "bin";
    const hash = crypto.randomBytes(8).toString("hex");
    const filename = `${Date.now()}-${hash}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    await writeFile(filepath, buffer);

    const url = `/uploads/${filename}`;
    log.success(`Uploaded ${file.name} → ${url} (${(file.size / 1024).toFixed(1)}KB)`);

    return NextResponse.json({ url, filename, size: file.size, type: file.type, caption });
  } catch (e) {
    log.err("upload", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
