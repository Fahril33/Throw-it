import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getOrCreateDeviceId, getOrCreateDeviceToken, getDeviceName, setDeviceName } from "../storage/local";
import { guessDeviceTypeFromUA } from "../utils/device";
import type { ChatMessage, OnlineDevice, TransferMeta } from "./types";

type SocketState = {
  connected: boolean;
  devices: OnlineDevice[];
  chat: ChatMessage[];
  incoming: TransferMeta[];
};

export function useThrowItSocket() {
  const [state, setState] = useState<SocketState>({
    connected: false,
    devices: [],
    chat: [],
    incoming: []
  });

  const socketRef = useRef<Socket | null>(null);
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const deviceToken = useMemo(() => getOrCreateDeviceToken(), []);

  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelayMax: 2000
    });
    socketRef.current = socket;

    const hello = () => {
      const ua = navigator.userAgent;
      socket.emit(
        "hello",
        {
          deviceId,
          deviceToken,
          name: getDeviceName(),
          type: guessDeviceTypeFromUA(ua),
          ua
        },
        (res: any) => {
          if (res?.ok) {
            if (res.assignedName) {
              setDeviceName(res.assignedName);
            }
            setState((s) => ({
              ...s,
              devices: res.devices ?? s.devices,
              chat: res.chat ?? s.chat
            }));
          }
        }
      );
    };

    socket.on("connect", () => {
      setState((s) => ({ ...s, connected: true }));
      hello();
    });
    socket.on("disconnect", () => setState((s) => ({ ...s, connected: false })));

    socket.on("devices:update", (payload: { devices: OnlineDevice[] }) => {
      setState((s) => ({ ...s, devices: payload.devices ?? [] }));
    });

    socket.on("chat:new", (msg: ChatMessage) => {
      setState((s) => ({ ...s, chat: [...s.chat, msg].slice(-200) }));
    });

    socket.on("transfer:available", (meta: TransferMeta) => {
      setState((s) => ({ ...s, incoming: [meta, ...s.incoming] }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [deviceId, deviceToken]);

  return { socket: socketRef.current, state, deviceId };
}
