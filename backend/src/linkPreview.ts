type PreviewResult =
  | {
      ok: true;
      url: string;
      title?: string;
      description?: string;
      image?: string;
      siteName?: string;
      displayUrl: string;
    }
  | { ok: false; error: string };

const cache = new Map<string, { ts: number; value: PreviewResult }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function isPrivateOrLoopbackIPv4(ip: string) {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isBlockedHost(hostname: string) {
  const h = hostname.toLowerCase();
  if (h === "localhost") return true;
  if (h.endsWith(".localhost")) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return isPrivateOrLoopbackIPv4(h);
  return false;
}

function pickMeta(html: string, property: string) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const m = html.match(re);
  return m?.[1]?.trim();
}

function pickTitle(html: string) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim();
}

function normalizeText(input?: string) {
  if (!input) return undefined;
  const t = input.replace(/\s+/g, " ").trim();
  return t.length ? t.slice(0, 280) : undefined;
}

function safeUrl(input?: string) {
  if (!input) return undefined;
  try {
    const u = new URL(input);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

export async function getLinkPreview(rawUrl: string): Promise<PreviewResult> {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: "UNSUPPORTED_PROTOCOL" };
    }
    if (isBlockedHost(url.hostname)) {
      // Basic SSRF guard for localhost/private ranges.
      return { ok: false, error: "BLOCKED_HOST" };
    }

    const cached = cache.get(url.toString());
    const now = Date.now();
    if (cached && now - cached.ts < CACHE_TTL_MS) return cached.value;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "ThrowIt-LinkPreview/1.0",
        Accept: "text/html,application/xhtml+xml"
      }
    });
    clearTimeout(timer);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      const value: PreviewResult = {
        ok: true,
        url: url.toString(),
        displayUrl: url.host
      };
      cache.set(url.toString(), { ts: now, value });
      return value;
    }

    const text = await res.text();
    const html = text.slice(0, 256_000);

    const ogTitle = pickMeta(html, "og:title");
    const ogDesc = pickMeta(html, "og:description");
    const ogImage = pickMeta(html, "og:image");
    const ogSite = pickMeta(html, "og:site_name");

    const title = normalizeText(ogTitle ?? pickTitle(html));
    const description = normalizeText(ogDesc ?? pickMeta(html, "description"));
    const image = safeUrl(ogImage);
    const siteName = normalizeText(ogSite);

    const value: PreviewResult = {
      ok: true,
      url: url.toString(),
      displayUrl: url.host,
      title,
      description,
      image,
      siteName
    };

    cache.set(url.toString(), { ts: now, value });
    return value;
  } catch {
    return { ok: false, error: "INVALID_URL" };
  }
}

