import os from "node:os";

export function getLanUrls(port: number) {
  const interfaces = os.networkInterfaces();
  const urls: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const entries = interfaces[name] ?? [];
    for (const entry of entries) {
      if (!entry) continue;
      if (entry.family !== "IPv4") continue;
      if (entry.internal) continue;
      urls.push(`http://${entry.address}:${port}`);
    }
  }

  return urls;
}
