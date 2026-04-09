import fs from "node:fs/promises";
import path from "node:path";
import { FILES_DIR, SESSIONS_DIR, STORAGE_DIR } from "../constants.js";

export type AdminStoredFile = {
  transferId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storedBytes: number;
  createdAt: number;
  fromDeviceId: string;
  fromDeviceName: string;
  to: unknown;
  sha256?: string;
};

export type StoredFileLookup =
  | {
      ok: true;
      transferId: string;
      fileNameOnDisk: string;
      filePath: string;
      metaPath: string;
      meta: AdminStoredFile;
    }
  | { ok: false; error: "INVALID_ID" | "NOT_FOUND" | "BROKEN_META" };

function isSafeId(id: string) {
  if (!id) return false;
  if (id.includes("/") || id.includes("\\") || id.includes("..")) return false;
  return /^[a-z0-9-]{12,}$/i.test(id);
}

async function pathExists(p: string) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function listStoredFiles(baseDir = path.join(process.cwd(), STORAGE_DIR)) {
  const dir = path.join(baseDir, FILES_DIR);
  if (!(await pathExists(dir))) return { items: [] as AdminStoredFile[], totalBytes: 0 };

  const entries = await fs.readdir(dir);
  const items: AdminStoredFile[] = [];
  let totalBytes = 0;

  for (const transferId of entries) {
    if (!isSafeId(transferId)) continue;
    const itemDir = path.join(dir, transferId);
    try {
      const metaPath = path.join(itemDir, "meta.json");
      if (!(await pathExists(metaPath))) continue;
      const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as any;

      const files = (await fs.readdir(itemDir)).filter((f) => f !== "meta.json");
      const fileOnDisk = files[0];
      const storedPath = fileOnDisk ? path.join(itemDir, fileOnDisk) : null;
      const storedBytes = storedPath ? (await fs.stat(storedPath)).size : 0;

      totalBytes += storedBytes;
      items.push({
        transferId,
        fileName: meta.fileName ?? fileOnDisk ?? "file",
        mimeType: meta.mimeType ?? "application/octet-stream",
        fileSize: Number(meta.fileSize ?? storedBytes),
        storedBytes,
        createdAt: Number(meta.createdAt ?? 0),
        fromDeviceId: String(meta.fromDeviceId ?? ""),
        fromDeviceName: String(meta.fromDeviceName ?? ""),
        to: meta.to,
        sha256: meta.sha256
      });
    } catch {
      // ignore broken entry
    }
  }

  items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return { items, totalBytes };
}

export async function deleteStoredFile(transferId: string, baseDir = path.join(process.cwd(), STORAGE_DIR)) {
  if (!isSafeId(transferId)) return { ok: false, error: "INVALID_ID" as const };

  const filesDir = path.join(baseDir, FILES_DIR, transferId);
  const sessionsDir = path.join(baseDir, SESSIONS_DIR, transferId);

  try {
    await fs.rm(filesDir, { recursive: true, force: true });
    await fs.rm(sessionsDir, { recursive: true, force: true });
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "DELETE_FAILED" as const };
  }
}

export async function lookupStoredFile(transferId: string, baseDir = path.join(process.cwd(), STORAGE_DIR)): Promise<StoredFileLookup> {
  if (!isSafeId(transferId)) return { ok: false, error: "INVALID_ID" };

  const itemDir = path.join(baseDir, FILES_DIR, transferId);
  const metaPath = path.join(itemDir, "meta.json");
  if (!(await pathExists(metaPath))) return { ok: false, error: "NOT_FOUND" };

  let metaRaw: any;
  try {
    metaRaw = JSON.parse(await fs.readFile(metaPath, "utf8"));
  } catch {
    return { ok: false, error: "BROKEN_META" };
  }

  try {
    const files = (await fs.readdir(itemDir)).filter((f) => f !== "meta.json");
    const fileNameOnDisk = files[0];
    if (!fileNameOnDisk) return { ok: false, error: "NOT_FOUND" };

    const filePath = path.join(itemDir, fileNameOnDisk);
    const storedBytes = (await fs.stat(filePath)).size;

    const meta: AdminStoredFile = {
      transferId,
      fileName: metaRaw.fileName ?? fileNameOnDisk,
      mimeType: metaRaw.mimeType ?? "application/octet-stream",
      fileSize: Number(metaRaw.fileSize ?? storedBytes),
      storedBytes,
      createdAt: Number(metaRaw.createdAt ?? 0),
      fromDeviceId: String(metaRaw.fromDeviceId ?? ""),
      fromDeviceName: String(metaRaw.fromDeviceName ?? ""),
      to: metaRaw.to,
      sha256: metaRaw.sha256
    };

    return { ok: true, transferId, fileNameOnDisk, filePath, metaPath, meta };
  } catch {
    return { ok: false, error: "NOT_FOUND" };
  }
}
