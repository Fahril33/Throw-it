import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { formatBytes } from "../utils/format";
import { uuidv4 } from "../utils/id";
import type { TransferMeta, TransferTarget } from "../socket/types";
import {
  addReceivedHistory,
  clearTransferHistory,
  loadTransferHistory,
  saveTransferHistory,
  type TransferHistoryItem
} from "../storage/local";

export type UiTransfer = {
  transferId: string;
  direction: "out" | "in";
  fileName: string;
  fileSize: number;
  mimeType: string;
  toLabel: string;
  fromLabel: string;
  mode: "fast" | "balanced";
  status: "queued" | "transferring" | "paused" | "finalizing" | "ready" | "done" | "error" | "canceled";
  createdAt: number;
  finishedAt?: number;
  progressBytes: number;
  totalBytes: number;
  speedBps: number;
  speedSamples: number[];
  error?: string;
  meta?: TransferMeta;
};

function chunkConfig(mode: "fast" | "balanced") {
  if (mode === "fast") return { chunkSize: 1024 * 1024, concurrency: 4 };
  return { chunkSize: 256 * 1024, concurrency: 2 };
}

async function emitWithTimeout<T>(
  socket: Socket,
  event: string,
  payload: unknown,
  timeoutMs = 15000
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
    socket.emit(event, payload, (res: T) => {
      window.clearTimeout(timer);
      resolve(res);
    });
  });
}

function toUint8Array(raw: any) {
  if (!raw) return new Uint8Array();
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  if (raw?.type === "Buffer" && Array.isArray(raw.data)) return new Uint8Array(raw.data);
  if (Array.isArray(raw)) return new Uint8Array(raw);
  throw new Error("UNSUPPORTED_BINARY");
}

