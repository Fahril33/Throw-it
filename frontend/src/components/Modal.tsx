import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal(props: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  const sizeClass = props.size === "sm" ? "modalSm" : props.size === "lg" ? "modalLg" : "modalMd";

  return (
    <div className="modalOverlay" onMouseDown={props.onClose}>
      <div className={`modal ${sizeClass}`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modalHeader">
          <div className="modalTitle">{props.title}</div>
          <button className="modalClose" onClick={props.onClose} title="Tutup" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="modalBody">{props.children}</div>
        {props.footer ? <div className="modalFooter">{props.footer}</div> : null}
      </div>
    </div>
  );
}
