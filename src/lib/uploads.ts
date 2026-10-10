import path from "node:path";

/** Yuklangan fayllar papkasi: UPLOAD_DIR (Railway Volume: /data/uploads) yoki public/uploads */
export function uploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}
