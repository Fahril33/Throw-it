import React, { useMemo, useRef, useState } from "react";
import { ChevronDown, Pencil, Send } from "lucide-react";
import Modal from "./Modal";
import { setDeviceName, getDeviceName } from "../storage/local";

export default function HeaderBar(props: {
  connected: boolean;
  deviceName: string;
  onRename: (name: string) => void;
  onOpenAdmin: () => void;
  onGoHome: () => void;
  targetLabel: string;
  onPickTarget: () => void;
  mode: "fast" | "balanced";
  onModeChange: (m: "fast" | "balanced") => void;
  isAdminRoute: boolean;
  compact: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(props.deviceName);
  const holdTimer = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const holdStart = useRef<number | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  const statusText = useMemo(() => {
    if (props.connected) return "Online";
    return "Menghubungkan...";
  }, [props.connected]);

  return (
    <>
      <div className="header">
        <div className="headerLeft">
        <div
          className="brand"
          style={{ userSelect: "none" }}
        >
          <div
            className="brandLogo holdLogo"
            role="button"
            tabIndex={0}
            title="Klik untuk kembali • Hold 5 detik untuk Admin"
            onMouseDown={() => {
              holdStart.current = Date.now();
              setHoldProgress(0);
              holdTimer.current = window.setTimeout(() => {
                props.onOpenAdmin();
              }, 5000);

              const tick = () => {
                if (!holdStart.current) return;
                const p = Math.min(1, (Date.now() - holdStart.current) / 5000);
                setHoldProgress(p);
                if (p < 1) raf.current = window.requestAnimationFrame(tick);
              };
              raf.current = window.requestAnimationFrame(tick);
            }}
            onMouseUp={() => {
              const started = holdStart.current;
              holdStart.current = null;
              if (holdTimer.current) window.clearTimeout(holdTimer.current);
              holdTimer.current = null;
              if (raf.current) window.cancelAnimationFrame(raf.current);
              raf.current = null;
              setHoldProgress(0);
              if (started && Date.now() - started < 350) props.onGoHome();
            }}
            onMouseLeave={() => {
              holdStart.current = null;
              if (holdTimer.current) window.clearTimeout(holdTimer.current);
              holdTimer.current = null;
              if (raf.current) window.cancelAnimationFrame(raf.current);
              raf.current = null;
              setHoldProgress(0);
            }}
            onTouchStart={() => {
              holdStart.current = Date.now();
              setHoldProgress(0);
              holdTimer.current = window.setTimeout(() => props.onOpenAdmin(), 5000);
              const tick = () => {
                if (!holdStart.current) return;
                const p = Math.min(1, (Date.now() - holdStart.current) / 5000);
                setHoldProgress(p);
                if (p < 1) raf.current = window.requestAnimationFrame(tick);
              };
              raf.current = window.requestAnimationFrame(tick);
            }}
            onTouchEnd={() => {
              const started = holdStart.current;
              holdStart.current = null;
              if (holdTimer.current) window.clearTimeout(holdTimer.current);
              holdTimer.current = null;
              if (raf.current) window.cancelAnimationFrame(raf.current);
              raf.current = null;
              setHoldProgress(0);
              if (started && Date.now() - started < 350) props.onGoHome();
            }}
          >
            {holdProgress > 0 ? (
              <div className="holdOverlay">
                <div className="holdBar">
                  <div className="holdBarFill" style={{ width: `${Math.round(holdProgress * 100)}%` }} />
                </div>
                <div className="holdText">{Math.max(0, 5 - Math.floor(holdProgress * 5))}s</div>
              </div>
            ) : null}
          </div>
          <div className="brandName">ThrowIt</div>
        </div>
        </div>

        <div className="headerCenter">
          {!props.compact ? (
            <button className="targetBtn headerTargetBtn" onClick={props.onPickTarget} title="Pilih target">
              <Send size={16} color="rgba(255,255,255,0.85)" />
              <div className="targetText">{props.targetLabel}</div>
              <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
            </button>
          ) : null}

          <div className="seg modeSeg" title="Mode transfer">
            <button className={props.mode === "fast" ? "active" : ""} onClick={() => props.onModeChange("fast")}>
              Fast
            </button>
            <button className={props.mode === "balanced" ? "active" : ""} onClick={() => props.onModeChange("balanced")}>
              Balanced
            </button>
          </div>

          {props.isAdminRoute ? (
            <div className="seg adminSeg" title="Admin">
              <button className="active" onClick={props.onOpenAdmin}>
                Admin
              </button>
              <button onClick={props.onGoHome}>Kembali</button>
            </div>
          ) : null}
        </div>

        <div className="headerRight">
          <div className="pill">
            <button
              className="deviceNameBtn"
              onClick={() => {
                setName(getDeviceName());
                setOpen(true);
              }}
              title="Klik untuk ganti nama device"
            >
              {props.deviceName}
            </button>
            <Pencil size={14} color="rgba(255,255,255,0.7)" />
          </div>

          <div className="pill">
            <div className={`statusDot ${props.connected ? "online" : ""}`} />
            <div className="statusText">{statusText}</div>
          </div>
        </div>
      </div>

      <Modal title="Ganti Nama Device" open={open} onClose={() => setOpen(false)}>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Masukkan nama device"
          autoFocus
        />
        <div className="modalActions">
          <button className="btn btnSmall" onClick={() => setOpen(false)}>
            Batal
          </button>
          <button
            className="btn btnPrimary btnSmall"
            onClick={() => {
              const next = name.trim().slice(0, 24) || "Device";
              setDeviceName(next);
              props.onRename(next);
              setOpen(false);
            }}
          >
            Simpan
          </button>
        </div>
      </Modal>
    </>
  );
}
