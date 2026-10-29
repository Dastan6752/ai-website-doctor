import { byteLength, fetchThroughProxy, hasHealthyRawProxy, normaliseUrl } from "./fetchSite";
import { accessibilityChecks, accessibilityNotChecked } from "./checks/accessibility";
import { mobileChecks, mobileNotChecked } from "./checks/mobile";
import { performanceChecks, performanceNotChecked } from "./checks/performance";
import { seoChecks, seoNotChecked } from "./checks/seo";
import {
  CATEGORY_ORDER,
  type AuditContext,
  type AuditReport,
  type CategoryId,
  type CategoryScore,
  type CheckResult,
  type ExtraFetches,
  type FetchMeta,
  type StyleSheetFetch,
} from "./types";

export type ProgressFn = (step: string, pct: number) => void;

export class AnalysisError extends Error {
  hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.hint = hint;
  }
}

function emptyExtras(): ExtraFetches {
  return {
    cssAttempted: false,
    css: [],
    robotsTxt: { attempted: false, ok: false, status: null, text: "" },
    sitemap: { attempted: false, ok: false, status: null, url: "" },
  };
}

function scoreOf(checks: CheckResult[]): CategoryScore {
  let earned = 0;
  let possible = 0;
  const counts = { pass: 0, warn: 0, fail: 0, info: 0, unknown: 0 };
  checks.forEach((c) => {
    counts[c.status] += 1;
    if (c.weight <= 0) return;
    if (c.status === "pass" || c.status === "warn" || c.status === "fail") {
      possible += c.weight;
      earned += c.status === "pass" ? c.weight : c.status === "warn" ? c.weight * 0.5 : 0;
    }
  });
  return {
    score: possible > 0 ? Math.round((earned / possible) * 100) : null,
    earned,
    possible,
    ...counts,
  };
}

function collectStylesheetUrls(doc: Document, base: URL | null, limit = 4): string[] {
  const urls: string[] = [];
  const links = Array.from(doc.querySelectorAll('link[rel~="stylesheet" i][href]'));
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    if (!href || href.startsWith("data:")) continue;
    try {
      const abs = base ? new URL(href, base.href).href : href;
      if (!/^https?:\/\//i.test(abs)) continue;
      if (!urls.includes(abs)) urls.push(abs);
    } catch {
      /* skip */
    }
    if (urls.length >= limit) break;
  }
  return urls;
}

