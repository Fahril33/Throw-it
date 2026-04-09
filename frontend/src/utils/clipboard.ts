export async function copyText(text: string) {
  // Best case: secure context clipboard API.
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true as const, method: "clipboard" as const };
    }
  } catch {
    // fall through
  }

  // Fallback for non-secure origins (LAN http://IP).
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (ok) return { ok: true as const, method: "execCommand" as const };
  } catch {
    // fall through
  }

  return { ok: false as const };
}

