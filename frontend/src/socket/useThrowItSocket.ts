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
      
      // Play sound notification if message is from someone else
      if (msg.fromDeviceId !== deviceId) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.type = "square";
          osc.frequency.setValueAtTime(880, ctx.currentTime); // Pitch A5
          osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1); // Slide up
          
          gain.gain.setValueAtTime(9.9, ctx.currentTime); // Volume
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3); // Fade out
          
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.3);
        } catch (e) {}
      }
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
