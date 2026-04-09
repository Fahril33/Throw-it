import type { DeviceType } from "../utils/device";

export type OnlineDevice = {
  deviceId: string;
  name: string;
  type: DeviceType;
  lastSeenAt: number;
};

export type TransferTarget =
  | { type: "all" }
  | { type: "device"; deviceId: string };

export type TransferMeta = {
  transferId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunkSize: number;
  totalChunks: number;
  mode: "fast" | "balanced";
  to: TransferTarget;
  fromDeviceId: string;
  fromDeviceName: string;
  createdAt: number;
  sha256?: string;
};

export type ChatMessage = {
  id: string;
  text: string;
  fromDeviceId: string;
  fromDeviceName: string;
  ts: number;
};
