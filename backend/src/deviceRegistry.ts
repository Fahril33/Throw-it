export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export type DeviceInfo = {
  deviceId: string;
  deviceToken: string;
  name: string;
  nameIsAuto: boolean;
  type: DeviceType;
  ua?: string;
  socketId: string;
  connectedAt: number;
  lastSeenAt: number;
};

export class DeviceRegistry {
  private devicesById = new Map<string, DeviceInfo>();

  upsert(info: Omit<DeviceInfo, "connectedAt" | "lastSeenAt">) {
    const now = Date.now();
    const existing = this.devicesById.get(info.deviceId);
    const connectedAt = existing?.connectedAt ?? now;
    const next: DeviceInfo = {
      ...info,
      connectedAt,
      lastSeenAt: now
    };
    this.devicesById.set(info.deviceId, next);
    return next;
  }

  removeBySocketId(socketId: string) {
    for (const [id, device] of this.devicesById.entries()) {
      if (device.socketId === socketId) {
        this.devicesById.delete(id);
      }
    }
  }

  updateName(deviceId: string, name: string) {
    const existing = this.devicesById.get(deviceId);
    if (!existing) return;
    existing.name = name;
    existing.nameIsAuto = false;
    existing.lastSeenAt = Date.now();
  }

  get(deviceId: string) {
    return this.devicesById.get(deviceId);
  }

  list() {
    return Array.from(this.devicesById.values()).map((d) => ({
      deviceId: d.deviceId,
      name: d.name,
      type: d.type,
      lastSeenAt: d.lastSeenAt
    }));
  }
}