export async function analyzeUrl(rawUrl: string, onProgress: ProgressFn): Promise<AuditReport> {
  const { url, error } = normaliseUrl(rawUrl);
  if (!url) {
    throw new AnalysisError(error || "Invalid address", "Check for typos, then try again.");
  }

  onProgress(`Requesting ${url.hostname} …`, 10);
  const started = performance.now();
  const page = await fetchThroughProxy(url.href, { timeoutMs: 13000, htmlDocument: true });
  const elapsedMs = page.elapsedMs ?? Math.round(performance.now() - started);

  if (!page.ok) {
    throw new AnalysisError(
      `We could not download ${url.hostname}.`,
      `${page.error ?? "No proxy responded."} This usually means the site blocks automated requests, is password-protected, is offline, or every public proxy we use is rate-limited right now. You can still audit the page by opening it, choosing “View page source”, and pasting the HTML into the “Paste HTML” tab.`,
    );
  }

  const contentType = page.contentType || "";
  if (contentType && !/html|text|xml/i.test(contentType)) {
    throw new AnalysisError(
      `That address returned “${contentType}”, not a web page.`,
      "Point the tool at a normal HTML page (for example your homepage) rather than a file or an API endpoint.",
    );
  }

  const fetchMeta: FetchMeta = {
    requestedUrl: url.href,
    finalUrl: page.finalUrl || url.href,
    proxy: page.proxy,
    httpStatus: page.normalised ? null : page.httpStatus,
    contentType: page.contentType,
    bytes: byteLength(page.text),
    elapsedMs,
    normalised: page.normalised === true,
    notes: [],
  };

  if (page.normalised) {
    fetchMeta.notes.push(
      `The usual proxies were unavailable, so the page was retrieved through ${page.proxy}, which re-writes the markup into a tidy, standard form before handing it over. The structure (tags, attributes, text) is your page's, but the exact file size and any formatting quirks are not, so treat the "size of the page's HTML file" check as approximate.`,
    );
  }

  if (fetchMeta.httpStatus && fetchMeta.httpStatus >= 400) {
    fetchMeta.notes.push(
      `The server replied with HTTP ${fetchMeta.httpStatus}. The checks below describe the page that was actually returned (often an error page), not your intended content.`,
    );
  }

  onProgress("Reading the HTML …", 35);
  const doc = new DOMParser().parseFromString(page.text, "text/html");

  const extras = emptyExtras();

  /* --- real secondary fetches: stylesheets, robots.txt, sitemap ---
     These need a byte-for-byte (non-normalising) proxy. If every raw proxy is
     in cooldown after timing out, we skip rather than wait another minute. */
  const canFetchRaw = hasHealthyRawProxy();

  const cssUrls = collectStylesheetUrls(doc, url, 4);
  if (cssUrls.length > 0 && canFetchRaw) {
    extras.cssAttempted = true;
    onProgress(`Downloading ${cssUrls.length} stylesheet${cssUrls.length > 1 ? "s" : ""} …`, 50);
    const results = await Promise.all(
      cssUrls.map(async (href): Promise<StyleSheetFetch> => {
        const r = await fetchThroughProxy(href, { timeoutMs: 7000, preferredProxyId: null });
        if (!r.ok) return { url: href, ok: false, bytes: 0, text: "", error: r.error };
        const trimmed = r.text.slice(0, 500_000);
        return { url: href, ok: true, bytes: byteLength(r.text), text: trimmed };
      }),
    );
    extras.css = results;
  } else if (cssUrls.length > 0) {
    fetchMeta.notes.push(
      `${cssUrls.length} stylesheet${cssUrls.length === 1 ? " was" : "s were"} linked from the page, but the byte-for-byte relays are not responding right now, so CSS was not downloaded. Responsive-CSS checks will only see inline <style> blocks.`,
    );
  }

  if (canFetchRaw) {
    onProgress("Checking robots.txt and sitemap …", 68);
    const robotsUrl = `${url.origin}/robots.txt`;
    const robotsRes = await fetchThroughProxy(robotsUrl, { timeoutMs: 7000 });
    extras.robotsTxt = {
      attempted: true,
      ok: robotsRes.ok && !/^\s*<(!doctype|html)/i.test(robotsRes.text),
      status: robotsRes.httpStatus,
      text: robotsRes.ok ? robotsRes.text.slice(0, 20000) : "",
    };

    const sitemapFromRobots = /sitemap:\s*(\S+)/i.exec(extras.robotsTxt.text)?.[1];
    const sitemapUrl = sitemapFromRobots || `${url.origin}/sitemap.xml`;
    const sitemapRes = await fetchThroughProxy(sitemapUrl, { timeoutMs: 7000 });
    extras.sitemap = {
      attempted: true,
      ok:
        sitemapRes.ok &&
        /<(urlset|sitemapindex)/i.test(sitemapRes.text) &&
        (sitemapRes.httpStatus === null || sitemapRes.httpStatus < 400),
      status: sitemapRes.httpStatus,
      url: sitemapUrl,
    };
  } else {
    fetchMeta.notes.push(
      "robots.txt and the XML sitemap were not requested, because the relays that can fetch non-HTML files are currently unreachable. Those checks are skipped rather than guessed.",
    );
  }

  onProgress("Running checks …", 85);
  const ctx: AuditContext = { url, html: page.text, doc, extras, fetchMeta, source: "url" };
  const report = buildReport(ctx, url.href);
  onProgress("Finishing report …", 100);
  return report;
}

