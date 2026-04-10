import path from "node:path";
import http from "node:http";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import { DEFAULT_PORT } from "./constants.js";
import { DeviceRegistry } from "./deviceRegistry.js";
import { TransferStore } from "./transfers/transferStore.js";
import type { TransferMeta } from "./transfers/types.js";
import { getLanUrls } from "./utils/ip.js";
import { logError, logInfo, logWarn } from "./logger.js";
import { generateUniqueAutoName, isPlaceholderName, normalizeForCompare } from "./autoNames.js";
import { deleteStoredFile, listStoredFiles, lookupStoredFile } from "./admin/files.js";
import { getLinkPreview } from "./linkPreview.js";

type HelloPayload = {
  deviceId: string;
  deviceToken: string;
  name?: string;
  type: "desktop" | "mobile" | "tablet" | "unknown";
  ua?: string;
};

type ChatMessage = {
  id: string;
  text: string;
  fromDeviceId: string;
  fromDeviceName: string;
  ts: number;
};

const app = express();
app.use(cors());
app.use((req, _res, next) => {
  logInfo(`${req.method} ${req.url}`);
  next();
});
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "throwit-backend" });
});

app.get("/api/link-preview", async (req, res) => {
  const url = String(req.query.url ?? "");
  const preview = await getLinkPreview(url);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.json(preview);
});

app.get("/api/admin/files", async (_req, res) => {
  const data = await listStoredFiles();
  res.json({ ok: true, ...data });
});

app.delete("/api/admin/files/:transferId", async (req, res) => {
  const transferId = String(req.params.transferId ?? "");
  const result = await deleteStoredFile(transferId);
  res.json(result);
});

// Public: list files that are stored on the server (for "Semua")
app.get("/api/files", async (_req, res) => {
  const data = await listStoredFiles();
  // Don't expose sha256 by default in the list UI; keep it for optional verification.
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.json({
    ok: true,
    totalBytes: data.totalBytes,
    items: data.items.map((it) => ({
      transferId: it.transferId,
      fileName: it.fileName,
      mimeType: it.mimeType,
      fileSize: it.fileSize,
      storedBytes: it.storedBytes,
      createdAt: it.createdAt,
      fromDeviceName: it.fromDeviceName
    }))
  });
});