export function useTransfers(socket: Socket | null) {
  const MAX_PARALLEL_UPLOADS = 5;
  const [transfers, setTransfers] = useState<UiTransfer[]>(() => {
    const persisted = loadTransferHistory();
    return persisted.map(
      (p): UiTransfer => ({
        transferId: p.transferId,
        direction: p.direction,
        fileName: p.fileName,
        fileSize: p.fileSize,
        mimeType: p.mimeType,
        toLabel: p.toLabel,
        fromLabel: p.fromLabel,
        mode: p.mode,
        status: p.status,
        createdAt: Number.isFinite(p.createdAt) ? p.createdAt : 0,
        finishedAt: Number.isFinite(p.finishedAt) ? p.finishedAt : undefined,
        progressBytes: p.status === "done" ? p.fileSize : 0,
        totalBytes: p.fileSize,
        speedBps: 0,
        speedSamples: [],
        error: p.error,
        meta: p.meta
      })
    );
  });
  const transfersRef = useRef<UiTransfer[]>(transfers);
  useEffect(() => {
    transfersRef.current = transfers;
  }, [transfers]);

  const uploadControllers = useRef(new Map<string, AbortController>());
  const downloadControllers = useRef(new Map<string, AbortController>());
  const abortReasons = useRef(new Map<string, "pause" | "cancel">());
  const activeUploads = useRef(0);
  const outgoingFiles = useRef(
    new Map<
      string,
      { file: File; to: TransferTarget; toLabel: string; mode: "fast" | "balanced"; chunkSize: number; totalChunks: number }
    >()
  );
  const getOutgoingFile = useCallback((transferId: string) => {
    return outgoingFiles.current.get(transferId)?.file;
  }, []);
  const incomingProgress = useRef(new Map<string, { nextIndex: number }>());

  useEffect(() => {
    const serializable: TransferHistoryItem[] = transfers
      .filter((t) => t.status === "ready" || t.status === "done" || t.status === "error" || t.status === "canceled")
      .map((t) => ({
        transferId: t.transferId,
        direction: t.direction,
        fileName: t.fileName,
        fileSize: t.fileSize,
        mimeType: t.mimeType,
        toLabel: t.toLabel,
        fromLabel: t.fromLabel,
        mode: t.mode,
        createdAt: t.createdAt,
        finishedAt: t.finishedAt,
        status: t.status === "ready" ? "ready" : t.status === "done" ? "done" : t.status === "canceled" ? "canceled" : "error",
        error: t.error,
        meta: t.meta
      }));
    saveTransferHistory(serializable);
  }, [transfers]);

  const upsert = useCallback((transferId: string, patch: Partial<UiTransfer>) => {
    setTransfers((prev) => {
      const idx = prev.findIndex((t) => t.transferId === transferId);
      if (idx === -1) {
        const next = [{ ...patch, transferId } as UiTransfer, ...prev];
        transfersRef.current = next;
        return next;
      }
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch };
      transfersRef.current = next;
      return next;
    });
  }, []);

  const addIncoming = useCallback(
    (meta: TransferMeta) => {
      upsert(meta.transferId, {
        direction: "in",
        fileName: meta.fileName,
        fileSize: meta.fileSize,
        mimeType: meta.mimeType,
        toLabel: meta.to.type === "all" ? "Semua Perangkat" : "Saya",
        fromLabel: meta.fromDeviceName,
        mode: meta.mode,
        status: "ready",
        createdAt: meta.createdAt,
        progressBytes: 0,
        totalBytes: meta.fileSize,
        speedBps: 0,
        speedSamples: [],
        meta
      });
    },
    [upsert]
  );

  useEffect(() => {
    if (!socket) return;
    const onAvailable = (meta: TransferMeta) => addIncoming(meta);
    socket.on("transfer:available", onAvailable);
    return () => {
      socket.off("transfer:available", onAvailable);
    };
  }, [socket, addIncoming]);

  const enqueueOutgoing = useCallback(
    (file: File, to: TransferTarget, toLabel: string, mode: "fast" | "balanced", fromLabel: string, createdAt: number) => {
      const transferId = uuidv4();
      const { chunkSize } = chunkConfig(mode);
      const totalChunks = Math.ceil(file.size / chunkSize);

      upsert(transferId, {
        direction: "out",
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        toLabel,
        fromLabel,
        mode,
        status: "queued",
        createdAt,
        progressBytes: 0,
        totalBytes: file.size,
        speedBps: 0,
        speedSamples: []
      });

      outgoingFiles.current.set(transferId, { file, to, toLabel, mode, chunkSize, totalChunks });
      return transferId;
    },
    [upsert]
  );

  const startUpload = useCallback(
    async (transferId: string) => {
      if (!socket) return;
      if (uploadControllers.current.has(transferId)) return;
      if (activeUploads.current >= MAX_PARALLEL_UPLOADS) return;

      const cfg = outgoingFiles.current.get(transferId);
      if (!cfg) {
        upsert(transferId, { status: "error", error: "File tidak tersedia.", finishedAt: Date.now() });
        return;
      }

      const current = transfersRef.current.find((t) => t.transferId === transferId);
      if (current && current.status !== "queued") return;

      activeUploads.current += 1;
      const controller = new AbortController();
      uploadControllers.current.set(transferId, controller);
      abortReasons.current.delete(transferId);

      const { file, to, mode, chunkSize, totalChunks } = cfg;
      upsert(transferId, { status: "transferring", error: undefined });

      const lastBytesRef = { bytes: 0, ts: Date.now() };
      const speedTimer = window.setInterval(() => {
        setTransfers((prev) => {
          const idx = prev.findIndex((t) => t.transferId === transferId);
          if (idx === -1) return prev;
          const now = Date.now();
          const b = prev[idx].progressBytes;
          const dt = Math.max(1, now - lastBytesRef.ts);
          const db = Math.max(0, b - lastBytesRef.bytes);
          const speed = (db / dt) * 1000;
          lastBytesRef.bytes = b;
          lastBytesRef.ts = now;
          const next = prev.slice();
          const samples = [...next[idx].speedSamples, speed].slice(-40);
          next[idx] = { ...next[idx], speedBps: speed, speedSamples: samples };
          return next;
        });
      }, 1000);

      try {
        const initRes: any = await emitWithTimeout(socket, "transfer:init", {
          transferId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          chunkSize,
          totalChunks,
          mode,
          to
        });

        const received = new Set<number>(initRes?.status?.receivedIndexes ?? []);
        const { concurrency } = chunkConfig(mode);
        const effectiveConcurrency = activeUploads.current > 1 ? Math.min(concurrency, 2) : concurrency;

        const sendChunk = async (index: number) => {
          if (controller.signal.aborted) return;
          const start = index * chunkSize;
          const end = Math.min(file.size, start + chunkSize);
          const slice = file.slice(start, end);
          const buf = await slice.arrayBuffer();
          const res: any = await emitWithTimeout(socket, "transfer:chunk", { transferId, index, data: buf }, 20000);
          if (!res?.ok) throw new Error("CHUNK_FAILED");
          received.add(index);
          const bytesNow = Math.min(file.size, received.size * chunkSize);
          upsert(transferId, { progressBytes: Math.min(file.size, bytesNow) });
        };

        let batch: Promise<void>[] = [];
        for (let i = 0; i < totalChunks; i++) {
          if (controller.signal.aborted) throw new Error("ABORTED");
          if (received.has(i)) continue;
          batch.push(sendChunk(i));
          if (batch.length >= effectiveConcurrency) {
            await Promise.all(batch);
            batch = [];
          }
        }
        if (batch.length) await Promise.all(batch);

        if (controller.signal.aborted) throw new Error("ABORTED");
        upsert(transferId, { status: "finalizing", progressBytes: file.size });
        const fin: any = await emitWithTimeout(socket, "transfer:finalize", { transferId }, 30000);
        if (!fin?.ok) throw new Error("FINALIZE_FAILED");
        upsert(transferId, { status: "done", finishedAt: Date.now(), progressBytes: file.size });
      } catch (e: any) {
        if (String(e?.message) === "ABORTED") {
          const reason = abortReasons.current.get(transferId) ?? "pause";
          if (reason === "cancel") upsert(transferId, { status: "canceled", finishedAt: Date.now(), error: undefined });
          else upsert(transferId, { status: "paused" });
        } else if (String(e?.message) === "TIMEOUT") {
          upsert(transferId, { status: "paused", error: "Koneksi terputus. Siap di-resume." });
        } else {
          upsert(transferId, { status: "error", error: "Transfer gagal.", finishedAt: Date.now() });
        }
      } finally {
        window.clearInterval(speedTimer);
        uploadControllers.current.delete(transferId);
        abortReasons.current.delete(transferId);
        activeUploads.current = Math.max(0, activeUploads.current - 1);
        // Continue draining queue after a slot frees up.
        const queued = transfersRef.current
          .filter((t) => t.direction === "out" && t.status === "queued")
          .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
        const canStart = Math.max(0, MAX_PARALLEL_UPLOADS - activeUploads.current);
        for (const t of queued.slice(0, canStart)) {
          void startUpload(t.transferId);
        }
      }
    },
    [socket, upsert]
  );

  const runOutgoingQueue = useCallback(() => {
    const queued = transfersRef.current
      .filter((t) => t.direction === "out" && t.status === "queued")
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    const canStart = Math.max(0, MAX_PARALLEL_UPLOADS - activeUploads.current);
    for (const t of queued.slice(0, canStart)) {
      void startUpload(t.transferId);
    }
  }, [startUpload]);

  const sendFiles = useCallback(
    async (
      files: File[],
      to: TransferTarget,
      toLabel: string,
      mode: "fast" | "balanced",
      fromLabel = "Saya"
    ) => {
      if (!socket) return;

      const base = Date.now();
      const ids = files.map((file, idx) => enqueueOutgoing(file, to, toLabel, mode, fromLabel, base + idx));

      // Single file: start immediately (current behavior).
      // Multi file: queue first, let user confirm by pressing "Send all".
      if (ids.length === 1) {
        void startUpload(ids[0]);
      }
    },
    [socket, enqueueOutgoing, startUpload]
  );

  const resumeUpload = useCallback(
    async (transferId: string) => {
      if (!socket) return;
      if (uploadControllers.current.has(transferId)) return;
      if (activeUploads.current >= MAX_PARALLEL_UPLOADS) return;
      const cfg = outgoingFiles.current.get(transferId);
      if (!cfg) return;

      activeUploads.current += 1;
      const controller = new AbortController();
      uploadControllers.current.set(transferId, controller);
      abortReasons.current.delete(transferId);
      upsert(transferId, { status: "transferring", error: undefined });

      const resumeRes: any = await emitWithTimeout(socket, "transfer:resume", { transferId }, 12000);
      let received = new Set<number>(resumeRes?.status?.receivedIndexes ?? []);
      if (!resumeRes?.ok) {
        const initRes: any = await emitWithTimeout(socket, "transfer:init", {
          transferId,
          fileName: cfg.file.name,
          fileSize: cfg.file.size,
          mimeType: cfg.file.type || "application/octet-stream",
          chunkSize: cfg.chunkSize,
          totalChunks: cfg.totalChunks,
          mode: cfg.mode,
          to: cfg.to
        });
        received = new Set<number>(initRes?.status?.receivedIndexes ?? []);
      }

      try {
        const { concurrency } = chunkConfig(cfg.mode);
        const effectiveConcurrency = activeUploads.current > 1 ? Math.min(concurrency, 2) : concurrency;
        const sendChunk = async (index: number) => {
          if (controller.signal.aborted) return;
          const start = index * cfg.chunkSize;
          const end = Math.min(cfg.file.size, start + cfg.chunkSize);
          const slice = cfg.file.slice(start, end);
          const buf = await slice.arrayBuffer();
          const res: any = await emitWithTimeout(
            socket,
            "transfer:chunk",
            { transferId, index, data: buf },
            20000
          );
          if (!res?.ok) throw new Error("CHUNK_FAILED");
          received.add(index);
          const bytesNow = Math.min(cfg.file.size, received.size * cfg.chunkSize);
          upsert(transferId, { progressBytes: Math.min(cfg.file.size, bytesNow) });
        };

        let batch: Promise<void>[] = [];
        for (let i = 0; i < cfg.totalChunks; i++) {
          if (controller.signal.aborted) throw new Error("ABORTED");
          if (received.has(i)) continue;
          batch.push(sendChunk(i));
          if (batch.length >= effectiveConcurrency) {
            await Promise.all(batch);
            batch = [];
          }
        }
        if (batch.length) await Promise.all(batch);

        if (controller.signal.aborted) throw new Error("ABORTED");
        upsert(transferId, { status: "finalizing", progressBytes: cfg.file.size });
        const fin: any = await emitWithTimeout(socket, "transfer:finalize", { transferId }, 30000);
        if (!fin?.ok) throw new Error("FINALIZE_FAILED");
        upsert(transferId, { status: "done", progressBytes: cfg.file.size, finishedAt: Date.now() });
      } catch (e: any) {
        if (String(e?.message) === "ABORTED") {
          const reason = abortReasons.current.get(transferId) ?? "pause";
          if (reason === "cancel") upsert(transferId, { status: "canceled", finishedAt: Date.now(), error: undefined });
          else upsert(transferId, { status: "paused" });
        } else {
          upsert(transferId, { status: "error", error: "Transfer gagal saat resume.", finishedAt: Date.now() });
        }
      } finally {
        uploadControllers.current.delete(transferId);
        abortReasons.current.delete(transferId);
        activeUploads.current = Math.max(0, activeUploads.current - 1);
        runOutgoingQueue();
      }
    },
    [socket, upsert, runOutgoingQueue]
  );

  const pause = useCallback(
    (transferId: string) => {
      const c = uploadControllers.current.get(transferId) ?? downloadControllers.current.get(transferId);
      abortReasons.current.set(transferId, "pause");
      c?.abort();
      upsert(transferId, { status: "paused" });
    },
    [upsert]
  );

  const cancel = useCallback(
    (transferId: string) => {
      const upload = uploadControllers.current.get(transferId);
      const download = downloadControllers.current.get(transferId);
      abortReasons.current.set(transferId, "cancel");
      upload?.abort();
      download?.abort();

      const t = transfersRef.current.find((x) => x.transferId === transferId);
      if (t?.status === "queued") {
        upsert(transferId, { status: "canceled", finishedAt: Date.now(), error: undefined });
      }

      outgoingFiles.current.delete(transferId);
      incomingProgress.current.delete(transferId);
    },
    [upsert]
  );

  const download = useCallback(
    async (transfer: UiTransfer) => {
      if (!socket || !transfer.meta) {
        // Fallback: allow downloading stored file from server (works after refresh too).
        const a = document.createElement("a");
        a.href = `/api/files/${transfer.transferId}/download`;
        a.download = transfer.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      const transferId = transfer.transferId;
      const meta = transfer.meta;
      const controller = new AbortController();
      downloadControllers.current.set(transferId, controller);
      abortReasons.current.delete(transferId);

      upsert(transferId, { status: "transferring", progressBytes: 0 });
      const progress = incomingProgress.current.get(transferId) ?? { nextIndex: 0 };
      incomingProgress.current.set(transferId, progress);

      const lastBytesRef = { bytes: 0, ts: Date.now() };
      const speedTimer = window.setInterval(() => {
        setTransfers((prev) => {
          const idx = prev.findIndex((t) => t.transferId === transferId);
          if (idx === -1) return prev;
          const now = Date.now();
          const b = prev[idx].progressBytes;
          const dt = Math.max(1, now - lastBytesRef.ts);
          const db = Math.max(0, b - lastBytesRef.bytes);
          const speed = (db / dt) * 1000;
          lastBytesRef.bytes = b;
          lastBytesRef.ts = now;
          const next = prev.slice();
          const samples = [...next[idx].speedSamples, speed].slice(-40);
          next[idx] = { ...next[idx], speedBps: speed, speedSamples: samples };
          return next;
        });
      }, 1000);

      let writable: any = null;
      const chunks: ArrayBuffer[] = [];
      try {
        if ("showSaveFilePicker" in window) {
          // @ts-expect-error optional API
          const handle = await window.showSaveFilePicker({
            suggestedName: meta.fileName
          });
          writable = await handle.createWritable();
        }

        for (let index = progress.nextIndex; ; index++) {
          if (controller.signal.aborted) throw new Error("ABORTED");
          const res: any = await emitWithTimeout(socket, "transfer:download:get", { transferId, index }, 20000);
          if (!res?.ok) throw new Error("DOWNLOAD_FAILED");
          if (res.done) break;

          const data = toUint8Array(res.data);

          if (writable) {
            await writable.write(data);
          } else {
            chunks.push(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
          }

          const bytes = Math.min(meta.fileSize, (index + 1) * meta.chunkSize);
          upsert(transferId, { progressBytes: bytes });
          progress.nextIndex = index + 1;
        }

        if (writable) {
          await writable.close();
        } else {
          const blob = new Blob(chunks, { type: meta.mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = meta.fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }

        addReceivedHistory({
          transferId,
          fileName: meta.fileName,
          fileSize: meta.fileSize,
          fromDeviceName: meta.fromDeviceName,
          mode: meta.mode,
          receivedAt: Date.now(),
          sha256: meta.sha256
        });

        upsert(transferId, { status: "done", progressBytes: meta.fileSize, finishedAt: Date.now() });
      } catch (e: any) {
        if (String(e?.message) === "ABORTED") {
          const reason = abortReasons.current.get(transferId) ?? "pause";
          if (reason === "cancel") upsert(transferId, { status: "canceled", finishedAt: Date.now(), error: undefined });
          else upsert(transferId, { status: "paused" });
        } else {
          upsert(transferId, { status: "error", error: "Download gagal.", finishedAt: Date.now() });
          try {
            await writable?.abort();
          } catch {
            // ignore
          }
        }
      } finally {
        window.clearInterval(speedTimer);
        downloadControllers.current.delete(transferId);
        abortReasons.current.delete(transferId);
      }
    },
    [socket, upsert]
  );

  const resumeDownload = useCallback(
    async (transferId: string) => {
      const t = transfers.find((x) => x.transferId === transferId);
      if (!t) return;
      await download(t);
    },
    [download, transfers]
  );

  const clear = useCallback(() => {
    setTransfers([]);
    clearTransferHistory();
  }, []);

  const removeTransfers = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    setTransfers((prev) => prev.filter((t) => !idSet.has(t.transferId)));
  }, []);

  const importServerFiles = useCallback(
    (
      items: Array<{
        transferId: string;
        fileName: string;
        fileSize: number;
        mimeType?: string;
        createdAt: number;
        fromDeviceName?: string;
      }>
    ) => {
      for (const it of items) {
        if (!it?.transferId) continue;
        upsert(it.transferId, {
          direction: "in",
          fileName: it.fileName,
          fileSize: it.fileSize,
          mimeType: it.mimeType || "application/octet-stream",
          toLabel: "Saya",
          fromLabel: it.fromDeviceName || "Server",
          mode: "balanced",
          status: "ready",
          createdAt: Number.isFinite(it.createdAt) ? it.createdAt : Date.now(),
          progressBytes: 0,
          totalBytes: it.fileSize,
          speedBps: 0,
          speedSamples: []
        });
      }
    },
    [upsert]
  );

  const summary = useMemo(() => {
    const active = transfers.filter((t) => t.status === "transferring" || t.status === "finalizing");
    const totalSpeed = active.reduce((acc, t) => acc + (t.speedBps || 0), 0);
    return {
      activeCount: active.length,
      totalSpeedLabel: formatBytes(totalSpeed) + "/s"
    };
  }, [transfers]);

  return {
    transfers,
    sendFiles,
    runOutgoingQueue,
    pause,
    cancel,
    download,
    resumeUpload,
    resumeDownload,
    clear,
    removeTransfers,
    importServerFiles,
    summary,
    getOutgoingFile
  };
}
