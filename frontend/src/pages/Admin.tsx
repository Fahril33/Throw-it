import React, { useEffect, useMemo, useState } from "react";
import { formatBytes, formatTime } from "../utils/format";
import CopyButton from "../components/CopyButton";

type AdminItem = {
  transferId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storedBytes: number;
  createdAt: number;
  fromDeviceId: string;
  fromDeviceName: string;
  to: any;
  sha256?: string;
};

export default function Admin() {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectEnabled, setSelectEnabled] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/files");
      const json = await res.json();
      if (json?.ok) {
        setItems(json.items ?? []);
        setTotalBytes(Number(json.totalBytes ?? 0));
        setSelected({});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const headerRight = useMemo(
    () => (
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Total: {formatBytes(totalBytes)}</div>
        <button
          className="btn btnSmall"
          onClick={() => {
            // 3 modes: Select -> Select All -> Unselect
            if (!selectEnabled) {
              setSelectEnabled(true);
              return;
            }
            const allIds = items.map((x) => x.transferId);
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
            : items.length > 0 && items.every((it) => selected[it.transferId])
              ? "Unselect"
              : "Select All"}
        </button>
        {selectEnabled ? (
          <button
            className="btn btnSmall btnDanger"
            onClick={async () => {
              const ids = Object.keys(selected).filter((id) => selected[id]);
              if (!ids.length) return;
              if (!confirm(`Hapus ${ids.length} file terpilih dari server?`)) return;

              let removedBytes = 0;
              for (const id of ids) {
                const item = items.find((x) => x.transferId === id);
                const res = await fetch(`/api/admin/files/${id}`, { method: "DELETE" });
                const json = await res.json();
                if (json?.ok) {
                  removedBytes += item?.storedBytes ?? 0;
                  setItems((prev) => prev.filter((x) => x.transferId !== id));
                }
              }

              setTotalBytes((prev) => Math.max(0, prev - removedBytes));
              setSelected({});
            }}
            disabled={Object.keys(selected).filter((id) => selected[id]).length === 0}
            title="Hapus yang dipilih"
          >
            Hapus ({Object.keys(selected).filter((id) => selected[id]).length})
          </button>
        ) : null}
        <button className="btn btnSmall" onClick={() => void load()} disabled={loading}>
          {loading ? "Memuat..." : "Refresh"}
        </button>
      </div>
    ),
    [totalBytes, loading, selectEnabled, items, selected]
  );

  const toggleSelected = (transferId: string) => {
    if (!selectEnabled) return;
    setSelected((prev) => ({ ...prev, [transferId]: !prev[transferId] }));
  };

  const remove = async (transferId: string) => {
    if (!confirm("Hapus file ini dari server?")) return;
    const res = await fetch(`/api/admin/files/${transferId}`, { method: "DELETE" });
    const json = await res.json();
    if (json?.ok) {
      setItems((prev) => prev.filter((x) => x.transferId !== transferId));
      setTotalBytes((prev) => Math.max(0, prev - (items.find((x) => x.transferId === transferId)?.storedBytes ?? 0)));
      setSelected((prev) => {
        if (!prev[transferId]) return prev;
        const next = { ...prev };
        delete next[transferId];
        return next;
      });
    } else {
      alert("Gagal menghapus.");
    }
  };

  return (
    <div className="panel">
      <div className="panelHeader">
        <div className="panelTitle">ADMIN • FILE SERVER</div>
        {headerRight}
      </div>

      <div className="list">
        {items.length === 0 ? (
          <div className="emptyState">Belum ada file tersimpan di server.</div>
        ) : (
          <div className="adminList" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((it) => {
              const toLabel =
                it.to?.type === "all"
                  ? "Semua Perangkat"
                  : it.to?.type === "device"
                    ? `Device (${String(it.to.deviceId).slice(0, 6)}…)`
                    : "Unknown";
              return (
                <div
                  key={it.transferId}
                  className="transferRow"
                  style={{ gridTemplateColumns: selectEnabled ? "auto 1fr auto" : "1fr auto" }}
                >
                  {selectEnabled ? (
                    <div style={{ display: "flex", alignItems: "flex-start", paddingTop: 2 }}>
                      <label className="container" title="Pilih">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[it.transferId])}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelected((prev) => ({ ...prev, [it.transferId]: checked }));
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
                      className="transferName adminFileName"
                      onClick={() => toggleSelected(it.transferId)}
                      title={selectEnabled ? "Klik untuk pilih" : it.fileName}
                      role={selectEnabled ? "button" : undefined}
                      tabIndex={selectEnabled ? 0 : -1}
                      onKeyDown={(e) => {
                        if (!selectEnabled) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSelected(it.transferId);
                        }
                      }}
                    >
                      {it.fileName}
                    </div>
                    <div className="transferMeta">
                      <span>ID: {it.transferId}</span>
                      <span>{formatBytes(it.storedBytes || it.fileSize)}</span>
                      <span>Dari: {it.fromDeviceName || it.fromDeviceId.slice(0, 6) + "…"}</span>
                      <span>Ke: {toLabel}</span>
                      <span>{it.createdAt ? formatTime(it.createdAt) : "-"}</span>
                    </div>
                  </div>
                  <div className="rowActions">
                    <CopyButton text={it.fileName} title="Copy nama file" />
                    {!selectEnabled ? (
                      <button className="btn btnSmall btnDanger" onClick={() => void remove(it.transferId)}>
                        Hapus
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
