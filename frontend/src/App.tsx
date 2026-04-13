import React, { useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  ClipboardPaste,
  Download,
  Info,
  RefreshCcw,
  Send,
  SlidersHorizontal,
  Zap,
  ShieldAlert,
  Eye,
  Sparkles
} from "lucide-react";
import HeaderBar from "./components/HeaderBar";
import SidebarDevices from "./components/SidebarDevices";
import DropZone from "./components/DropZone";
import ChatSidebar from "./components/ChatSidebar";
import SpeedGraph from "./components/SpeedGraph";
import { useThrowItSocket } from "./socket/useThrowItSocket";
import { getDeviceName } from "./storage/local";
import { useTransfers, type UiTransfer } from "./transfers/useTransfers";
import { formatBytes, formatTime } from "./utils/format";
import Admin from "./pages/Admin";
import { useMediaQuery } from "./utils/useMediaQuery";
import Modal from "./components/Modal";
import PasteFilesModal from "./components/modals/PasteFilesModal";

type Selected = { type: "all" } | { type: "device"; deviceId: string };

function TransfersPanel(props: {
  items: UiTransfer[];
  onPause: (id: string) => void;
  onDownload: (t: UiTransfer) => void;
  onResumeUpload: (id: string) => void;
  onResumeDownload: (id: string) => void;
  onClear: () => void;
  onPreview: (t: UiTransfer) => void;
  onLoadServerFiles: () => void;
}) {
  const [mode, setMode] = useState<"sent" | "received" | "all">("all");
  const [spin, setSpin] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [wrapName, setWrapName] = useState<Record<string, boolean>>({});
  const [dateFilter, setDateFilter] = useState<string>("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [patchNotesOpen, setPatchNotesOpen] = useState(false);

  const historyLabel = mode === "sent" ? "Riwayat Dikirim" : mode === "received" ? "Riwayat Diterima" : "Semua Riwayat";

  const cycleMode = () => {
    setSpin(true);
    window.setTimeout(() => setSpin(false), 650);
    setMode((m) => (m === "sent" ? "received" : m === "received" ? "all" : "sent"));
  };

  const dateMatches = (ts: number) => {
    if (!dateFilter) return true;
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}` === dateFilter;
  };

  const transfersSorted = useMemo(() => {
    const sorted = props.items.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const filtered = sorted.filter((t) => dateMatches(t.createdAt));

    // Semua mode bersifat global (tanpa filter target/pengirim tertentu).
    if (mode === "sent") return filtered.filter((t) => t.direction === "out");
    if (mode === "received") return filtered.filter((t) => t.direction === "in");
    return filtered;
  }, [props.items, mode, dateFilter]);

  return (
    <>
      <div className="historyHeader">
        <button
          className="historyTitle"
          style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer" }}
          onClick={cycleMode}
          title="Klik untuk ganti mode riwayat"
        >
          <span style={{ display: "inline-flex", transform: spin ? "rotate(360deg)" : "none", transition: "transform 650ms" }}>
            <RefreshCcw size={14} color="rgba(255,255,255,0.7)" />
          </span>
          {historyLabel.toUpperCase()}
        </button>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btnSmall" onClick={props.onLoadServerFiles} title="Lihat file di server (Semua)">
            <RefreshCcw size={16} />
            <span style={{ marginLeft: 6, fontSize: 11 }}>Server Files</span>
          </button>
          <button className="btn btnSmall" onClick={() => setFilterOpen(true)} title="Filter tanggal">
            <Calendar size={16} />
          </button>
          <button className="btn btnSmall btnDanger" onClick={props.onClear} title="Hapus riwayat transfer (lokal)">
            Hapus semua
          </button>
        </div>
      </div>
      <div className="historyList">
        {transfersSorted.length === 0 ? (
          <div className="emptyState">Belum ada transfer.</div>
        ) : (
          transfersSorted.map((t) => {
            const pct = t.totalBytes > 0 ? Math.round((t.progressBytes / t.totalBytes) * 100) : 0;
            const stripe =
              t.direction === "out" ? "rgba(255,47,214,0.7)" : t.status === "done" ? "rgba(46,229,157,0.7)" : "rgba(255,255,255,0.18)";
            return (
              <div
                className="transferRow"
                key={t.transferId}
                style={{ borderLeft: `2px solid ${stripe}`, paddingLeft: 10 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    className={`transferName ${wrapName[t.transferId] ? "wrap" : ""}`}
                    role="button"
                    tabIndex={0}
                    title={wrapName[t.transferId] ? "Klik untuk potong" : "Klik untuk wrap"}
                    onClick={() => setWrapName((p) => ({ ...p, [t.transferId]: !p[t.transferId] }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setWrapName((p) => ({ ...p, [t.transferId]: !p[t.transferId] }));
                      }
                    }}
                  >
                    {t.fileName}
                  </div>
                  <div className="transferMeta">
                    <span>
                      {t.fromLabel} ~ {t.toLabel}
                    </span>
                    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      {t.direction === "out" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                      {formatTime(t.direction === "out" ? t.createdAt : t.finishedAt ?? t.createdAt)}
                    </span>
                  </div>
                  {t.status === "transferring" || t.status === "finalizing" ? (
                    <div className="progress" title={`${pct}%`}>
                      <div className="progressBar" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                    </div>
                  ) : null}
                </div>

                <div className="rowActions">
                  {t.status === "transferring" || t.status === "finalizing" ? (
                    <>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: 800 }}>
                        {formatBytes(t.speedBps)}/s
                      </div>
                      <SpeedGraph samples={t.speedSamples} />
                    </>
                  ) : null}
                  {t.direction === "in" && (t.status === "ready" || t.status === "paused") ? (
                    <button className="btn btnSmall btnPrimary" onClick={() => props.onDownload(t)} title="Download">
                      <Download size={16} />
                    </button>
                  ) : null}
                  {t.direction === "in" && t.status === "done" ? (
                    <div
                      title="Terunduh (double click untuk download ulang)"
                      role="button"
                      tabIndex={0}
                      style={{ cursor: "pointer", display: "inline-flex" }}
                      onDoubleClick={() => props.onDownload(t)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") props.onDownload(t);
                      }}
                    >
                      <Check size={18} color="rgba(46,229,157,0.9)" />
                    </div>
                  ) : null}
                  {t.direction === "out" && t.status === "paused" ? (
                    <button className="btn btnSmall btnPrimary" onClick={() => props.onResumeUpload(t.transferId)}>
                      Resume
                    </button>
                  ) : null}
                  {t.direction === "in" && t.status === "paused" ? (
                    <button className="btn btnSmall btnPrimary" onClick={() => props.onResumeDownload(t.transferId)}>
                      Resume
                    </button>
                  ) : null}
                  {t.status === "transferring" || t.status === "finalizing" ? (
                    <button className="btn btnSmall" onClick={() => props.onPause(t.transferId)}>
                      Pause
                    </button>
                  ) : null}
                  <button
                    className="btn btnSmall"
                    onClick={() => props.onPreview(t)}
                    title="Preview File"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    className="btn btnSmall"
                    onClick={() => setExpanded((p) => ({ ...p, [t.transferId]: !p[t.transferId] }))}
                    title="Detail"
                  >
                    <Info size={16} />
                  </button>
                </div>

                {expanded[t.transferId] ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      marginTop: 8,
                      color: "rgba(255,255,255,0.65)",
                      fontSize: 12,
                      overflowWrap: "anywhere",
                      wordBreak: "break-word"
                    }}
                  >
                    <div>Ukuran: {formatBytes(t.fileSize)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      Mode:
                      {t.mode === "fast" ? (
                        <span title="Fast" aria-label="Fast" style={{ display: "inline-flex" }}>
                          <Zap size={14} />
                        </span>
                      ) : (
                        <span title="Balanced" aria-label="Balanced" style={{ display: "inline-flex" }}>
                          <SlidersHorizontal size={14} />
                        </span>
                      )}
                    </div>
                    <div>Status: {t.status}</div>
                    <div>ID: {t.transferId}</div>
                    {t.finishedAt ? <div>Selesai: {formatTime(t.finishedAt)}</div> : null}
                    {t.error ? <div>Error: {t.error}</div> : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div style={{ padding: "0 14px 14px", color: "rgba(255,255,255,0.55)", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span>
            <span style={{ display: "inline-block", width: 10, height: 10, borderLeft: "2px solid rgba(255,47,214,0.8)", marginRight: 6 }} />
            Upload
          </span>
          <span>
            <span style={{ display: "inline-block", width: 10, height: 10, borderLeft: "2px solid rgba(46,229,157,0.8)", marginRight: 6 }} />
            Diterima
          </span>
        </span>
        <button 
          className="btn btnSmall" 
          onClick={() => setPatchNotesOpen(true)}
          style={{ background: "transparent", padding: "4px 8px", fontSize: 11 }}
        >
          <Sparkles size={14} style={{ marginRight: 4 }} />
          Patch Notes
        </button>
      </div>

      <Modal title="Filter Tanggal" open={filterOpen} onClose={() => setFilterOpen(false)}>
        <input className="input" type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        <div className="modalActions">
          <button className="btn btnSmall" onClick={() => setDateFilter("")}>
            Reset
          </button>
          <button className="btn btnPrimary btnSmall" onClick={() => setFilterOpen(false)}>
            Terapkan
          </button>
        </div>
      </Modal>

      <Modal title="Patch Notes" open={patchNotesOpen} onClose={() => setPatchNotesOpen(false)}>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, lineHeight: 1.6, maxHeight: "300px", overflowY: "auto", paddingRight: 4 }}>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 4px", color: "#fff" }}>v2.1.1 - History & PDF Preview Fix</h4>
            <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.7)" }}>
              <li><strong>Riwayat setelah refresh:</strong> Preview & download dari list riwayat tetap bisa (mengambil dari file server saat tersedia).</li>
              <li><strong>PDF server:</strong> PDF akan di-preview inline via iframe (bukan langsung terunduh) jika server mengirim header yang sesuai.</li>
              <li><strong>Muat file server:</strong> Opsi "Muat file dari server" dipindahkan dari popover "Pilih Target" ke area preview/riwayat (Server Files).</li>
              <li><strong>Fallback aman:</strong> Jika tipe file/response tidak mendukung preview, area preview menampilkan pesan “Preview tidak didukung”.</li>
            </ul>
          </div>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 4px", color: "#fff" }}>v2.1.0 - File Preview & UI Enhancements</h4>
            <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.7)" }}>
              <li><strong>Preview Area:</strong> Sekarang kamu dapat melihat preview (gambar, video, PDF) langsung dari panel baru yang tergabung pada chat. Klik ikon "Mata" pada riwayat transfer.</li>
              <li><strong>Navigasi Cepat:</strong> Tab chat diperbarui agar lebih responsif terhadap perubahan dan mudah digunakan pada desktop.</li>
              <li><strong>UI Footer:</strong> Menambahkan tombol Patch Notes baru untuk melihat pembaruan aplikasi secara langsung.</li>
            </ul>
          </div>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 4px", color: "#fff" }}>v2.0.0 - Major Overhaul</h4>
            <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.7)" }}>
              <li>Penambahan dukungan multi-device discovery secara real-time.</li>
              <li>Perbaikan kestabilan transfer file peer-to-peer dan handling timeout.</li>
              <li>Optimasi pengiriman file batch.</li>
            </ul>
          </div>
        </div>
        <div className="modalActions" style={{ marginTop: 12 }}>
          <button className="btn btnPrimary btnSmall" onClick={() => setPatchNotesOpen(false)}>
            Tutup
          </button>
        </div>
      </Modal>
    </>
  );
}

function MainPanel(props: {
  selected: Selected;
  toLabel: string;
  compact: boolean;
  mode: "fast" | "balanced";
  setMode: (m: "fast" | "balanced") => void;
  onFiles: (files: File[]) => void;
  onPasteClick: () => void;
  onPickTarget: () => void;
  transfers: UiTransfer[];
  onPause: (id: string) => void;
  onDownload: (t: UiTransfer) => void;
  onResumeUpload: (id: string) => void;
  onResumeDownload: (id: string) => void;
  onClearTransfers: () => void;
  onPreview: (t: UiTransfer) => void;
  onPreviewDirect: (url: string, mimeType: string, name: string) => void;
  onLoadServerFiles: () => void;
}) {
  const nav = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === "/";
  const isAdmin = location.pathname === "/admin";
  const sendToText = props.selected.type === "all" ? "Semua" : props.toLabel;

  return (
    <div className="panel">
      <div className="mainTop">
        {!props.compact ? (
          <button className="targetBtn" onClick={props.onPickTarget} title="Pilih target">
            <Send size={16} color="rgba(255,255,255,0.85)" />
            <div className="targetText">{sendToText}</div>
            <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
          </button>
        ) : (
          <div />
        )}

        <div className="toggleRow">
          <div className="seg" title="Mode transfer">
            <button className={props.mode === "fast" ? "active" : ""} onClick={() => props.setMode("fast")}>
              Fast
            </button>
            <button
              className={props.mode === "balanced" ? "active" : ""}
              onClick={() => props.setMode("balanced")}
            >
              Balanced
            </button>
          </div>

          {isAdmin ? (
            <div className="seg" title="Admin">
              <button className="active" onClick={() => nav("/admin")}>
                Admin
              </button>
              <button onClick={() => nav("/")}>Kembali</button>
            </div>
          ) : null}
        </div>
      </div>

      <Routes>
        <Route
          path="/"
          element={
            <>
              <div className="sendRow">
                <DropZone onFiles={props.onFiles} style={{ height: "100%" }} />
                <button className="pasteBtn" onClick={props.onPasteClick} title="Paste file dari clipboard">
                  <ClipboardPaste size={18} color="rgba(255,255,255,0.9)" />
                </button>
              </div>
              <TransfersPanel
                items={props.transfers}
                onPause={props.onPause}
                onDownload={props.onDownload}
                onResumeUpload={props.onResumeUpload}
                onResumeDownload={props.onResumeDownload}
                onClear={props.onClearTransfers}
                onPreview={props.onPreview}
                onLoadServerFiles={props.onLoadServerFiles}
              />
            </>
          }
        />
        <Route path="/admin" element={<Admin onPreview={props.onPreviewDirect} />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const nav = useNavigate();
  const location = useLocation();
  const { socket, state, deviceId } = useThrowItSocket();
  const [selected, setSelected] = useState<Selected>({ type: "all" });
  const [mode, setMode] = useState<"fast" | "balanced">("balanced");
  const [deviceName, setDeviceName] = useState(getDeviceName() || "...");
  const [previewItem, setPreviewItem] = useState<{ url: string; mimeType: string; name: string } | null>(null);

  const { transfers, sendFiles, pause, download, resumeUpload, resumeDownload, clear, summary, getOutgoingFile } = useTransfers(socket);
  const isCompact = useMediaQuery("(max-width: 1100px)");
  const [mobileView, setMobileView] = useState<"send" | "devices" | "chat">("send");
  const [targetOpen, setTargetOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [serverFilesOpen, setServerFilesOpen] = useState(false);
  const [serverFilesLoading, setServerFilesLoading] = useState(false);
  const [serverFiles, setServerFiles] = useState<
    {
      transferId: string;
      fileName: string;
      mimeType?: string;
      fileSize: number;
      storedBytes: number;
      createdAt: number;
      fromDeviceName: string;
    }[]
  >([]);

  useEffect(() => {
    if (isCompact && location.pathname === "/admin") {
      setMobileView("send");
    }
  }, [isCompact, location.pathname]);

  useEffect(() => {
    if (!state.connected) return;
    for (const t of transfers) {
      if (t.direction === "out" && t.status === "paused" && t.error?.includes("Koneksi")) {
        void resumeUpload(t.transferId);
      }
    }
  }, [state.connected, transfers, resumeUpload]);

  useEffect(() => {
    const me = state.devices.find((d) => d.deviceId === deviceId);
    if (me?.name) setDeviceName(me.name);
    else {
      const n = getDeviceName();
      if (n) setDeviceName(n);
    }
  }, [state.devices, deviceId]);

  const to = useMemo(() => {
    if (selected.type === "all") return { type: "all" } as const;
    return { type: "device", deviceId: selected.deviceId } as const;
  }, [selected]);

  const toLabel = useMemo(() => {
    if (selected.type === "all") return "Semua";
    const d = state.devices.find((x) => x.deviceId === selected.deviceId);
    return d?.name ?? "Perangkat";
  }, [selected, state.devices]);

  const onFiles = useMemo(() => {
    return async (files: File[]) => {
      await sendFiles(files, to, toLabel, mode, deviceName);
    };
  }, [sendFiles, to, toLabel, mode, deviceName]);

  const openPaste = () => setPasteOpen(true);

  const loadServerFiles = async () => {
    setServerFilesLoading(true);
    try {
      const res = await fetch("/api/files");
      const json = await res.json();
      if (json?.ok) {
        setServerFiles(json.items ?? []);
      }
    } finally {
      setServerFilesLoading(false);
    }
  };

  const handlePreviewDirect = (url: string, mimeType: string, name: string) => {
    const finalUrl = url.includes("?") ? `${url}&inline=1` : `${url}?inline=1`;

    void (async () => {
      // Validate server headers first. If server forces download (attachment/octet-stream),
      // show "preview not supported" instead of triggering an iframe download.
      try {
        const head = await fetch(finalUrl, { method: "HEAD" });
        if (head.ok) {
          const ct = (head.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
          const cd = (head.headers.get("content-disposition") ?? "").toLowerCase();
          const looksDownload = cd.startsWith("attachment");
          const effective = ct || mimeType || "application/octet-stream";
          const previewable =
            !looksDownload &&
            (effective.startsWith("image/") ||
              effective.startsWith("video/") ||
              effective.startsWith("text/") ||
              effective === "application/pdf");

          if (previewable) {
            setPreviewItem({ url: finalUrl, mimeType: effective, name });
            return;
          }
        }
      } catch {
        // ignore and fall back
      }

      setPreviewItem({ url: "about:blank", mimeType: "application/octet-stream", name });
    })();
  };

  const handlePreview = async (t: UiTransfer) => {
    const serverUrl = `/api/files/${t.transferId}/download?inline=1`;

    // Prefer server-backed preview for history items (survives refresh, fixes inline PDF headers).
    if (t.status === "done" || t.status === "ready") {
      try {
        const head = await fetch(serverUrl, { method: "HEAD" });
        if (head.ok) {
          const ct = (head.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
          const cd = (head.headers.get("content-disposition") ?? "").toLowerCase();
          const looksDownload = cd.startsWith("attachment");
          const effective = ct || t.mimeType || "application/octet-stream";
          const previewable =
            !looksDownload &&
            (effective.startsWith("image/") ||
              effective.startsWith("video/") ||
              effective.startsWith("text/") ||
              effective === "application/pdf");

          if (previewable) {
            setPreviewItem({ url: serverUrl, mimeType: effective, name: t.fileName });
            return;
          }

          // If server forces download, show unsupported message instead of iframe download.
          setPreviewItem({ url: "about:blank", mimeType: "application/octet-stream", name: t.fileName });
          return;
        }
      } catch {
        // ignore and fall back
      }
    }

    if (t.direction === "out") {
      const file = getOutgoingFile(t.transferId);
      if (file) {
        const url = URL.createObjectURL(file);
        setPreviewItem({ url, mimeType: t.mimeType, name: t.fileName });
        return;
      }
    }

    alert("File ini tidak tersedia untuk di-preview saat ini.");
  };

  useEffect(() => {
    // Paste file support (Ctrl+V / long-press paste on mobile)
    const onPaste = (e: ClipboardEvent) => {
      if (location.pathname !== "/") return;
      if (isCompact && mobileView !== "send") return;
      const dt = e.clipboardData;
      if (!dt) return;
      const files: File[] = [];
      if (dt.files && dt.files.length) {
        files.push(...Array.from(dt.files));
      }
      for (const item of Array.from(dt.items)) {
        if (item.kind !== "file") continue;
        const f = item.getAsFile();
        if (f) files.push(f);
      }
      const unique = files.filter((f, idx) => files.findIndex((x) => x.name === f.name && x.size === f.size) === idx);
      if (!unique.length) return;
      e.preventDefault();
      void onFiles(unique);
    };
    window.addEventListener("paste", onPaste as any);
    return () => window.removeEventListener("paste", onPaste as any);
  }, [location.pathname, isCompact, mobileView, onFiles]);

  return (
    <div className="app">
      <HeaderBar
        connected={state.connected}
        deviceName={deviceName}
        onRename={(name) => {
          setDeviceName(name);
          socket?.emit("device:updateName", { deviceId, name });
        }}
        onOpenAdmin={() => nav("/admin")}
        onGoHome={() => nav("/")}
      />

      <div className="layout">
        {isCompact ? (
          <div className="mobileNav" style={{ gridColumn: "1 / -1" }}>
            <div className="mobileTop">
              <button className="targetBtn" onClick={() => setTargetOpen(true)} title="Pilih target">
                <Send size={16} color="rgba(255,255,255,0.85)" />
                <div className="targetText">{selected.type === "all" ? "Semua" : toLabel}</div>
                <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
              </button>
              <div className="seg">
                <button className={mobileView === "devices" ? "active" : ""} onClick={() => setMobileView("devices")}>
                  Perangkat
                </button>
                <button className={mobileView === "send" ? "active" : ""} onClick={() => setMobileView("send")}>
                  Kirim
                </button>
                <button className={mobileView === "chat" ? "active" : ""} onClick={() => setMobileView("chat")}>
                  Chat
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isCompact ? (
          mobileView === "devices" ? (
            <SidebarDevices
              devices={state.devices}
              meDeviceId={deviceId}
              selected={selected}
              onSelect={(s) => setSelected(s)}
            />
          ) : mobileView === "chat" ? (
            <ChatSidebar
              socket={socket}
              chat={state.chat}
              meDeviceId={deviceId}
              filter={selected}
              filterLabel={selected.type === "all" ? "Semua" : toLabel}
            />
          ) : (
            <MainPanel
              selected={selected}
              toLabel={toLabel}
              compact={true}
              mode={mode}
              setMode={setMode}
              onFiles={onFiles}
              onPasteClick={openPaste}
              onPickTarget={() => setTargetOpen(true)}
              transfers={transfers}
              onPause={pause}
              onDownload={download}
              onResumeUpload={resumeUpload}
              onResumeDownload={resumeDownload}
              onClearTransfers={clear}
              onPreview={handlePreview}
              onPreviewDirect={handlePreviewDirect}
              onLoadServerFiles={async () => {
                setServerFilesOpen(true);
                await loadServerFiles();
              }}
            />
          )
        ) : (
          <>
            <SidebarDevices
              devices={state.devices}
              meDeviceId={deviceId}
              selected={selected}
              onSelect={(s) => setSelected(s)}
            />

            <MainPanel
              selected={selected}
              toLabel={toLabel}
              compact={false}
              mode={mode}
              setMode={setMode}
              onFiles={onFiles}
              onPasteClick={openPaste}
              onPickTarget={() => setTargetOpen(true)}
              transfers={transfers}
              onPause={pause}
              onDownload={download}
              onResumeUpload={resumeUpload}
              onResumeDownload={resumeDownload}
              onClearTransfers={clear}
              onPreview={handlePreview}
              onPreviewDirect={handlePreviewDirect}
              onLoadServerFiles={async () => {
                setServerFilesOpen(true);
                await loadServerFiles();
              }}
            />

            <ChatSidebar
              socket={socket}
              chat={state.chat}
              meDeviceId={deviceId}
              filter={selected}
              filterLabel={selected.type === "all" ? "Semua" : toLabel}
              previewItem={previewItem}
              onClearPreview={() => setPreviewItem(null)}
            />
          </>
        )}
      </div>

      {summary.activeCount > 0 ? (
        <div
          style={{
            position: "fixed",
            left: 16,
            bottom: 16,
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(15,20,32,0.84)",
            backdropFilter: "blur(10px)"
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 13 }}>Transfer aktif: {summary.activeCount}</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Kecepatan: {summary.totalSpeedLabel}</div>
        </div>
      ) : null}

      <Modal title="Pilih Target" open={targetOpen} onClose={() => setTargetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            className="btn btnPrimary"
            onClick={() => {
              setSelected({ type: "all" });
              setTargetOpen(false);
            }}
          >
            Semua
          </button>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 800 }}>Perangkat Online</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflow: "auto" }}>
            {state.devices
              .filter((d) => d.deviceId !== deviceId)
              .map((d) => (
                <button
                  key={d.deviceId}
                  className="btn"
                  style={{ textAlign: "left", display: "flex", justifyContent: "space-between", gap: 10 }}
                  onClick={() => {
                    setSelected({ type: "device", deviceId: d.deviceId });
                    setTargetOpen(false);
                  }}
                >
                  <span style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                    {d.name}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.55)" }}>{d.deviceId.slice(0, 6)}…</span>
                </button>
              ))}
            {state.devices.filter((d) => d.deviceId !== deviceId).length === 0 ? (
              <div className="emptyState">Belum ada perangkat lain.</div>
            ) : null}
          </div>
        </div>
      </Modal>

      <PasteFilesModal open={pasteOpen} onClose={() => setPasteOpen(false)} onFiles={(files) => void onFiles(files)} />

      <Modal title="File di Server (Semua)" open={serverFilesOpen} onClose={() => setServerFilesOpen(false)}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 800 }}>
            Pilih file untuk diunduh. File tidak akan diunduh otomatis.
          </div>
          <button className="btn btnSmall" onClick={() => void loadServerFiles()} disabled={serverFilesLoading}>
            {serverFilesLoading ? "Memuat..." : "Refresh"}
          </button>
        </div>

        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.18)",
            display: "flex",
            gap: 10,
            alignItems: "flex-start"
          }}
        >
          <ShieldAlert size={18} color="rgba(255,255,255,0.8)" />
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 1.45 }}>
            Keamanan: ThrowIt hanya memindahkan file. Kami tidak bisa menjamin file bebas virus.
            Jangan buka file yang tidak kamu percaya, dan gunakan antivirus di perangkat kamu.
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10, maxHeight: 520, overflow: "auto" }}>
          {serverFiles.length === 0 ? (
            <div className="emptyState">Tidak ada file tersimpan.</div>
          ) : (
            serverFiles.map((f) => (
              <div key={f.transferId} className="transferRow" style={{ gridTemplateColumns: "1fr auto" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="transferName" title={f.fileName}>
                    {f.fileName}
                  </div>
                  <div className="transferMeta">
                    <span>{formatBytes(f.storedBytes || f.fileSize)}</span>
                    <span>Dari: {f.fromDeviceName || "-"}</span>
                    <span>{formatTime(f.createdAt)}</span>
                    <span>ID: {f.transferId.slice(0, 6)}…</span>
                  </div>
                </div>
                <div className="rowActions">
                  <button
                    className="btn btnSmall"
                    onClick={() => {
                      setServerFilesOpen(false);
                      handlePreviewDirect(`/api/files/${f.transferId}/download?inline=1`, f.mimeType ?? "application/octet-stream", f.fileName);
                    }}
                    title="Preview File"
                  >
                    <Eye size={16} />
                  </button>
                  <a
                    className="btn btnSmall btnPrimary"
                    href={`/api/files/${f.transferId}/download`}
                    download
                    title="Download dari server"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                  >
                    <Download size={16} />
                    Download
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
