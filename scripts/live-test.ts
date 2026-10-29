import { JSDOM } from "jsdom";

const { window } = new JSDOM("<!doctype html><html></html>", { url: "https://example.test/" });
(globalThis as any).DOMParser = window.DOMParser;
(globalThis as any).HTMLElement = window.HTMLElement;
(globalThis as any).Element = window.Element;
(globalThis as any).Document = window.Document;

const { fetchThroughProxy, normaliseUrl } = await import("../src/lib/fetchSite.ts");
const { analyzeUrl, analyzeHtml, AnalysisError } = await import("../src/lib/analyze.ts");

let p = 0;
let f = 0;
function ok(n: string, c: boolean, d = "") {
  if (c) {
    p++;
    console.log(" PASS", n, d ? "— " + d : "");
  } else {
    f++;
    console.log(" FAIL", n, d ? "— " + d : "");
  }
}

console.log("=== proxy probes (8s each, sequential) ===");
const probes = [
  "https://example.com",
  "https://www.wikipedia.org",
  "https://wordpress.org",
];
const reachable: string[] = [];
for (const url of probes) {
  const t0 = Date.now();
  const r = await fetchThroughProxy(url, { timeoutMs: 8000, htmlDocument: true });
  const ms = Date.now() - t0;
  if (r.ok) {
    console.log(` OK  ${url} via ${r.proxy} ${r.text.length} chars ${ms}ms normalised=${!!r.normalised} status=${r.httpStatus}`);
    ok("fetch " + url, true, `${r.proxy} ${r.text.length}c`);
    reachable.push(url);
  } else {
    console.log(` NO  ${url} ${r.error} ${ms}ms`);
    ok("fetch " + url, false, r.error || "fail");
  }
}

console.log("\n=== analyzeUrl on reachable sites ===");
for (const url of reachable.slice(0, 2)) {
  console.log("\n --", url);
  const t0 = Date.now();
  try {
    const report = await analyzeUrl(url, (step, pct) => {
      console.log(`    [${pct}%] ${step}`);
    });
    const ms = Date.now() - t0;
    console.log(
      `    done ${ms}ms overall=${report.overall.score} pass=${report.overall.pass} warn=${report.overall.warn} fail=${report.overall.fail} info=${report.overall.info} unk=${report.overall.unknown} checks=${report.checks.length}`,
    );
    for (const [id, cat] of Object.entries(report.categories)) {
      console.log(`    ${id.padEnd(14)} ${cat.score}  ${cat.pass}✓ ${cat.warn}! ${cat.fail}✗`);
    }
    ok("report " + url, report.checks.length > 20, `${report.checks.length} checks score=${report.overall.score}`);
    ok("source url " + url, report.source === "url");
    ok("bytes " + url, (report.fetchMeta?.bytes ?? 0) > 100, String(report.fetchMeta?.bytes));
    ok("findings non-empty " + url, report.checks.every((c) => c.finding.length > 8));
    ok("fixes non-empty " + url, report.checks.every((c) => c.fix.length > 0));
    ok("4 cats " + url, Object.keys(report.categories).length === 4);
    ok("notChecked " + url, report.notChecked.length >= 10);

    const title = report.checks.find((c) => c.id === "seo-title")!;
    ok("title not invented " + url, title.status === "fail" || /“/.test(title.finding) || title.finding.includes("characters"));
    const rt = report.checks.find((c) => c.id === "perf-roundtrip");
    if (rt) {
      ok("roundtrip info " + url, rt.status === "info" && rt.weight === 0);
      ok("roundtrip disclaimer " + url, /NOT your real|proxy/i.test(rt.finding));
    }
    const fails = report.checks.filter((c) => c.status === "fail" || c.status === "warn").slice(0, 4);
    for (const c of fails) console.log(`    [${c.status}] ${c.id}: ${c.finding.replace(/\s+/g, " ").slice(0, 120)}`);
  } catch (e) {
    ok("analyzeUrl " + url, false, e instanceof Error ? e.message : String(e));
  }
}

console.log("\n=== invalid / inaccessible ===");
for (const [label, raw] of [
  ["empty", ""],
  ["nonsense", "not a website"],
  ["localhost", "localhost:3000"],
  ["nxdomain", "https://this-domain-definitely-does-not-exist-9f3k2.test"],
] as const) {
  try {
    await analyzeUrl(raw, () => {});
    ok(label + " throws", false, "produced a report");
  } catch (e) {
    ok(label + " throws AnalysisError", e instanceof AnalysisError, e instanceof Error ? e.message : "");
  }
}

console.log("\n=== wikipedia.org via direct fetch vs engine (no proxy) ===");
try {
  const res = await fetch("https://www.wikipedia.org", { redirect: "follow" });
  const html = await res.text();
  ok("direct wikipedia", res.ok && html.length > 1000, `${res.status} ${html.length}B`);
  const report = analyzeHtml(html, "https://www.wikipedia.org");
  const title = report.checks.find((c) => c.id === "seo-title")!;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const realTitle = (doc.querySelector("title")?.textContent || "").replace(/\s+/g, " ").trim();
  console.log(" real title:", realTitle);
  console.log(" finding:", title.finding.replace(/\s+/g, " ").slice(0, 180));
  ok("wikipedia title quoted", title.finding.includes(realTitle.slice(0, 40)));
  const desc = report.checks.find((c) => c.id === "seo-description")!;
  const realDesc = doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
  if (realDesc) ok("wikipedia desc quotes real", desc.finding.includes(realDesc.slice(0, 40)));
  else ok("wikipedia missing desc fail", desc.status === "fail");
  const lang = report.checks.find((c) => c.id === "seo-https")!;
  // https check is unknown on paste
  ok("paste https unknown", lang.status === "unknown");
  console.log(" wikipedia paste overall", report.overall.score, "fail", report.overall.fail, "warn", report.overall.warn);
} catch (e) {
  ok("wikipedia direct", false, e instanceof Error ? e.message : String(e));
}

console.log("RESULT pass=" + p + " fail=" + f);
process.exit(f ? 1 : 0);
