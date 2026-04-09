import React, { useEffect, useMemo } from "react";
import Modal from "../Modal";

function filesFromPaste(e: ClipboardEvent) {
  const dt = e.clipboardData;
  if (!dt) return [];
  const files: File[] = [];
  if (dt.files && dt.files.length) files.push(...Array.from(dt.files));
  for (const item of Array.from(dt.items)) {
    if (item.kind !== "file") continue;
    const f = item.getAsFile();
    if (f) files.push(f);
  }
  const unique = files.filter((f, idx) => files.findIndex((x) => x.name === f.name && x.size === f.size) === idx);
  return unique;
}

export default function PasteFilesModal(props: {
  open: boolean;
  onClose: () => void;
  onFiles: (files: File[]) => void;
}) {
  const footer = useMemo(
    () => (
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button className="btn btnPrimary btnSmall" onClick={props.onClose}>
          Tutup
        </button>
      </div>
    ),
    [props.onClose]
  );

  useEffect(() => {
    if (!props.open) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = filesFromPaste(e);
      if (!files.length) return;
      e.preventDefault();
      props.onFiles(files);
      props.onClose();
    };
    window.addEventListener("paste", onPaste as any);
    return () => window.removeEventListener("paste", onPaste as any);
  }, [props.open, props.onFiles, props.onClose]);

  return (
    <Modal title="Paste File" open={props.open} onClose={props.onClose} footer={footer} size="sm">
      <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.55 }}>
        <div>
          Tekan <b>Ctrl+V</b> (atau paste dari menu di HP) untuk menempelkan file dari clipboard.
        </div>
        <div style={{ marginTop: 10, color: "rgba(255,255,255,0.6)" }}>
          Catatan: akses clipboard langsung via tombol sering dibatasi browser di jaringan LAN (http://IP).
        </div>
      </div>
    </Modal>
  );
}

