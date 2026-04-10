import React, { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
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
}) {
  const [text, setText] = useState("");
  const [toast, setToast] = useState<string>("");
  const [toastShow, setToastShow] = useState(false);
  const previewCache = useRef(new Map<string, LinkPreview>());
  const [, bumpPreview] = useState(0);

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

  return (
    <div className="panel rightPanel">
      <div className="panelHeader">
        <div>
          <div className="panelTitle">CHAT</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 700, marginTop: 6 }}>
            Filter: {props.filterLabel}
          </div>
        </div>
      </div>

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
      </div>

      <div className="chatInputRow">
        <input
          className="chatInput"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tulis pesan..."
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
        />
        <button className="sendBtn" onClick={() => void send()} title="Kirim">
          <Send size={18} color="white" />
        </button>
      </div>

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
