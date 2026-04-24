import React from "react";
import { EyeOff, Laptop, Smartphone, Tablet, X } from "lucide-react";
import type { OnlineDevice } from "../socket/types";
import { deviceTypeLabel } from "../utils/device";
import type { UiTransfer } from "../transfers/useTransfers";
import { formatBytes } from "../utils/format";

function DeviceIcon(props: { type: OnlineDevice["type"] }) {
  if (props.type === "mobile") return <Smartphone size={18} />;
  if (props.type === "tablet") return <Tablet size={18} />;
  if (props.type === "desktop") return <Laptop size={18} />;
  return <Laptop size={18} />;
}

export default function SidebarDevices(props: {
  devices: OnlineDevice[];
  meDeviceId: string;
  selected: { type: "all" } | { type: "device"; deviceId: string };
  onSelect: (sel: { type: "all" } | { type: "device"; deviceId: string }) => void;
  outgoingQueue?: UiTransfer[];
  view?: "devices" | "queue";
  onViewChange?: (view: "devices" | "queue") => void;
  headerTop?: React.ReactNode;
  onSendAll?: () => void;
  onCancelTransfer?: (transferId: string) => void;
}) {
  const others = props.devices.filter((d) => d.deviceId !== props.meDeviceId);
  const queue = (props.outgoingQueue ?? []).slice().sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const queuedCount = queue.filter((t) => t.status === "queued").length;
  const hasQueue = queue.length > 0;
  const view: "devices" | "queue" = hasQueue ? (props.view ?? "devices") : "devices";
  const setView = (next: "devices" | "queue") => props.onViewChange?.(next);

  return (
    <div className="panel leftPanel">
      <div className="panelHeader panelHeaderRow" style={{ justifyContent: props.headerTop ? "flex-end" : "center" }}>
        {props.headerTop ? props.headerTop : null}
        <div className="seg" title="Tampilan">
          <button className={view === "devices" ? "active" : ""} onClick={() => setView("devices")}>
            Perangkat
          </button>
          <button className={view === "queue" ? "active" : ""} onClick={() => setView("queue")} disabled={!hasQueue}>
            Antrian{queuedCount > 0 ? ` (${queuedCount})` : ""}
          </button>
        </div>
      </div>

      <div className="list">
        {view === "queue" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 800 }}>Antrian File</div>
              {queuedCount > 1 && props.onSendAll ? (
                <button className="btn btnSmall btnPrimary" onClick={props.onSendAll} title="Kirim semua antrian">
                  Send all
                </button>
              ) : null}
            </div>

            {queue.length === 0 ? (
              <div className="emptyState">Belum ada antrian.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {queue.map((t) => {
                  const pct = t.totalBytes > 0 ? Math.round((t.progressBytes / t.totalBytes) * 100) : 0;
                  return (
                    <div key={t.transferId} className="queueItemRow">
                      <div style={{ minWidth: 0 }}>
                        <div className="queueItemName" title={t.fileName}>
                          {t.fileName}
                        </div>
                        <div className="queueItemMeta">
                          <span>{formatBytes(t.fileSize)}</span>
                          <span>{t.status === "queued" ? "queued" : t.status === "paused" ? "paused" : `${pct}%`}</span>
                        </div>
                      </div>
                      {props.onCancelTransfer ? (
                        <button
                          className="btn btnSmall btnDanger"
                          onClick={() => {
                            if (!window.confirm("Batalkan transfer ini?")) return;
                            props.onCancelTransfer?.(t.transferId);
                          }}
                          title="Batalkan transfer ini"
                        >
                          <X size={16} />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <button
              className="btn btnPrimary"
              style={{ width: "100%", marginBottom: 10 }}
              onClick={() => props.onSelect({ type: "all" })}
            >
              Semua Perangkat
            </button>

            {others.length === 0 ? (
              <div className="emptyState">
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                  <EyeOff />
                </div>
                Belum ada perangkat lain
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {others.map((d) => {
                  const active = props.selected.type === "device" && props.selected.deviceId === d.deviceId;
                  return (
                    <div
                      key={d.deviceId}
                      className={`deviceItem ${active ? "active" : ""}`}
                      onClick={() => props.onSelect({ type: "device", deviceId: d.deviceId })}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="deviceLeft">
                        <DeviceIcon type={d.type} />
                        <div style={{ minWidth: 0 }}>
                          <div className="deviceName">{d.name}</div>
                          <div className="deviceType">{deviceTypeLabel(d.type)}</div>
                        </div>
                      </div>
                      <div className="badgeOnline" title="Online" />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
