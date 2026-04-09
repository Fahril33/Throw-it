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
};

export type TransferSession = TransferMeta & {
  received: boolean[];
  receivedCount: number;
  sessionDir: string;
  chunksDir: string;
};