app.get("/api/files/:transferId/download", async (req, res) => {
  const transferId = String(req.params.transferId ?? "");
  const lookup = await lookupStoredFile(transferId);
  if (!lookup.ok) {
    res.status(404).json(lookup);
    return;
  }

  // Force download; never auto-execute/open.
  const safeName = lookup.meta.fileName.replace(/[\r\n"]/g, "_");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  res.setHeader("Content-Length", String(lookup.meta.storedBytes));
  res.sendFile(lookup.filePath);
});

const port = Number(process.env.PORT ?? DEFAULT_PORT);
const server = http.createServer(app);

server.on("error", (err: any) => {
  if (err?.code === "EADDRINUSE") {
    logError(`Port ${port} sedang dipakai (EADDRINUSE).`);
    logInfo("Solusi cepat:");
    logInfo("- Tutup proses lain yang memakai port itu, atau");
    logInfo("- Jalankan dengan port lain, contoh:");
    logInfo("  - PowerShell: `$env:PORT=3001; npm --prefix backend run dev`");
    logInfo("  - Jika pakai `npm run dev` (root), set juga proxy Vite:");
    logInfo("    `$env:PORT=3001; $env:VITE_BACKEND_URL='http://localhost:3001'; npm run dev`");
    process.exit(1);
  }
});

const io = new SocketIOServer(server, {
  cors: { origin: "*" },
  transports: ["websocket"],
  maxHttpBufferSize: 2 * 1024 * 1024
});

const devices = new DeviceRegistry();
const transfers = new TransferStore();

const chatMessages: ChatMessage[] = [];
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function broadcastDevices() {
  io.emit("devices:update", { devices: devices.list() });
}

io.on("connection", (socket) => {
  let deviceId: string | null = null;

  socket.on("hello", (payload: HelloPayload, cb?: (res: unknown) => void) => {
    try {
      deviceId = payload.deviceId;
      const existing = devices.get(payload.deviceId);
      const usedNames = devices.list().map((d) => d.name);

      let assignedName: string | undefined;
      let name = String(payload.name ?? "").trim();
      let nameIsAuto = false;

      if (existing) {
        // Prefer existing name on reconnect if client sends placeholder/empty.
        if (isPlaceholderName(name)) {
          name = existing.name;
          nameIsAuto = existing.nameIsAuto;
        } else {
          nameIsAuto = false;
        }
      } else {
        if (isPlaceholderName(name)) {
          assignedName = generateUniqueAutoName(usedNames, Date.now());
          name = assignedName;
          nameIsAuto = true;
        } else {
          // If custom name collides (same-ish) with an existing one, keep it as-is (allowed),
          // but avoid using it for auto-name pool later.
          nameIsAuto = false;
        }
      }

      // Also avoid case where two clients race with same placeholder name.
      const usedNorm = new Set(devices.list().map((d) => normalizeForCompare(d.name)));
      if (!existing && nameIsAuto && usedNorm.has(normalizeForCompare(name))) {
        assignedName = generateUniqueAutoName(usedNames, Date.now() + Math.floor(Math.random() * 9999));
        name = assignedName;
        nameIsAuto = true;
      }

      devices.upsert({
        deviceId: payload.deviceId,
        deviceToken: payload.deviceToken,
        name,
        nameIsAuto,
        type: payload.type,
        ua: payload.ua,
        socketId: socket.id
      });

      socket.join(payload.deviceId);
      broadcastDevices();
      cb?.({
        ok: true,
        assignedName,
        devices: devices.list(),
        chat: chatMessages.slice(-200)
      });
    } catch (e) {
      cb?.({ ok: false, error: "HELLO_FAILED" });
    }
  });

  socket.on("device:updateName", (payload: { deviceId: string; name: string }) => {
    devices.updateName(payload.deviceId, payload.name);
    broadcastDevices();
  });

  socket.on("chat:send", (payload: { text: string }, cb?: (res: unknown) => void) => {
    if (!deviceId) return cb?.({ ok: false, error: "NO_DEVICE" });
    const from = devices.get(deviceId);
    if (!from) return cb?.({ ok: false, error: "UNKNOWN_DEVICE" });

    const message: ChatMessage = {
      id: makeId(),
      text: String(payload.text ?? "").slice(0, 2000),
      fromDeviceId: from.deviceId,
      fromDeviceName: from.name,
      ts: Date.now()
    };

    chatMessages.push(message);
    if (chatMessages.length > 200) chatMessages.splice(0, chatMessages.length - 200);
    io.emit("chat:new", message);
    cb?.({ ok: true });
  });

  socket.on(
    "transfer:init",
    async (
      meta: Omit<TransferMeta, "fromDeviceId" | "fromDeviceName" | "createdAt">,
      cb?: (res: unknown) => void
    ) => {
      try {
        if (!deviceId) return cb?.({ ok: false, error: "NO_DEVICE" });
        const from = devices.get(deviceId);
        if (!from) return cb?.({ ok: false, error: "UNKNOWN_DEVICE" });

        const createdAt = Date.now();
        const fullMeta: TransferMeta = {
          ...meta,
          fromDeviceId: from.deviceId,
          fromDeviceName: from.name,
          createdAt
        };

        const status = await transfers.init(fullMeta);
        cb?.({ ok: true, status });
      } catch (e) {
        logError("transfer:init failed", e);
        cb?.({ ok: false, error: "INIT_FAILED" });
      }
    }
  );

  socket.on("transfer:resume", async (payload: { transferId: string }, cb?: (res: unknown) => void) => {
    const status = transfers.getStatus(payload.transferId);
    cb?.({ ok: Boolean(status), status });
  });

  socket.on(
    "transfer:chunk",
    async (
      payload: { transferId: string; index: number; data: ArrayBuffer },
      cb?: (res: unknown) => void
    ) => {
      try {
        const buffer = Buffer.from(payload.data);
        const result = await transfers.writeChunk(payload.transferId, payload.index, buffer);
        cb?.(result);
      } catch {
        cb?.({ ok: false, error: "CHUNK_FAILED" });
      }
    }
  );

  socket.on("transfer:finalize", async (payload: { transferId: string }, cb?: (res: unknown) => void) => {
    try {
      const result = await transfers.finalize(payload.transferId);
      const meta = transfers.getFinalMeta(payload.transferId);
      if (!meta) return cb?.({ ok: false, error: "NO_META" });

      if (meta.to.type === "all") {
        socket.broadcast.emit("transfer:available", meta);
      } else {
        io.to(meta.to.deviceId).emit("transfer:available", meta);
      }

      cb?.(result);
    } catch (e) {
      logError("transfer:finalize failed", e);
      cb?.({ ok: false, error: "FINALIZE_FAILED" });
    }
  });

  socket.on(
    "transfer:download:get",
    async (payload: { transferId: string; index: number }, cb?: (res: unknown) => void) => {
      try {
        const chunk = await transfers.readChunk(payload.transferId, payload.index);
        cb?.({ ok: true, ...chunk });
      } catch {
        cb?.({ ok: false, error: "DOWNLOAD_FAILED" });
      }
    }
  );

  socket.on("disconnect", () => {
    devices.removeBySocketId(socket.id);
    broadcastDevices();
  });
});

async function ensureStorage() {
  const dir = path.join(process.cwd(), "storage");
  await fs.mkdir(dir, { recursive: true });
}

async function start() {
  await ensureStorage();

  // Serve built frontend (optional). In dev, use Vite dev server.
  const baseDir = path.dirname(fileURLToPath(import.meta.url));
  const frontendDist = path.resolve(baseDir, "..", "..", "frontend", "dist");
  let servingFrontend = false;
  try {
    const stat = await fs.stat(frontendDist);
    if (stat.isDirectory()) {
      logInfo("Serving frontend build from frontend/dist");
      servingFrontend = true;
      app.use(express.static(frontendDist));
      app.get("*", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
    }
  } catch {
    logWarn("No frontend build found (frontend/dist). Run `npm run build` for production mode.");
  }

  server.listen(port, "0.0.0.0", () => {
    logInfo(`ThrowIt backend listening on port ${port}`);
    const urls = getLanUrls(port);
    if (urls.length) {
      logInfo("Akses ThrowIt dari perangkat lain (LAN):");
      for (const url of urls) logInfo(`- ${url}`);
      if (!servingFrontend) {
        const uiUrls = getLanUrls(5173);
        if (uiUrls.length) {
          logInfo("Dev UI (Vite) untuk perangkat lain:");
          for (const url of uiUrls) logInfo(`- ${url}`);
        }
      }
    } else {
      logInfo(`Akses lokal: http://localhost:${port}`);
    }
  });
}

start().catch((e) => {
  logError("Failed to start server", e);
  process.exit(1);
});
