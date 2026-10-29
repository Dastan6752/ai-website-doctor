import type { FetchMeta } from "./types";

export interface ProxyResult {
  ok: boolean;
  text: string;
  httpStatus: number | null;
  contentType: string | null;
  finalUrl: string | null;
  proxy: string | null;
  /** true when the proxy re-serialised the markup instead of returning it byte-for-byte */
  normalised?: boolean;
  /** time of the successful attempt only (failed attempts excluded) */
  elapsedMs?: number;
  error?: string;
}

interface Proxy {
  id: string;
  label: string;
  /** only usable for HTML documents (not for robots.txt / css) */
  htmlOnly?: boolean;
  /** markup is re-serialised by the proxy, so byte counts are approximate */
  normalised?: boolean;
  headers?: Record<string, string>;
  build: (url: string) => string;
  parse: (res: Response) => Promise<Omit<ProxyResult, "ok" | "proxy">>;
}

/**
 * The browser cannot read another website directly (CORS), so the page source is
 * requested through public read-only proxies. This is disclosed in the UI because
 * it affects what we can and cannot measure (e.g. real server timing / headers).
 */
const PROXIES: Proxy[] = [
  {
    id: "allorigins-get",
    label: "api.allorigins.win",
    build: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    parse: async (res) => {
      const json = (await res.json()) as {
        contents?: string;
        status?: { http_code?: number; content_type?: string; url?: string };
      };
      return {
        text: json.contents ?? "",
        httpStatus: json.status?.http_code ?? null,
        contentType: json.status?.content_type ?? null,
        finalUrl: json.status?.url ?? null,
      };
    },
  },
  {
    id: "codetabs",
    label: "api.codetabs.com",
    build: (url) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
    parse: async (res) => ({
      text: await res.text(),
      httpStatus: res.status,
      contentType: res.headers.get("content-type"),
      finalUrl: null,
    }),
  },
  {
    id: "allorigins-raw",
    label: "api.allorigins.win (raw)",
    build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    parse: async (res) => ({
      text: await res.text(),
      httpStatus: res.status,
      contentType: res.headers.get("content-type"),
      finalUrl: null,
    }),
  },
  {
    id: "jina",
    label: "r.jina.ai",
    htmlOnly: true,
    normalised: true,
    headers: { "x-return-format": "html", "x-engine": "direct" },
    build: (url) => `https://r.jina.ai/${url}`,
    parse: async (res) => ({
      text: await res.text(),
      httpStatus: res.status,
      contentType: "text/html",
      finalUrl: null,
    }),
  },
];

/** Proxies that recently timed out or 5xx'd. Skip them so one dead relay doesn't stall the whole scan. */
const cooldownUntil = new Map<string, number>();
const COOLDOWN_MS = 90_000;

function isCooling(id: string): boolean {
  return Date.now() < (cooldownUntil.get(id) ?? 0);
}
function markCooling(id: string) {
  cooldownUntil.set(id, Date.now() + COOLDOWN_MS);
}
function markHealthy(id: string) {
  cooldownUntil.delete(id);
}

export function hasHealthyRawProxy(): boolean {
  return PROXIES.some((p) => !p.htmlOnly && !isCooling(p.id));
}

