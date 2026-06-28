import { Router } from "express";
import { log } from "../lib/logger";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml"]);
const MAX_SIZE = 5 * 1024 * 1024;

export const uploadRouter = Router();

// POST /upload  (multipart form-data: file)
// Returns a base64 data URL so images can be stored inline in the database.
uploadRouter.post("/", async (req, res) => {
  log.api("POST", "/upload");
  try {
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.startsWith("multipart/form-data")) {
      return res.status(400).json({ error: "Expected multipart/form-data" });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    // Extract boundary
    const boundaryMatch = contentType.match(/boundary=([^;\s]+)/);
    if (!boundaryMatch) {
      return res.status(400).json({ error: "Missing boundary" });
    }
    const boundary = "--" + boundaryMatch[1].replace(/^"|"$/g, "");

    // Parse parts
    const parts = body.toString("binary").split(boundary);
    for (const part of parts) {
      const headerEnd = part.indexOf("\r\n\r\n");
      if (headerEnd === -1) continue;

      const headers = part.slice(0, headerEnd);
      const dispositionMatch = headers.match(/Content-Disposition:[^\r\n]*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i);
      if (!dispositionMatch || dispositionMatch[1] !== "file") continue;

      const rawFile = part.slice(headerEnd + 4);
      // Remove trailing \r\n-- if present
      const fileData = rawFile.replace(/\r\n--$/, "").replace(/\r\n$/, "");

      // Find Content-Type header for this part
      const typeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
      const fileType = (typeMatch ? typeMatch[1].trim() : "application/octet-stream");

      if (!ALLOWED_TYPES.has(fileType)) {
        return res.status(400).json({ error: `Unsupported file type: ${fileType}` });
      }

      if (fileData.length > MAX_SIZE) {
        return res.status(400).json({ error: "File too large. Max 5MB." });
      }

      const base64 = Buffer.from(fileData, "binary").toString("base64");
      const url = `data:${fileType};base64,${base64}`;
      return res.json({ url });
    }

    return res.status(400).json({ error: "No file field found" });
  } catch (e) {
    log.err("upload", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});
