export function safeFilename(input: string) {
  const trimmed = input.trim().slice(0, 180);
  const noNull = trimmed.replaceAll("\0", "");
  const cleaned = noNull.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
  return cleaned.length ? cleaned : "file";
}