async function attemptProxy(proxy: Proxy, target: string, timeoutMs: number): Promise<ProxyResult> {
  const attemptStart = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(proxy.build(target), {
      signal: controller.signal,
      redirect: "follow",
      headers: proxy.headers,
    });
    if (!res.ok && res.status >= 400) {
      if (res.status >= 500) markCooling(proxy.id);
      throw new Error(`${proxy.label} replied with HTTP ${res.status}.`);
    }
    const parsed = await proxy.parse(res);
    if (!parsed.text || parsed.text.trim().length === 0) {
      throw new Error(`${proxy.label} returned an empty response.`);
    }
    markHealthy(proxy.id);
    return {
      ok: true,
      proxy: proxy.label,
      normalised: proxy.normalised,
      elapsedMs: Date.now() - attemptStart,
      ...parsed,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const timedOut = /abort/i.test(msg);
    if (timedOut) markCooling(proxy.id);
    throw new Error(
      timedOut ? `${proxy.label} timed out after ${Math.round(timeoutMs / 1000)}s.` : msg.includes(proxy.label) ? msg : `${proxy.label} could not be reached (${msg}).`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Race a set of proxies and return the first successful body.
 * Losers keep running until their own timeout; we just ignore them.
 */
async function raceProxies(list: Proxy[], target: string, timeoutMs: number): Promise<{ result?: ProxyResult; errors: string[] }> {
  if (list.length === 0) return { errors: [] };
  const errors: string[] = [];
  return await new Promise((resolve) => {
    let pending = list.length;
    let settled = false;
    for (const proxy of list) {
      attemptProxy(proxy, target, timeoutMs)
        .then((result) => {
          if (!settled) {
            settled = true;
            resolve({ result, errors });
          }
        })
        .catch((err) => {
          errors.push(err instanceof Error ? err.message : String(err));
          pending -= 1;
          if (!settled && pending === 0) resolve({ errors });
        });
    }
  });
}

export async function fetchThroughProxy(
  target: string,
  opts: { timeoutMs?: number; preferredProxyId?: string | null; htmlDocument?: boolean } = {},
): Promise<ProxyResult> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const usable = PROXIES.filter((p) => (p.htmlOnly ? opts.htmlDocument === true : true));

  const raw = usable.filter((p) => !p.htmlOnly);
  const htmlFallbacks = usable.filter((p) => p.htmlOnly);

  const preferred = opts.preferredProxyId ? raw.filter((p) => p.id === opts.preferredProxyId && !isCooling(p.id)) : [];
  const healthyRaw = raw.filter((p) => !isCooling(p.id) && p.id !== opts.preferredProxyId);
  const coolingRaw = raw.filter((p) => isCooling(p.id));

  const errors: string[] = [];

  // 1. Preferred healthy proxy first (single attempt).
  if (preferred.length) {
    try {
      return await attemptProxy(preferred[0], target, timeoutMs);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  // 2. Race remaining healthy raw proxies so one dead relay doesn't serialise the wait.
  if (healthyRaw.length) {
    const raced = await raceProxies(healthyRaw, target, timeoutMs);
    errors.push(...raced.errors);
    if (raced.result) return raced.result;
  }

  // 3. HTML documents: try the headless-browser fallback (jina) which is often the only one up.
  if (opts.htmlDocument && htmlFallbacks.length) {
    const raced = await raceProxies(
      htmlFallbacks.filter((p) => !isCooling(p.id)),
      target,
      Math.max(timeoutMs, 12000),
    );
    errors.push(...raced.errors);
    if (raced.result) return raced.result;
  }

  // 4. Last resort: retry cooling raw proxies (they may have recovered).
  if (coolingRaw.length) {
    const raced = await raceProxies(coolingRaw, target, Math.min(timeoutMs, 5000));
    errors.push(...raced.errors);
    if (raced.result) return raced.result;
  }

  return {
    ok: false,
    text: "",
    httpStatus: null,
    contentType: null,
    finalUrl: null,
    proxy: null,
    error: errors.filter(Boolean).slice(-3).join(" ") || "No proxy responded.",
  };
}

export function normaliseUrl(raw: string): { url: URL | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { url: null, error: "Please enter a website address." };
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { url: null, error: "That doesn't look like a valid web address." };
  }
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(url.hostname) || url.hostname === "[::1]") {
    return {
      url: null,
      error: "Local addresses can't be reached from the browser. Use the “Paste HTML” option instead.",
    };
  }
  if (!url.hostname.includes(".") || url.hostname.endsWith(".")) {
    return { url: null, error: "That web address is missing a valid domain (e.g. example.com)." };
  }
  return { url };
}

export function byteLength(text: string): number {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
  return text.length;
}

export function emptyFetchMeta(requestedUrl: string): FetchMeta {
  return {
    requestedUrl,
    finalUrl: requestedUrl,
    proxy: null,
    httpStatus: null,
    contentType: null,
    bytes: 0,
    elapsedMs: 0,
    notes: [],
  };
}
