import { Router } from "express";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { log } from "../lib/logger";

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

export const uploadRouter = Router();

// POST /upload  (multipart form-data: file, caption)
uploadRouter.post("/", async (req, res) => {
  log.api("POST", "/upload");
  try {
    if (!req.headers["content-type"]?.startsWith("multipart/form-data")) {
      return res.status(400).json({ error: "Expected multipart/form-data" });
    }

    // For Express, we need multer for proper multipart handling.
    // For now, use a simple manual parser for single file.
    // TODO: add multer middleware

    // Fallback: try req.body.file (if base64) or skip
    return res.status(501).json({ error: "Multipart parsing not yet implemented. Add multer." });
  } catch (e) {
    log.err("upload", e);
    return res.status(500).json({ error: (e as Error).message });
  }
});
