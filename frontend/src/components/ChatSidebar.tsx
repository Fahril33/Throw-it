import React, { useEffect, useMemo, useRef, useState } from "react";
import { Send, X, File as FileIcon } from "lucide-react";
import type { ChatMessage } from "../socket/types";
import type { Socket } from "socket.io-client";
import { copyText } from "../utils/clipboard";
import LinkPreviewCard, { type LinkPreview } from "./LinkPreviewCard";
import Toast from "./Toast";

const urlRegex = /\bhttps?:\/\/[^\s<>()]+/gi;

function extractFirstUrl(text: string) {
  const m = text.match(urlRegex);
  return m?.[0] ?? null;
}

function renderTextWithLinks(text: string) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const matches = Array.from(text.matchAll(urlRegex));
  for (const match of matches) {
    const url = match[0];
    const idx = match.index ?? 0;
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
    parts.push(
      <a key={`${url}-${idx}`} href={url} target="_blank" rel="noreferrer">
        {url}
      </a>
    );
    lastIndex = idx + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function ChatSidebar(props: {
  socket: Socket | null;
  chat: ChatMessage[];
  meDeviceId: string;
  filter: { type: "all" } | { type: "device"; deviceId: string };
  filterLabel: string;
  headerTop?: React.ReactNode;
  previewItem?: { url: string; mimeType: string; name: string } | null;
  onClearPreview?: () => void;
}) {
  const [tab, setTab] = useState<"chat" | "preview">("chat");
  const [text, setText] = useState("");
  const [toast, setToast] = useState<string>("");
  const [toastShow, setToastShow] = useState(false);
  const previewCache = useRef(new Map<string, LinkPreview>());
  const [, bumpPreview] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const t = text.trim();
    if (!t || !props.socket) return;
    setText("");
    await new Promise((resolve) => props.socket!.emit("chat:send", { text: t }, resolve));
  };

  const sorted = useMemo(() => props.chat.slice(-200), [props.chat]);
  const shown = useMemo(() => {
    if (props.filter.type === "all") return sorted;
    const targetId = props.filter.deviceId;
    return sorted.filter((m) => m.fromDeviceId === targetId || m.fromDeviceId === props.meDeviceId);
  }, [sorted, props.filter, props.meDeviceId]);

  useEffect(() => {
    if (props.previewItem) {
      setTab("preview");
    }
  }, [props.previewItem]);

  useEffect(() => {
    // Prefetch previews for messages containing URLs (first URL only).
    const urls = shown
      .map((m) => extractFirstUrl(m.text))
      .filter((u): u is string => Boolean(u));

    const unique = Array.from(new Set(urls)).slice(0, 20);
    const toFetch = unique.filter((u) => !previewCache.current.has(u));
    if (toFetch.length === 0) return;

    let cancelled = false;
    void (async () => {
      for (const u of toFetch) {
        try {
          const res = await fetch(`/api/link-preview?url=${encodeURIComponent(u)}`);
          const json = (await res.json()) as LinkPreview;
          if (cancelled) return;
          previewCache.current.set(u, json);
          bumpPreview((x) => x + 1);
        } catch {
          // ignore
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shown]);

  useEffect(() => {
    if (tab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [shown, tab]);

  return (
    <div className="panel rightPanel">
      <div className={`panelHeader ${props.headerTop ? "panelHeaderStack" : ""}`} style={{ paddingBottom: 0 }}>
        {props.headerTop}
        <div style={{ display: "flex", width: "100%", gap: 10 }}>
          <button
            onClick={() => setTab("chat")}
            style={{
              flex: 1,
              padding: "10px 0",
              background: "transparent",
              border: "none",
              borderBottom: tab === "chat" ? "2px solid #fff" : "2px solid transparent",
              color: tab === "chat" ? "#fff" : "rgba(255,255,255,0.55)",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            CHAT {props.filterLabel !== "Semua" && `(${props.filterLabel})`}
          </button>
          <button
            onClick={() => setTab("preview")}
            style={{
              flex: 1,
              padding: "10px 0",
              background: "transparent",
              border: "none",
              borderBottom: tab === "preview" ? "2px solid #fff" : "2px solid transparent",
              color: tab === "preview" ? "#fff" : "rgba(255,255,255,0.55)",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            PREVIEW
          </button>
        </div>
      </div>

      {tab === "chat" ? (
        <>
          <div className="chatBody">
            {shown.length === 0 ? (
              <div className="emptyState">Belum ada chat.</div>
            ) : (
              shown.map((m) => (
                <div className="chatMsg" key={m.id}>
                  <div className="chatFrom">{m.fromDeviceName}</div>
                  <div
                    className="chatText"
                    onDoubleClick={async () => {
                      const url = extractFirstUrl(m.text);
                      if (url) return; // don't copy if it contains URL (avoid accidental)
                      const res = await copyText(m.text);
                      if (res.ok) {
                        setToast("Copied");
                        setToastShow(true);
                      } else {
                        window.prompt("Copy:", m.text);
                      }
                    }}
                    title={extractFirstUrl(m.text) ? undefined : "Double click untuk copy"}
                  >
                    {renderTextWithLinks(m.text)}
                    {(() => {
                      const u = extractFirstUrl(m.text);
                      if (!u) return null;
                      const preview = previewCache.current.get(u);
                      if (!preview) return null;
                      return <LinkPreviewCard preview={preview} />;
                    })()}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatInputRow">
            <input
              className="chatInput"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tulis pesan..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
            />
            <button className="sendBtn" onClick={() => void send()} title="Kirim">
              <Send size={18} color="white" />
            </button>
          </div>
        </>
      ) : (
        <div className="chatBody" style={{ display: "flex", flexDirection: "column", padding: 14 }}>
          {props.previewItem ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: 10,
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  marginBottom: 10
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, wordBreak: "break-all" }}>{props.previewItem.name}</div>
                <button className="btn btnSmall" onClick={props.onClearPreview} title="Tutup Preview">
                  <X size={16} />
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {(() => {
                  const url = props.previewItem.url;
                  const name = props.previewItem.name;
                  const mimeType = props.previewItem.mimeType;
                  const isBlobUrl = url.startsWith("blob:");

                  if (mimeType.startsWith("image/")) {
                    return (
                      <img
                        src={url}
                        alt={name}
                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }}
                      />
                    );
                  }

                  if (mimeType.startsWith("video/")) {
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    return <video src={url} controls style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} />;
                  }

                  const isPdf = mimeType === "application/pdf" || (isBlobUrl && name.toLowerCase().endsWith(".pdf"));
                  if (isPdf) {
                    return (
                      <iframe
                        src={url}
                        title={name}
                        style={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          borderRadius: 8,
                          backgroundColor: "#fff",
                          minHeight: "500px"
                        }}
                      />
                    );
                  }

                  const isText = mimeType.startsWith("text/") || (isBlobUrl && name.toLowerCase().endsWith(".txt"));
                  if (isText) {
                    return (
                      <iframe
                        src={url}
                        title={name}
                        style={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          borderRadius: 8,
                          backgroundColor: "#f9f9f9",
                          padding: 10,
                          minHeight: "500px"
                        }}
                      />
                    );
                  }

                  return (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 10,
                        color: "rgba(255,255,255,0.6)"
                      }}
                    >
                      <FileIcon size={48} />
                      <div style={{ textAlign: "center" }}>
                        Preview tidak didukung untuk tipe file ini.
                        <br />
                        <span style={{ fontSize: 12 }}>({mimeType})</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="emptyState" style={{ marginTop: 40 }}>
              Tidak ada file yang dipilih untuk preview.<br /><br />
              Klik tombol preview (icon mata) pada daftar transfer untuk melihat file.
            </div>
          )}
        </div>
      )}

      <Toast
        text={toast}
        show={toastShow}
        onDone={() => {
          setToastShow(false);
          setToast("");
        }}
      />
    </div>
  );
}
