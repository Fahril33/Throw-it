import React from "react";
import { EyeOff, Laptop, Smartphone, Tablet } from "lucide-react";
import type { OnlineDevice } from "../socket/types";
import { deviceTypeLabel } from "../utils/device";

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
}) {
  const others = props.devices.filter((d) => d.deviceId !== props.meDeviceId);

  return (
    <div className="panel leftPanel">
      <div className="panelHeader">
        <div className="panelTitle">PERANGKAT ONLINE</div>
      </div>

      <div className="list">
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
      </div>
    </div>
  );
}
