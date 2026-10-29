/**
 * One harness, one set of fixtures, two engines.
 * Engine A = v1 behaviour (HTML-only, no robots.txt/sitemap/CSS fetch, sequential proxies).
 * Engine B = the current merged engine on disk (Option B).
 * Fixtures contain known defects and a healthy control. Scores are computed by
 * each engine's own rules, then the same disagreements are surfaced.
 */
import { JSDOM } from "jsdom";

const { window } = new JSDOM("<!doctype html><html></html>", { url: "https://t/" });
(globalThis as any).DOMParser = window.DOMParser;
(globalThis as any).HTMLElement = window.HTMLElement;
(globalThis as any).Element = window.Element;
(globalThis as any).Document = window.Document;

const HARMFUL = `<!doctype html><html><head>
<meta name="robots" content="noindex">
<title>Hi</title>
<script src="/blocking.js"></script>
</head><body>
<h1>a</h1><h1>b</h1>
<img src="hero.jpg">
<a href="/x"></a><a href="/y">click here</a>
<form><input type="email" name="e"><button></button></form>
<div style="width:960px">w</div><p style="font-size:9px">t</p>
</body></html>`;

const HEALTHY = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Acme Bakery in Leeds | Fresh sourdough daily</title>
<meta name="description" content="Family bakery on Kirkgate, Leeds. Fresh sourdough, pastries and coffee. Open 7 days. Order online for next-day collection.">
<link rel="canonical" href="https://acme.test/"><link rel="icon" href="/favicon.ico">
<meta property="og:title" content="x"><meta property="og:description" content="y"><meta property="og:image" content="z">
<script type="application/ld+json">{"@type":"Bakery"}</script>
<style>@media (max-width:640px){a{d:block}} @media (max-width:1024px){a{g:1}} @media (min-width:1025px){w{m:1100}}</style>
</head><body><a href="#m">Skip to content</a>
<header><nav><a href="/">Home</a><a href="/menu">menu</a></nav></header>
<main id="m"><h1>Fresh sourdough baked every morning in Leeds</h1>
<h2>Today</h2><p>${"Our bakers start at 4am. ".repeat(40)}</p>
<img src="loaf.jpg" alt="loaf" width="800" height="600">
<form><label for="e">Email</label><input id="e" type="email" name="e"><button>Send</button></form></main>
<footer>© Acme</footer></body></html>`;

interface ACheck {
  id: string;
  status: string;
  weight: number;
}

/* Engine A — faithful reproduction of v1's rules (no robots.txt/sitemap/CSS fetch). */
function engineA(html: string, url: string): ACheck[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: ACheck[] = [];
  const add = (id: string, status: string, weight: number) => out.push({ id, status, weight });

  const title = (doc.querySelector("title")?.textContent || "").replace(/\s+/g, " ").trim();
  add("seo-title", !title ? "fail" : title.length < 15 || title.length > 65 ? "warn" : "pass", 3);
  const desc = (doc.querySelector('meta[name="description" i]')?.getAttribute("content") || "").trim();
  add("seo-description", !desc ? "fail" : desc.length < 50 || desc.length > 165 ? "warn" : "pass", 3);
  const h1 = doc.querySelectorAll("h1").length;
  add("seo-h1", h1 === 1 ? "pass" : h1 === 0 ? "fail" : "warn", 2);
  const robots = (doc.querySelector('meta[name="robots" i]')?.getAttribute("content") || "").toLowerCase();
  add("seo-indexable", /noindex/.test(robots) ? "fail" : /nofollow/.test(robots) ? "warn" : "pass", 3);
  add("seo-canonical", doc.querySelector('link[rel="canonical" i]') ? "pass" : "warn", 1);
  add("seo-social", ['og:title','og:description','og:image'].every(p => doc.querySelector(`meta[property="${p}" i]`)?.getAttribute("content")) ? "pass" : "warn", 1);
  add("seo-https", url.startsWith("https:") ? "pass" : "fail", 3);
  add("seo-favicon", doc.querySelector('link[rel~="icon" i]') ? "pass" : "warn", 1);

  const imgs = Array.from(doc.querySelectorAll("img"));
  add("a11y-img-alt", imgs.length === 0 ? "info" : imgs.every((i) => i.hasAttribute("alt")) ? "pass" : "warn", 3);
  add("a11y-lang", (doc.documentElement.getAttribute("lang") || "").trim().length >= 2 ? "pass" : "fail", 2);
  const fields = Array.from(doc.querySelectorAll("input,select,textarea")).filter(
    (f) => !["hidden", "submit", "button", "reset", "image"].includes((f.getAttribute("type") || "").toLowerCase()),
  );
  const unl = fields.filter(
    (f) => !f.getAttribute("aria-label") && !f.closest("label") && !(f.getAttribute("id") && doc.querySelector(`label[for="${f.getAttribute("id")}"]`)),
  );
  add("a11y-form-labels", fields.length === 0 ? "info" : unl.length === 0 ? "pass" : "fail", 3);
  const links = Array.from(doc.querySelectorAll("a[href]"));
  add("a11y-empty-links", links.length === 0 ? "info" : links.every((l) => (l.textContent || "").trim() || l.getAttribute("aria-label")) ? "pass" : "warn", 2);

  const vp = doc.querySelector('meta[name="viewport" i]');
  const vpContent = (vp?.getAttribute("content") || "").toLowerCase();
  add("mob-viewport", !vp ? "fail" : /width\s*=\s*device-width/.test(vpContent) ? "pass" : "warn", 3);
  add("mob-zoom", !vp ? "unknown" : /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(?:\.0)?\b/.test(vpContent) ? "fail" : "pass", 2);
  const inlineCss = Array.from(doc.querySelectorAll("style")).map((s) => s.textContent || "").join("\n");
  const mq = (inlineCss.match(/@media[^{]*\(/gi) || []).length;
  add("mob-media-queries", mq >= 3 ? "pass" : mq >= 1 ? "warn" : "fail", 3);
  const hasWide = Array.from(doc.querySelectorAll("[style]")).some((e) => {
    const m = (e.getAttribute("style") || "").match(/width\s*:\s*(\d{3,})px/i);
    return !!m && parseInt(m[1], 10) > 480;
  });
  add("mob-fixed-widths", hasWide ? "fail" : "pass", 2);

  const heads = Array.from(doc.querySelectorAll("head script[src]")).filter(
    (s) => !s.hasAttribute("async") && !s.hasAttribute("defer") && s.getAttribute("type") !== "module",
  );
  add("perf-render-blocking", heads.length === 0 ? "pass" : heads.length <= 2 ? "warn" : "fail", 3);
  add("perf-style-count", doc.querySelectorAll('link[rel~="stylesheet" i][href]').length <= 4 ? "pass" : "fail", 2);
  return out;
}

async function engineB(html: string, url: string) {
  const { analyzeHtml } = await import("../src/lib/analyze.ts");
  return analyzeHtml(html, url);
}

function summarize(name: string, checks: { id: string; status: string; weight: number }[]) {
  let earned = 0, possible = 0, fails = 0, unknown = 0, pass = 0, warn = 0;
  for (const c of checks) {
    if (c.weight > 0) {
      possible += c.weight;
      earned += c.status === "pass" ? c.weight : c.status === "warn" ? c.weight * 0.5 : 0;
    }
    if (c.status === "fail") fails++;
    if (c.status === "unknown") unknown++;
    if (c.status === "pass") pass++;
    if (c.status === "warn") warn++;
  }
  return { name, score: possible ? Math.round((earned / possible) * 100) : null, fails, unknown, pass, warn };
}

const exampleHtml = await (await fetch("https://example.com", { redirect: "follow" })).text();
const wikiHtml = await (await fetch("https://www.wikipedia.org", { redirect: "follow" })).text();

const pairs: [string, string, string][] = [
  ["harmful fixture", HARMFUL, "https://t/"],
  ["healthy fixture", HEALTHY, "https://t/"],
  ["example.com live HTML", exampleHtml, "https://example.com/"],
  ["wikipedia.org live HTML", wikiHtml, "https://www.wikipedia.org/"],
];

console.log("=== same cases, both engines, their own scoring ===");
for (const [tag, html, url] of pairs) {
  const a = summarize("A", engineA(html, url));
  const b = summarize("B", (await engineB(html, url)).checks);
  console.log(
    `  ${tag.padEnd(28)} A score=${String(a.score).padStart(4)} P${a.pass} W${a.warn} F${a.fails} U${a.unknown}` +
      `   |   B score=${String(b.score).padStart(4)} P${b.pass} W${b.warn} F${b.fails} U${b.unknown}`,
  );
}

console.log("\n=== coverage (checks run per report) ===");
const aPer = engineA(HARMFUL, "https://t/").length;
const harmB = await engineB(HARMFUL, "https://t/");
console.log(`  A per report: ${aPer}`);
console.log(`  B per report: ${harmB.checks.length}   (plus 'not implemented' list of ${harmB.notChecked.length}, ${Object.keys(harmB.categories).length} categories)`);

console.log("\n=== per-check agreement on live example.com ===");
const aEx = engineA(exampleHtml, "https://example.com/");
const bEx = await engineB(exampleHtml, "https://example.com/");
const aMap = new Map(aEx.map((c) => [c.id, c.status]));
const bMap = new Map(bEx.checks.map((c) => [c.id, c.status]));
const sharedIds = [...aMap.keys()].filter((id) => bMap.has(id) || (id === "perf-render-blocking" && bMap.has("perf-render-blocking-js")) || (id === "perf-style-count" && bMap.has("perf-stylesheets")));
for (const id of sharedIds) {
  const bid = id === "perf-render-blocking" ? "perf-render-blocking-js" : id === "perf-style-count" ? "perf-stylesheets" : id;
  const av = aMap.get(id)!;
  const bv = bMap.get(bid)!;
  console.log(`  ${id.padEnd(22)} A=${av.padEnd(7)} B=${bv}${av === bv ? "" : "   <== differs"}`);
}
const bOnly = bEx.checks.filter((c) => !aMap.has(c.id)).map((c) => c.id).sort();
console.log("  B-only checks on example.com (" + bOnly.length + "):", bOnly.join(", "));
console.log("  A-only ids:", [...aMap.keys()].filter((id) => !sharedIds.includes(id)).sort().join(", "));
process.exit(0);
