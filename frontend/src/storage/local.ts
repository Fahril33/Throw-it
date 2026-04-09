import { uuidv4 } from "../utils/id";

const DEVICE_ID_KEY = "throwit.deviceId";
const DEVICE_TOKEN_KEY = "throwit.deviceToken";
const DEVICE_NAME_KEY = "throwit.deviceName";
const RECEIVED_HISTORY_KEY = "throwit.receivedHistory";
const TRANSFER_HISTORY_KEY = "throwit.transferHistory";

export type ReceivedHistoryItem = {
  transferId: string;
  fileName: string;
  fileSize: number;
  fromDeviceName: string;
  mode?: "fast" | "balanced";
  receivedAt: number;
  sha256?: string;
};

export type TransferHistoryItem = {
  transferId: string;
  direction: "out" | "in";
  fileName: string;
  fileSize: number;
  mimeType: string;
  toLabel: string;
  fromLabel: string;
  mode: "fast" | "balanced";
  createdAt: number;
  finishedAt?: number;
  status: "ready" | "done" | "error";
  error?: string;
  meta?: any;
};

export function getOrCreateDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = uuidv4();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function getOrCreateDeviceToken() {
  const existing = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (existing) return existing;
  const token = uuidv4();
  localStorage.setItem(DEVICE_TOKEN_KEY, token);
  return token;
}

export function getDeviceName() {
  return localStorage.getItem(DEVICE_NAME_KEY) ?? "";
}

export function setDeviceName(name: string) {
  localStorage.setItem(DEVICE_NAME_KEY, name);
}

export function loadReceivedHistory(): ReceivedHistoryItem[] {
  try {
    const raw = localStorage.getItem(RECEIVED_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function addReceivedHistory(item: ReceivedHistoryItem) {
  const current = loadReceivedHistory();
  current.unshift(item);
  localStorage.setItem(RECEIVED_HISTORY_KEY, JSON.stringify(current.slice(0, 300)));
}

export function clearReceivedHistory() {
  localStorage.removeItem(RECEIVED_HISTORY_KEY);
}

export function loadTransferHistory(): TransferHistoryItem[] {
  try {
    const raw = localStorage.getItem(TRANSFER_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveTransferHistory(items: TransferHistoryItem[]) {
  localStorage.setItem(TRANSFER_HISTORY_KEY, JSON.stringify(items.slice(0, 250)));
}

export function clearTransferHistory() {
  localStorage.removeItem(TRANSFER_HISTORY_KEY);
}
