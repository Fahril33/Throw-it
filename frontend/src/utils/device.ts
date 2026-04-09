export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export function guessDeviceTypeFromUA(ua: string): DeviceType {
  const u = ua.toLowerCase();
  if (u.includes("ipad") || (u.includes("mac") && "ontouchend" in window)) return "tablet";
  if (u.includes("tablet")) return "tablet";
  if (u.includes("android") && !u.includes("mobile")) return "tablet";
  if (u.includes("mobi") || u.includes("android") || u.includes("iphone")) return "mobile";
  if (u.includes("windows") || u.includes("mac os") || u.includes("linux")) return "desktop";
  return "unknown";
}

export function deviceTypeLabel(type: DeviceType) {
  if (type === "desktop") return "PC/Laptop";
  if (type === "mobile") return "HP";
  if (type === "tablet") return "Tablet";
  return "Unknown";
}
