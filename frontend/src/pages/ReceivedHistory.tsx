import React, { useMemo } from "react";
import { clearReceivedHistory, loadReceivedHistory } from "../storage/local";
import { formatBytes, formatTime } from "../utils/format";

export default function ReceivedHistory() {
  const items = useMemo(() => loadReceivedHistory(), []);

  return (
    <div className="panel">
      <div className="panelHeader">
        <div className="panelTitle">RIWAYAT FILE DITERIMA</div>
        <button
          className="btn btnSmall btnDanger"
          onClick={() => {
            clearReceivedHistory();
            window.location.reload();
          }}
        >
          Hapus semua
        </button>
      </div>

      <div className="list">
        {items.length === 0 ? (
          <div className="emptyState">Belum ada file diterima.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((it) => (
              <div key={it.transferId} className="transferRow" style={{ gridTemplateColumns: "1fr" }}>
                <div>
                  <div className="transferName">{it.fileName}</div>
                  <div className="transferMeta">
                    <span>{formatBytes(it.fileSize)}</span>
                    <span>Dari: {it.fromDeviceName}</span>
                    <span>{formatTime(it.receivedAt)}</span>
                    {it.sha256 ? <span>SHA-256: {it.sha256.slice(0, 10)}…</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
