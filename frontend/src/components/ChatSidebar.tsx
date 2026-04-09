import React, { useMemo, useState } from "react";
import { Send } from "lucide-react";
import type { ChatMessage } from "../socket/types";
import type { Socket } from "socket.io-client";

export default function ChatSidebar(props: {
  socket: Socket | null;
  chat: ChatMessage[];
  meDeviceId: string;
  filter: { type: "all" } | { type: "device"; deviceId: string };
  filterLabel: string;
}) {
  const [text, setText] = useState("");

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
              <div className="chatText">{m.text}</div>
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
    </div>
  );
}
