import path from "node:path";

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg"
};

export function inferMimeTypeFromName(fileName: string): string | null {
  const ext = path.extname(fileName || "").toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

export function effectiveMimeType(storedMimeType: string | undefined | null, fileName: string): string {
  const mt = String(storedMimeType ?? "").trim();
  const looksGeneric = !mt || mt === "application/octet-stream";
  if (!looksGeneric) return mt;
  return inferMimeTypeFromName(fileName) ?? (mt || "application/octet-stream");
}

