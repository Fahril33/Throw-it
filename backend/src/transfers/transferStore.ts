import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream, createWriteStream } from "node:fs";
import { STORAGE_DIR, SESSIONS_DIR, FILES_DIR } from "../constants.js";
import { safeFilename } from "../utils/safeFilename.js";
import { sha256File } from "../utils/sha256.js";
import { effectiveMimeType } from "../utils/inferMime.js";
import type { TransferMeta, TransferSession } from "./types.js";

type FinalizedTransfer = TransferMeta & {
  filePath: string;
  sha256: string;
};

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function pathExists(p: string) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

export class TransferStore {
  private sessions = new Map<string, TransferSession>();
  private finalized = new Map<string, FinalizedTransfer>();
  private baseDir: string;

  constructor(baseDir = path.join(process.cwd(), STORAGE_DIR)) {
    this.baseDir = baseDir;
  }

  private async loadFinalizedFromDisk(transferId: string) {
    const outDir = path.join(this.baseDir, FILES_DIR, transferId);
    const metaPath = path.join(outDir, "meta.json");
    if (!(await pathExists(metaPath))) return null;
    const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as TransferMeta & { sha256: string };
    const entries = await fs.readdir(outDir);
    const fileNameOnDisk = entries.find((e) => e !== "meta.json") ?? null;
    if (!fileNameOnDisk) return null;
    const filePath = path.join(outDir, fileNameOnDisk);

    const finalizedMeta: FinalizedTransfer = {
      transferId: meta.transferId,
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      mimeType: meta.mimeType,
      chunkSize: meta.chunkSize,
      totalChunks: meta.totalChunks,
      mode: meta.mode,
      to: meta.to,
      fromDeviceId: meta.fromDeviceId,
      fromDeviceName: meta.fromDeviceName,
      createdAt: meta.createdAt,
      filePath,
      sha256: meta.sha256
    };

    this.finalized.set(transferId, finalizedMeta);
    return finalizedMeta;
  }

  async init(meta: TransferMeta) {
    const transferId = meta.transferId;

    const sessionsDir = path.join(this.baseDir, SESSIONS_DIR);
    const sessionDir = path.join(sessionsDir, transferId);
    const chunksDir = path.join(sessionDir, "chunks");
    await ensureDir(chunksDir);

    const metaPath = path.join(sessionDir, "meta.json");
    const existingMeta = (await pathExists(metaPath))
      ? (JSON.parse(await fs.readFile(metaPath, "utf8")) as TransferMeta)
      : null;

    const effectiveMeta: TransferMeta = existingMeta ?? meta;
    const received = new Array<boolean>(effectiveMeta.totalChunks).fill(false);

    // Recover already-uploaded chunks if resume
    const chunkFiles = (await fs.readdir(chunksDir)).filter((f) => f.endsWith(".part"));
    for (const file of chunkFiles) {
      const idx = Number(file.replace(".part", ""));
      if (Number.isFinite(idx) && idx >= 0 && idx < received.length) {
        received[idx] = true;
      }
    }

    const receivedCount = received.reduce((acc, v) => acc + (v ? 1 : 0), 0);

    const session: TransferSession = {
      ...effectiveMeta,
      received,
      receivedCount,
      sessionDir,
      chunksDir
    };

    await fs.writeFile(metaPath, JSON.stringify(effectiveMeta, null, 2), "utf8");
    this.sessions.set(transferId, session);
    return this.getStatus(transferId);
  }

  getStatus(transferId: string) {
    const session = this.sessions.get(transferId);
    if (!session) return null;
    const receivedIndexes: number[] = [];
    for (let i = 0; i < session.received.length; i++) {
      if (session.received[i]) receivedIndexes.push(i);
    }
    return {
      transferId,
      receivedIndexes,
      receivedCount: session.receivedCount,
      totalChunks: session.totalChunks
    };
  }

  async writeChunk(transferId: string, index: number, data: Buffer) {
    const session = this.sessions.get(transferId);
    if (!session) throw new Error("Unknown transfer session");
    if (index < 0 || index >= session.totalChunks) throw new Error("Invalid chunk index");

    if (session.received[index]) {
      return { ok: true, alreadyHad: true };
    }

    const chunkPath = path.join(session.chunksDir, `${index}.part`);
    await fs.writeFile(chunkPath, data);
    session.received[index] = true;
    session.receivedCount += 1;
    return { ok: true, alreadyHad: false };
  }

  async finalize(transferId: string) {
    const session = this.sessions.get(transferId);
    if (!session) throw new Error("Unknown transfer session");

    if (session.receivedCount !== session.totalChunks) {
      throw new Error("Not all chunks received");
    }

    const filesBase = path.join(this.baseDir, FILES_DIR);
    const outDir = path.join(filesBase, transferId);
    await ensureDir(outDir);
    const safeName = safeFilename(session.fileName);
    const outPath = path.join(outDir, safeName);

    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(outPath);

      let current = 0;
      const pipeNext = () => {
        if (current >= session.totalChunks) {
          out.end();
          resolve();
          return;
        }

        const chunkPath = path.join(session.chunksDir, `${current}.part`);
        const input = createReadStream(chunkPath);
        input.on("error", reject);
        input.on("end", () => {
          current += 1;
          pipeNext();
        });
        input.pipe(out, { end: false });
      };

      out.on("error", reject);
      pipeNext();
    });

    const sha256 = await sha256File(outPath);
    const finalizedMeta: FinalizedTransfer = { ...session, filePath: outPath, sha256 };
    const mimeType = effectiveMimeType(session.mimeType, session.fileName);
    const metaPath = path.join(outDir, "meta.json");
    await fs.writeFile(
      metaPath,
      JSON.stringify(
        {
          transferId: session.transferId,
          fileName: session.fileName,
          fileSize: session.fileSize,
          mimeType,
          chunkSize: session.chunkSize,
          totalChunks: session.totalChunks,
          mode: session.mode,
          to: session.to,
          fromDeviceId: session.fromDeviceId,
          fromDeviceName: session.fromDeviceName,
          createdAt: session.createdAt,
          sha256
        },
        null,
        2
      ),
      "utf8"
    );

    this.finalized.set(transferId, finalizedMeta);
    return {
      ok: true,
      transferId,
      fileName: session.fileName,
      fileSize: session.fileSize,
      mimeType: session.mimeType,
      sha256
    };
  }

  async readChunk(transferId: string, index: number) {
    const file = this.finalized.get(transferId) ?? (await this.loadFinalizedFromDisk(transferId));
    if (!file) throw new Error("Transfer not finalized");
    if (index < 0) throw new Error("Invalid chunk index");

    const offset = index * file.chunkSize;
    if (offset >= file.fileSize) {
      return { done: true, index, data: Buffer.alloc(0) };
    }

    const length = Math.min(file.chunkSize, file.fileSize - offset);
    const handle = await fs.open(file.filePath, "r");
    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      return { done: false, index, data: buffer.subarray(0, bytesRead) };
    } finally {
      await handle.close();
    }
  }

  getFinalMeta(transferId: string) {
    const file = this.finalized.get(transferId);
    if (!file) return null;
    return {
      transferId: file.transferId,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      chunkSize: file.chunkSize,
      totalChunks: file.totalChunks,
      mode: file.mode,
      to: file.to,
      fromDeviceId: file.fromDeviceId,
      fromDeviceName: file.fromDeviceName,
      createdAt: file.createdAt,
      sha256: file.sha256
    };
  }
}
