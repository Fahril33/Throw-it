import React, { useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ClipboardPaste,
  Download,
  Info,
  List,
  RefreshCcw,
  Send,
  SlidersHorizontal,
  Zap,
  ShieldAlert,
  Eye,
  Sparkles,
  X
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
  onCancel: (id: string) => void;
  onDownload: (t: UiTransfer) => void;
  onResumeUpload: (id: string) => void;
  onResumeDownload: (id: string) => void;
  onDeleteSelected: (ids: string[]) => void;
  onPreview: (t: UiTransfer) => void;
  onLoadServerFiles: () => void;
  onLoadTodayHistory: () => void;
}) {
  const [mode, setMode] = useState<"sent" | "received" | "all">("all");
  const [spin, setSpin] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [wrapName, setWrapName] = useState<Record<string, boolean>>({});
  const [patchNotesOpen, setPatchNotesOpen] = useState(false);
  const [selectEnabled, setSelectEnabled] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const historyLabel = mode === "sent" ? "Riwayat Dikirim" : mode === "received" ? "Riwayat Diterima" : "Semua Riwayat";

  const cycleMode = () => {
    setSpin(true);
    window.setTimeout(() => setSpin(false), 650);
    setMode((m) => (m === "sent" ? "received" : m === "received" ? "all" : "sent"));
  };

  const transfersSorted = useMemo(() => {
    const sorted = props.items.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    // Semua mode bersifat global (tanpa filter target/pengirim tertentu).
    const modeFiltered =
      mode === "sent" ? sorted.filter((t) => t.direction === "out") : mode === "received" ? sorted.filter((t) => t.direction === "in") : sorted;

    // Jangan tampilkan file yang masih dalam antrian di bagian riwayat.
    return modeFiltered.filter((t) => t.status !== "queued");
  }, [props.items, mode]);

  const selectedCount = useMemo(() => Object.keys(selected).filter((id) => selected[id]).length, [selected]);

  const toggleSelected = (transferId: string) => {
    if (!selectEnabled) return;
    setSelected((prev) => ({ ...prev, [transferId]: !prev[transferId] }));
  };

  const downloadSelected = async () => {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (!ids.length) return;

    // Best-effort: bulk download via server endpoint. Skip items that are not finalized/available.
    const list = ids
      .map((id) => transfersSorted.find((t) => t.transferId === id))
      .filter(Boolean) as UiTransfer[];
    const downloadable = list.filter((t) => t.status === "ready" || t.status === "done");
    if (!downloadable.length) return;

    for (let i = 0; i < downloadable.length; i++) {
      const t = downloadable[i];
      const a = document.createElement("a");
      a.href = `/api/files/${t.transferId}/download`;
      a.download = t.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Small delay to avoid browsers grouping/ignoring rapid sequential clicks.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => window.setTimeout(r, 120));
    }
  };

  return (
    <>
      <div className="historyWrap">
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
            <List size={16} />
            <span style={{ fontSize: 11 }}>Server Files</span>
          </button>
          <button className="btn btnSmall" onClick={props.onLoadTodayHistory} title="Muat semua transfer hari ini ke riwayat">
            <RefreshCcw size={16} />
            <span style={{ fontSize: 11 }}>Today</span>
          </button>
          <button
            className="btn btnSmall"
            onClick={() => {
              // 3 modes: Select -> Select All -> Unselect
              if (!selectEnabled) {
                setSelectEnabled(true);
                return;
              }
              const allIds = transfersSorted.map((x) => x.transferId);
              const allSelected = allIds.length > 0 && allIds.every((id) => selected[id]);
              if (!allSelected) {
                const next: Record<string, boolean> = {};
                for (const id of allIds) next[id] = true;
                setSelected(next);
              } else {
                setSelected({});
                setSelectEnabled(false);
              }
            }}
            title={!selectEnabled ? "Aktifkan select" : "Select All / Unselect"}
          >
            {!selectEnabled
              ? "Select"
              : transfersSorted.length > 0 && transfersSorted.every((it) => selected[it.transferId])
                ? "Unselect"
                : "Select All"}
          </button>
          {selectEnabled ? (
            <button
              className="btn btnSmall btnPrimary"
              onClick={() => void downloadSelected()}
              disabled={selectedCount === 0}
              title="Download yang dipilih"
            >
              <Download size={16} />
              <span style={{ fontSize: 11 }}>Download ({selectedCount})</span>
            </button>
          ) : null}
          {selectEnabled ? (
            <button
              className="btn btnSmall btnDanger"
              onClick={() => {
                const ids = Object.keys(selected).filter((id) => selected[id]);
                if (!ids.length) return;
                const deletable = ids.filter((id) => {
                  const t = transfersSorted.find((x) => x.transferId === id);
                  return t && (t.status === "ready" || t.status === "done" || t.status === "error" || t.status === "canceled");
                });
                if (deletable.length === 0) return;
                const skipped = ids.length - deletable.length;
                const msg =
                  skipped > 0
                    ? `Hapus ${deletable.length} item riwayat? (${skipped} item masih aktif, tidak dihapus)`
                    : `Hapus ${deletable.length} item riwayat terpilih?`;
                if (!confirm(msg)) return;
                props.onDeleteSelected(deletable);
                setSelected({});
                setSelectEnabled(false);
              }}
              disabled={selectedCount === 0}
              title="Hapus yang dipilih"
            >
              <X size={16} />
              <span style={{ fontSize: 11 }}>Hapus ({selectedCount})</span>
            </button>
          ) : null}
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
                style={{
                  borderLeft: `2px solid ${stripe}`,
                  paddingLeft: 10,
                  gridTemplateColumns: selectEnabled ? "auto 1fr auto" : "1fr auto"
                }}
              >
                {selectEnabled ? (
                  <div style={{ display: "flex", alignItems: "flex-start", paddingTop: 2 }}>
                    <label className="container" title="Pilih">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[t.transferId])}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelected((prev) => ({ ...prev, [t.transferId]: checked }));
                        }}
                      />
                      <svg viewBox="0 0 64 64" height="2em" width="2em">
                        <path
                          d="M 0 16 V 56 A 8 8 90 0 0 8 64 H 56 A 8 8 90 0 0 64 56 V 8 A 8 8 90 0 0 56 0 H 8 A 8 8 90 0 0 0 8 V 16 L 32 48 L 64 16 V 8 A 8 8 90 0 0 56 0 H 8 A 8 8 90 0 0 0 8 V 56 A 8 8 90 0 0 8 64 H 56 A 8 8 90 0 0 64 56 V 16"
                          pathLength="575.0541381835938"
                          className="path"
                        ></path>
                      </svg>
                    </label>
                  </div>
                ) : null}
                <div style={{ minWidth: 0 }}>
                  <div
                    className={`transferName ${wrapName[t.transferId] ? "wrap" : ""}`}
                    role="button"
                    tabIndex={0}
                    title={selectEnabled ? "Klik untuk pilih" : wrapName[t.transferId] ? "Klik untuk potong" : "Klik untuk wrap"}
                    onClick={() => {
                      if (selectEnabled) toggleSelected(t.transferId);
                      else setWrapName((p) => ({ ...p, [t.transferId]: !p[t.transferId] }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (selectEnabled) toggleSelected(t.transferId);
                        else setWrapName((p) => ({ ...p, [t.transferId]: !p[t.transferId] }));
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
                  {t.status === "queued" || t.status === "transferring" || t.status === "finalizing" || t.status === "paused" ? (
                    <button className="btn btnSmall btnDanger" onClick={() => props.onCancel(t.transferId)} title="Cancel">
                      <X size={16} />
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

      <div className="historyPanelFooter" style={{ padding: "4px 14px", color: "rgba(255,255,255,0.55)", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
          <Sparkles size={14} />
          Patch Notes
        </button>
      </div>
      </div>

      <Modal title="Patch Notes" open={patchNotesOpen} onClose={() => setPatchNotesOpen(false)}>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, lineHeight: 1.6, maxHeight: "300px", overflowY: "auto", paddingRight: 4 }}>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 4px", color: "#fff" }}>v2.2.0 - UI Layout & History</h4>
            <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.7)" }}>
              <li><strong>Riwayat:</strong> Tombol "Hapus semua" dihapus; delete tersedia untuk item terpilih saat mode Select.</li>
              <li><strong>Riwayat:</strong> Item queued (antrian) tidak ditampilkan di daftar riwayat.</li>
              <li><strong>Panel kiri:</strong> Perangkat/Antrian bisa toggle dari header; auto pindah ke view antrian saat memilih file untuk dikirim.</li>
              <li><strong>Fallback aman:</strong> Jika tipe file/response tidak mendukung preview, area preview menampilkan pesan “Preview tidak didukung”.</li>
              <li><strong>Layout:</strong> Tinggi panel terkunci ke sisa tinggi layar (scroll di dalam panel), plus scrollbar lebih rapi.</li>
              <li><strong>Header:</strong> Kontrol dipindah ke header; di mobile target button disembunyikan dan capsule online lebih ringkas.</li>
            </ul>
          </div>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 4px", color: "#fff" }}>v2.1.1 - History & PDF Preview Fix</h4>
            <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.7)" }}>
              <li><strong>Riwayat setelah refresh:</strong> Preview & download dari list riwayat tetap bisa (mengambil dari file server saat tersedia).</li>
              <li><strong>PDF server:</strong> PDF akan di-preview inline via iframe (bukan langsung terunduh) jika server mengirim header yang sesuai.</li>
              <li><strong>Muat file server:</strong> Opsi "Muat file dari server" dipindahkan ke area preview/riwayat.</li>
              <li><strong>Fallback aman:</strong> Jika tipe file/response tidak mendukung preview, area preview menampilkan pesan "Preview tidak didukung".</li>
            </ul>
          </div>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 4px", color: "#fff" }}>v2.1.0 - File Preview & UI Enhancements</h4>
            <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.7)" }}>
              <li><strong>Preview Area:</strong> Preview (gambar, video, PDF) dari riwayat transfer.</li>
              <li><strong>Navigasi Cepat:</strong> Tab chat diperbarui agar lebih responsif pada desktop.</li>
              <li><strong>UI Footer:</strong> Tombol Patch Notes ditambahkan.</li>
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
  headerTop?: React.ReactNode;
  onFiles: (files: File[]) => void;
  onPasteClick: () => void;
  transfers: UiTransfer[];
  onPause: (id: string) => void;
  onCancel: (id: string) => void;
  onDownload: (t: UiTransfer) => void;
  onResumeUpload: (id: string) => void;
  onResumeDownload: (id: string) => void;
  onDeleteTransfers: (ids: string[]) => void;
  onPreview: (t: UiTransfer) => void;
  onPreviewDirect: (url: string, mimeType: string, name: string) => void;
  onLoadServerFiles: () => void;
  onLoadTodayHistory: () => void;
}) {
  return (
    <div className="panel">
      {props.headerTop ? <div className="panelHeader panelHeaderStack">{props.headerTop}</div> : null}

      <div className="mainBody">
        <Routes>
          <Route
            path="/"
            element={
              <div className="homeStack">
                <div className="sendRow">
                  <DropZone onFiles={props.onFiles} style={{ height: "100%" }} />
                  <button className="pasteBtn" onClick={props.onPasteClick} title="Paste file dari clipboard">
                    <ClipboardPaste size={18} color="rgba(255,255,255,0.9)" />
                  </button>
                </div>
                <TransfersPanel
                  items={props.transfers}
                  onPause={props.onPause}
                  onCancel={props.onCancel}
                  onDownload={props.onDownload}
                  onResumeUpload={props.onResumeUpload}
                  onResumeDownload={props.onResumeDownload}
                  onDeleteSelected={props.onDeleteTransfers}
                  onPreview={props.onPreview}
                  onLoadServerFiles={props.onLoadServerFiles}
                  onLoadTodayHistory={props.onLoadTodayHistory}
                />
              </div>
            }
          />
          <Route path="/admin" element={<Admin onPreview={props.onPreviewDirect} />} />
        </Routes>
      </div>
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

  const {
    transfers,
    sendFiles,
    runOutgoingQueue,
    pause,
    cancel,
    download,
    resumeUpload,
    resumeDownload,
    removeTransfers,
    summary,
    getOutgoingFile,
    importServerFiles
  } = useTransfers(socket);
  const isCompact = useMediaQuery("(max-width: 1100px)");
  const [mobileView, setMobileView] = useState<"send" | "devices" | "chat">("send");
  const [sidebarView, setSidebarView] = useState<"devices" | "queue">("devices");
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
      if (files.length) {
        setSidebarView("queue");
        if (isCompact) setMobileView("devices");
      }
      await sendFiles(files, to, toLabel, mode, deviceName);
    };
  }, [sendFiles, to, toLabel, mode, deviceName, isCompact]);

  const outgoingQueue = useMemo(() => {
    return transfers
      .filter(
        (t) =>
          t.direction === "out" &&
          (t.status === "queued" || t.status === "transferring" || t.status === "finalizing" || t.status === "paused")
      )
      .slice()
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  }, [transfers]);

  useEffect(() => {
    if (sidebarView === "queue" && outgoingQueue.length === 0) setSidebarView("devices");
  }, [sidebarView, outgoingQueue.length]);

  const openPaste = () => setPasteOpen(true);

  const mobileNavSeg = useMemo(() => {
    if (!isCompact) return null;
    return (
      <div className="panelNavRow">
        <div className="seg navSeg" title="Navigasi">
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
    );
  }, [isCompact, mobileView]);

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

  const loadTodayHistory = async () => {
    try {
      const res = await fetch("/api/files");
      const json = await res.json();
      if (!json?.ok) return;

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      const items = (json.items ?? []).filter((it: any) => Number(it?.createdAt) >= start && Number(it?.createdAt) < end);
      importServerFiles(items);
    } catch {
      // ignore
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
        targetLabel={selected.type === "all" ? "Semua" : toLabel}
        onPickTarget={() => setTargetOpen(true)}
        mode={mode}
        onModeChange={setMode}
        isAdminRoute={location.pathname === "/admin"}
        compact={isCompact}
      />

      <div className="layout">
        {isCompact ? (
          mobileView === "devices" ? (
            <SidebarDevices
              devices={state.devices}
              meDeviceId={deviceId}
              selected={selected}
              onSelect={(s) => setSelected(s)}
              outgoingQueue={outgoingQueue}
              view={sidebarView}
              onViewChange={setSidebarView}
              headerTop={mobileNavSeg}
              onSendAll={() => runOutgoingQueue()}
              onCancelTransfer={(id) => cancel(id)}
            />
          ) : mobileView === "chat" ? (
            <ChatSidebar
              socket={socket}
              chat={state.chat}
              meDeviceId={deviceId}
              filter={selected}
              filterLabel={selected.type === "all" ? "Semua" : toLabel}
              headerTop={mobileNavSeg}
            />
          ) : (
            <MainPanel
              headerTop={mobileNavSeg}
              onFiles={onFiles}
              onPasteClick={openPaste}
              transfers={transfers}
              onPause={pause}
              onCancel={cancel}
              onDownload={download}
              onResumeUpload={resumeUpload}
              onResumeDownload={resumeDownload}
              onDeleteTransfers={removeTransfers}
              onPreview={handlePreview}
              onPreviewDirect={handlePreviewDirect}
              onLoadServerFiles={async () => {
                setServerFilesOpen(true);
                await loadServerFiles();
              }}
              onLoadTodayHistory={() => void loadTodayHistory()}
            />
          )
        ) : (
          <>
            <SidebarDevices
              devices={state.devices}
              meDeviceId={deviceId}
              selected={selected}
              onSelect={(s) => setSelected(s)}
              outgoingQueue={outgoingQueue}
              view={sidebarView}
              onViewChange={setSidebarView}
              onSendAll={() => runOutgoingQueue()}
              onCancelTransfer={(id) => cancel(id)}
            />

            <MainPanel
              onFiles={onFiles}
              onPasteClick={openPaste}
              transfers={transfers}
              onPause={pause}
              onCancel={cancel}
              onDownload={download}
              onResumeUpload={resumeUpload}
              onResumeDownload={resumeDownload}
              onDeleteTransfers={removeTransfers}
              onPreview={handlePreview}
              onPreviewDirect={handlePreviewDirect}
              onLoadServerFiles={async () => {
                setServerFilesOpen(true);
                await loadServerFiles();
              }}
              onLoadTodayHistory={() => void loadTodayHistory()}
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
