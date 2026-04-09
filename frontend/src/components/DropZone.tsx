import React, { useMemo, useRef, useState } from "react";
import { Folder } from "lucide-react";

export default function DropZone(props: {
  onFiles: (files: File[]) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [active, setActive] = useState(false);
  const cls = useMemo(() => `dropZone ${active ? "active" : ""}`, [active]);

  return (
    <div
      className={`${cls} ${props.className ?? ""}`.trim()}
      style={props.style}
      onDragEnter={(e) => {
        e.preventDefault();
        setActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setActive(false);
        const files = Array.from(e.dataTransfer.files ?? []).filter(Boolean);
        if (files.length) props.onFiles(files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).filter(Boolean);
          if (files.length) props.onFiles(files);
          e.currentTarget.value = "";
        }}
      />

      <div className="dropInner">
        <Folder className="folderIcon" />
        <div className="dropTitle">Drop file di sini</div>
        <div className="dropSub">atau klik untuk pilih — semua jenis file didukung</div>
      </div>
    </div>
  );
}