export function analyzeHtml(html: string, label: string): AuditReport {
  if (!html.trim()) {
    throw new AnalysisError("No HTML was pasted.", "Copy your page source (Ctrl+U in most browsers) and paste it in.");
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  let url: URL | null = null;
  const canonical = doc.querySelector('link[rel="canonical" i]')?.getAttribute("href");
  const ogUrl = doc.querySelector('meta[property="og:url" i]')?.getAttribute("content");
  const guess = canonical || ogUrl || label;
  if (guess) {
    try {
      url = new URL(/^https?:\/\//i.test(guess) ? guess : `https://${guess}`);
    } catch {
      url = null;
    }
  }
  const ctx: AuditContext = {
    url,
    html,
    doc,
    extras: emptyExtras(),
    fetchMeta: {
      requestedUrl: url?.href || "pasted HTML",
      finalUrl: url?.href || "pasted HTML",
      proxy: null,
      httpStatus: null,
      contentType: "text/html (pasted)",
      bytes: byteLength(html),
      elapsedMs: 0,
      notes: [
        "This report was generated from HTML you pasted in, so no network requests were made. Checks that need to download stylesheets, robots.txt or the sitemap were skipped rather than guessed.",
      ],
    },
    source: "html",
  };
  return buildReport(ctx, url?.href || "Pasted HTML");
}

export { reportToMarkdown } from "./exportMarkdown";

function buildReport(ctx: AuditContext, target: string): AuditReport {
  const checks: CheckResult[] = [
    ...performanceChecks(ctx),
    ...mobileChecks(ctx),
    ...accessibilityChecks(ctx),
    ...seoChecks(ctx),
  ];

  const notChecked = [
    ...performanceNotChecked,
    ...mobileNotChecked,
    ...accessibilityNotChecked,
    ...seoNotChecked,
  ];

  const categories = Object.fromEntries(
    CATEGORY_ORDER.map((id) => [id, scoreOf(checks.filter((c) => c.category === id))]),
  ) as Record<CategoryId, CategoryScore>;

  const overall = scoreOf(checks);

  /* ---------- Contextual notes (facts, not verdicts) ---------- */
  const contextNotes: string[] = [];
  const bodyClone = ctx.doc.body?.cloneNode(true) as HTMLElement | undefined;
  bodyClone?.querySelectorAll("script, style, noscript, template").forEach((n) => n.remove());
  const visibleText = (bodyClone?.textContent || "").replace(/\s+/g, " ").trim();
  const scriptCount = ctx.doc.querySelectorAll("script").length;
  if (visibleText.length < 400 && scriptCount >= 3) {
    contextNotes.push(
      "This page delivers very little text in its HTML but loads several scripts, which strongly suggests the content is rendered by JavaScript in the browser. This tool reads the HTML as delivered, so checks about images, headings, links and text may be missing most of your real page.",
    );
  }
  if (ctx.doc.querySelector("frameset")) {
    contextNotes.push("This page uses an old HTML frameset. Results refer to the frameset document only, not the pages inside it.");
  }
  if (ctx.extras.cssAttempted) {
    const okCount = ctx.extras.css.filter((c) => c.ok).length;
    if (okCount < ctx.extras.css.length) {
      contextNotes.push(
        `${ctx.extras.css.length - okCount} of ${ctx.extras.css.length} stylesheets could not be downloaded, so CSS-based checks only cover the ${okCount} we could read.`,
      );
    }
  }
  if (ctx.fetchMeta?.notes.length) contextNotes.push(...ctx.fetchMeta.notes);

  return {
    source: ctx.source,
    target,
    finishedAt: new Date().toISOString(),
    fetchMeta: ctx.fetchMeta,
    extras: ctx.extras,
    checks,
    notChecked,
    categories,
    overall,
    contextNotes,
  };
}
