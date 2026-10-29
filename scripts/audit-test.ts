/**
 * Integration tests for AI Website Doctor.
 * Runs against the real analysis engine. Does not invent results.
 */
import { JSDOM } from "jsdom";

const { window } = new JSDOM("<!doctype html><html></html>", { url: "https://example.test/" });
(globalThis as any).DOMParser = window.DOMParser;
(globalThis as any).HTMLElement = window.HTMLElement;
(globalThis as any).Element = window.Element;
(globalThis as any).Document = window.Document;
(globalThis as any).TextEncoder = TextEncoder;

const { normaliseUrl, fetchThroughProxy } = await import("../src/lib/fetchSite.ts");
const { analyzeHtml, analyzeUrl, AnalysisError } = await import("../src/lib/analyze.ts");
import type { AuditReport, CheckResult } from "../src/lib/types.ts";

let passed = 0;
let failed = 0;
const failures: string[] = [];
const notes: string[] = [];

function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}${detail ? " — " + detail : ""}`);
  } else {
    failed++;
    failures.push(name + (detail ? " — " + detail : ""));
    console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

function check(report: AuditReport, id: string): CheckResult | undefined {
  return report.checks.find((c) => c.id === id);
}

function dump(report: AuditReport) {
  console.log(
    `    overall=${report.overall.score}  pass=${report.overall.pass} warn=${report.overall.warn} fail=${report.overall.fail} info=${report.overall.info} unknown=${report.overall.unknown}  checks=${report.checks.length}`,
  );
  for (const [id, cat] of Object.entries(report.categories)) {
    console.log(`    ${id.padEnd(14)} score=${String(cat.score).padStart(3)}  ${cat.pass}✓ ${cat.warn}! ${cat.fail}✗  ${cat.info}i ${cat.unknown}?`);
  }
}

/* ============================================================
 * 1. URL validation
 * ============================================================ */
console.log("\n=== 1. URL validation ===");
{
  const empty = normaliseUrl("");
  ok("empty string rejected", empty.url === null && !!empty.error);

  const garbage = normaliseUrl("not a url !!!");
  ok("garbage rejected", garbage.url === null);

  const nodot = normaliseUrl("localhost");
  ok("localhost rejected", nodot.url === null && /local/i.test(nodot.error || ""));

  const loop = normaliseUrl("127.0.0.1");
  ok("127.0.0.1 rejected", loop.url === null);

  const nodomain = normaliseUrl("https://foo");
  ok("hostname without a dot rejected", nodomain.url === null);

  const ok1 = normaliseUrl("example.com");
  ok("bare domain accepted and given https", ok1.url?.href === "https://example.com/");

  const ok2 = normaliseUrl("http://example.com/path");
  ok("http URL preserved", ok2.url?.protocol === "http:" && ok2.url?.hostname === "example.com");

  const ok3 = normaliseUrl("  https://www.wikipedia.org  ");
  ok("whitespace trimmed", ok3.url?.hostname === "www.wikipedia.org");
}

/* ============================================================
 * 2. HTML paste: empty / invalid
 * ============================================================ */
console.log("\n=== 2. Pasted HTML error handling ===");
{
  try {
    analyzeHtml("   ", "");
    ok("empty HTML throws", false);
  } catch (e) {
    ok("empty HTML throws AnalysisError", e instanceof AnalysisError);
  }
}

/* ============================================================
 * 3. Known-fixture HTML — every verdict must match the source
 * ============================================================ */
console.log("\n=== 3. Fixture HTML — evidence must match source ===");
{
  const fixture = `<!doctype html>
<html>
<head>
  <title>Hi</title>
  <meta name="robots" content="noindex, nofollow">
  <script src="/blocking.js"></script>
  <link rel="stylesheet" href="/a.css">
  <link rel="stylesheet" href="/b.css">
  <link rel="stylesheet" href="/c.css">
  <link rel="stylesheet" href="/d.css">
  <link rel="stylesheet" href="/e.css">
  <link rel="stylesheet" href="/f.css">
  <link rel="stylesheet" href="/g.css">
  <link rel="stylesheet" href="/h.css">
  <link rel="stylesheet" href="/i.css">
</head>
<body>
  <h1>Welcome</h1>
  <h1>Also welcome</h1>
  <img src="hero.jpg">
  <img src="logo.png" alt="Acme logo">
  <a href="/about"></a>
  <a href="/more">click here</a>
  <form>
    <input type="email" name="email">
    <button></button>
  </form>
  <iframe src="https://maps.example.com/embed"></iframe>
  <div style="width: 960px">wide</div>
  <p style="font-size: 9px">tiny</p>
</body>
</html>`;

  const report = analyzeHtml(fixture, "https://fixture.test");
  dump(report);

  ok("report has checks", report.checks.length >= 20, `${report.checks.length} checks`);
  ok("source is html", report.source === "html");
  ok("notChecked list is non-empty", report.notChecked.length > 0, `${report.notChecked.length} items`);
  ok("context notes mention no network", report.contextNotes.some((n) => /pasted|no network/i.test(n)));

  const title = check(report, "seo-title")!;
  ok("short title is warn (Hi = 2 chars)", title.status === "warn", `status=${title.status} finding=${title.finding.slice(0, 80)}`);
  ok("title evidence mentions Hi", /Hi/.test(title.finding));

  const desc = check(report, "seo-description")!;
  ok("missing description is fail", desc.status === "fail");

  const h1 = check(report, "seo-h1")!;
  ok("two H1s is warn", h1.status === "warn", `status=${h1.status}`);

  const noindex = check(report, "seo-indexable")!;
  ok("noindex is fail", noindex.status === "fail", `status=${noindex.status}`);
  ok("noindex finding quotes the tag", /noindex/i.test(noindex.finding));

  const lang = check(report, "a11y-lang")!;
  ok("missing lang is fail", lang.status === "fail");

  const alt = check(report, "a11y-img-alt")!;
  ok("one of two images missing alt is warn", alt.status === "warn" || alt.status === "fail", `status=${alt.status} metric=${alt.metric}`);
  ok("missing alt evidence lists hero.jpg", (alt.evidence || []).some((e) => /hero\.jpg/.test(e)));

  const labels = check(report, "a11y-form-labels")!;
  ok("unlabelled email input is fail", labels.status === "fail");

  const emptyLinks = check(report, "a11y-empty-links")!;
  ok("empty <a> is warn or fail", emptyLinks.status === "warn" || emptyLinks.status === "fail");

  const vague = check(report, "a11y-vague-links")!;
  ok("'click here' is flagged", vague.status === "warn" || vague.status === "fail");

  const buttons = check(report, "a11y-button-names")!;
  ok("nameless button is fail", buttons.status === "fail");

  const iframe = check(report, "a11y-iframe-title")!;
  ok("untitled iframe is warn", iframe.status === "warn");

  const vp = check(report, "mob-viewport")!;
  ok("missing viewport is fail", vp.status === "fail");

  const zoom = check(report, "mob-zoom")!;
  ok("zoom without viewport is unknown (not guessed)", zoom.status === "unknown");

  const fixed = check(report, "mob-fixed-widths")!;
  ok("960px div is flagged", fixed.status === "warn" || fixed.status === "fail");
  ok("960px appears in evidence", (fixed.evidence || []).some((e) => /960/.test(e)));

  const tiny = check(report, "mob-tiny-text")!;
  ok("9px text is flagged", tiny.status === "warn" || tiny.status === "fail");

  const blocking = check(report, "perf-render-blocking-js")!;
  ok("blocking script in head is warn or fail", blocking.status === "warn" || blocking.status === "fail");
  ok("blocking.js is in evidence", (blocking.evidence || []).some((e) => /blocking\.js/.test(e)));

  const sheets = check(report, "perf-stylesheets")!;
  ok("9 stylesheets is fail", sheets.status === "fail", `status=${sheets.status} metric=${sheets.metric}`);

  const https = check(report, "seo-https")!;
  ok("HTTPS on pasted HTML is unknown, not guessed", https.status === "unknown");

  const robots = check(report, "seo-robots-txt");
  ok("robots.txt check skipped (not attempted) on paste", !robots);

  const sitemap = check(report, "seo-sitemap");
  ok("sitemap check skipped on paste", !sitemap);

  // Every check has a finding and a fix list — no empty fabricated slots
  const incomplete = report.checks.filter((c) => !c.finding || !c.fix || c.fix.length === 0);
  ok("every check has finding + fixes", incomplete.length === 0, incomplete.map((c) => c.id).join(","));

  // Scores are computed only from pass/warn/fail
  const scored = report.checks.filter((c) => c.status === "pass" || c.status === "warn" || c.status === "fail");
  ok("overall.possible matches scored weights", report.overall.possible === scored.reduce((n, c) => n + c.weight, 0));
  ok("overall.score is a number 0-100", typeof report.overall.score === "number" && report.overall.score! >= 0 && report.overall.score! <= 100);
}

/* ============================================================
 * 4. Healthy fixture — should mostly pass
 * ============================================================ */
console.log("\n=== 4. Healthy fixture ===");
{
  const good = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Acme Bakery in Leeds | Fresh sourdough daily</title>
  <meta name="description" content="Family bakery on Kirkgate, Leeds. Fresh sourdough, pastries and coffee. Open 7 days. Order online for next-day collection.">
  <link rel="canonical" href="https://acme.test/">
  <link rel="icon" href="/favicon.ico">
  <meta property="og:title" content="Acme Bakery in Leeds">
  <meta property="og:description" content="Fresh sourdough, pastries and coffee. Open 7 days.">
  <meta property="og:image" content="https://acme.test/og.jpg">
  <script type="application/ld+json">{"@type":"Bakery","name":"Acme Bakery"}</script>
  <link rel="stylesheet" href="/app.css">
  <style>@media (max-width: 640px) { .col { display:block } } @media (max-width: 1024px) { .col { gap: 1rem } } @media (min-width: 1025px) { .wrap { max-width: 1100px } }</style>
</head>
<body>
  <a href="#main">Skip to content</a>
  <header><nav><a href="/">Home</a><a href="/menu">Menu</a></nav></header>
  <main id="main">
    <h1>Fresh sourdough baked every morning in Leeds</h1>
    <h2>Today's loaves</h2>
    <p>${"Our bakers start at 4am. ".repeat(40)}</p>
    <img src="loaf.jpg" alt="Crusty sourdough loaf on a wooden board" width="800" height="600" loading="lazy">
    <form>
      <label for="email">Your email</label>
      <input id="email" type="email" name="email">
      <button type="submit">Send</button>
    </form>
  </main>
  <footer>© Acme</footer>
</body>
</html>`;
  const report = analyzeHtml(good, "https://acme.test/");
  dump(report);

  ok("healthy page scores >= 80", (report.overall.score ?? 0) >= 80, `score=${report.overall.score}`);
  ok("lang pass", check(report, "a11y-lang")?.status === "pass");
  ok("viewport pass", check(report, "mob-viewport")?.status === "pass");
  ok("zoom pass", check(report, "mob-zoom")?.status === "pass");
  ok("title pass", check(report, "seo-title")?.status === "pass");
  ok("description pass", check(report, "seo-description")?.status === "pass");
  ok("h1 pass", check(report, "seo-h1")?.status === "pass");
  ok("indexable pass", check(report, "seo-indexable")?.status === "pass");
  ok("alt pass", check(report, "a11y-img-alt")?.status === "pass");
  ok("form labels pass", check(report, "a11y-form-labels")?.status === "pass");
  ok("media queries pass (3 @media)", check(report, "mob-media-queries")?.status === "pass", `status=${check(report, "mob-media-queries")?.status} metric=${check(report, "mob-media-queries")?.metric}`);
  ok("no fail on social", check(report, "seo-social")?.status === "pass");
  ok("structured data pass", check(report, "seo-structured-data")?.status === "pass");
}

/* ============================================================
 * 5. Live proxy fetch of real public websites
 * ============================================================ */
console.log("\n=== 5. Live proxy fetches ===");

async function tryLive(url: string, timeoutMs = 25000) {
  const started = Date.now();
  try {
    const r = await fetchThroughProxy(url, { timeoutMs, htmlDocument: true });
    return { ...r, wallMs: Date.now() - started };
  } catch (e) {
    return {
      ok: false,
      text: "",
      httpStatus: null,
      contentType: null,
      finalUrl: null,
      proxy: null,
      error: e instanceof Error ? e.message : String(e),
      wallMs: Date.now() - started,
    };
  }
}

const liveTargets = [
  "https://example.com",
  "https://www.wikipedia.org",
  "https://wordpress.org",
];

const liveResults: { url: string; ok: boolean; proxy: string | null; bytes: number; error?: string; normalised?: boolean }[] = [];

for (const url of liveTargets) {
  process.stdout.write(`  fetching ${url} … `);
  const r = await tryLive(url);
  const bytes = r.text ? new TextEncoder().encode(r.text).length : 0;
  liveResults.push({ url, ok: r.ok, proxy: r.proxy, bytes, error: r.error, normalised: r.normalised });
  if (r.ok) {
    console.log(`OK via ${r.proxy}  ${bytes} bytes  ${r.wallMs}ms  normalised=${!!r.normalised}  status=${r.httpStatus}`);
    ok(`proxy fetch ${url}`, true, `${r.proxy} ${bytes}B`);
  } else {
    console.log(`FAILED  ${r.error}  ${r.wallMs}ms`);
    ok(`proxy fetch ${url}`, false, r.error || "unknown");
  }
}

/* ============================================================
 * 6. Full analyzeUrl on sites we could actually fetch
 * ============================================================ */
console.log("\n=== 6. Full analyzeUrl on reachable public sites ===");

const reachable = liveResults.filter((r) => r.ok);
if (reachable.length === 0) {
  notes.push("No public site could be fetched through any CORS proxy in this environment. Full analyzeUrl tests could not run.");
  ok("at least one live site reachable for analyzeUrl", false, "all proxies failed");
} else {
  for (const site of reachable.slice(0, 3)) {
    console.log(`\n  -- analyzeUrl ${site.url} --`);
    try {
      const report = await analyzeUrl(site.url, (step, pct) => {
        /* quiet */
        if (pct === 100) console.log(`     progress: ${step} ${pct}%`);
      });
      dump(report);

      ok(`${site.url} produced a report`, !!report && report.checks.length > 0, `${report.checks.length} checks`);
      ok(`${site.url} source is url`, report.source === "url");
      ok(`${site.url} target is the requested URL`, report.target.startsWith("http"));
      ok(`${site.url} fetchMeta present`, !!report.fetchMeta);
      ok(`${site.url} HTML size > 0`, (report.fetchMeta?.bytes ?? 0) > 100, `${report.fetchMeta?.bytes} bytes`);
      ok(`${site.url} every check has a finding`, report.checks.every((c) => c.finding && c.finding.length > 10));
      ok(`${site.url} every check has fixes`, report.checks.every((c) => c.fix.length > 0));
      ok(`${site.url} four categories present`, ["performance", "mobile", "accessibility", "seo"].every((k) => k in report.categories));
      ok(`${site.url} notChecked listed`, report.notChecked.length >= 10, `${report.notChecked.length}`);

      // Evidence must come from the page: title check should quote the real <title>
      const titleCheck = check(report, "seo-title");
      if (titleCheck && titleCheck.status !== "fail") {
        const m = titleCheck.finding.match(/“([^”]+)”/);
        ok(`${site.url} title finding quotes the real title`, !!m, m ? m[1].slice(0, 60) : "no quote");
      } else {
        ok(`${site.url} missing title is reported as fail (not invented)`, titleCheck?.status === "fail");
      }

      // Round-trip check must be labelled as proxy time, not a real speed score
      const rt = check(report, "perf-roundtrip");
      if (rt) {
        ok(`${site.url} round-trip is info (not scored)`, rt.status === "info" && rt.weight === 0);
        ok(`${site.url} round-trip disclaimer present`, /NOT your real/i.test(rt.finding) || /proxy/i.test(rt.finding));
      }

      // Scores in range
      ok(`${site.url} overall 0-100 or null`, report.overall.score === null || (report.overall.score >= 0 && report.overall.score <= 100));

      // Print a few real findings so the log is inspectable
      const interesting = report.checks.filter((c) => c.status === "fail" || c.status === "warn").slice(0, 5);
      for (const c of interesting) {
        console.log(`     [${c.status}] ${c.id}: ${c.finding.slice(0, 140).replace(/\n/g, " ")}`);
      }
    } catch (e) {
      const msg = e instanceof AnalysisError ? `${e.message} | ${e.hint}` : e instanceof Error ? e.message : String(e);
      ok(`analyzeUrl ${site.url}`, false, msg);
    }
  }
}

/* ============================================================
 * 7. Invalid / inaccessible websites
 * ============================================================ */
console.log("\n=== 7. Invalid URLs and inaccessible sites ===");
{
  try {
    await analyzeUrl("", () => {});
    ok("empty URL throws", false);
  } catch (e) {
    ok("empty URL throws AnalysisError", e instanceof AnalysisError, e instanceof Error ? e.message : "");
  }

  try {
    await analyzeUrl("not a website", () => {});
    ok("nonsense URL throws", false);
  } catch (e) {
    ok("nonsense URL throws AnalysisError", e instanceof AnalysisError, e instanceof Error ? e.message : "");
  }

  try {
    await analyzeUrl("localhost:3000", () => {});
    ok("localhost throws", false);
  } catch (e) {
    ok("localhost throws AnalysisError", e instanceof AnalysisError, e instanceof Error ? e.message : "");
  }

  try {
    await analyzeUrl("https://this-domain-definitely-does-not-exist-9f3k2.test", (s, p) => {
      /* */
    });
    ok("nonexistent domain throws (did not fabricate a report)", false);
  } catch (e) {
    ok(
      "nonexistent domain throws AnalysisError (no fabricated report)",
      e instanceof AnalysisError,
      e instanceof AnalysisError ? e.message : e instanceof Error ? e.message : "",
    );
  }
}

/* ============================================================
 * 8. Report shape expected by the UI
 * ============================================================ */
console.log("\n=== 8. Report shape for the results page ===");
{
  const report = analyzeHtml(
    `<!doctype html><html lang="en"><head><title>Shape Test Page Title Here</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><h1>Hello</h1><p>${"word ".repeat(80)}</p></body></html>`,
    "https://shape.test",
  );
  ok("finishedAt is ISO", /^\d{4}-\d{2}-\d{2}T/.test(report.finishedAt));
  ok("checks is array", Array.isArray(report.checks) && report.checks.length > 0);
  ok("categories has 4 keys", Object.keys(report.categories).length === 4);
  ok("overall has pass/warn/fail counts", typeof report.overall.pass === "number" && typeof report.overall.fail === "number");
  ok("each check has id, title, status, finding, why, fix", report.checks.every((c) => c.id && c.title && c.status && c.finding && c.why && Array.isArray(c.fix)));
  const statuses = new Set(report.checks.map((c) => c.status));
  ok("statuses are known enum values", [...statuses].every((s) => ["pass", "warn", "fail", "info", "unknown"].includes(s)));
}

/* ============================================================
 * 9. Direct comparison: example.com HTML vs. engine output
 *    (only if we have a direct fetch of example.com)
 * ============================================================ */
console.log("\n=== 9. Ground-truth comparison against example.com HTML ===");
try {
  const res = await fetch("https://example.com", { redirect: "follow" });
  const html = await res.text();
  ok("direct fetch of example.com succeeded", res.ok && html.length > 100, `HTTP ${res.status} ${html.length} bytes`);

  // Parse with the same DOMParser polyfill
  const doc = new DOMParser().parseFromString(html, "text/html");
  const realTitle = (doc.querySelector("title")?.textContent || "").trim();
  const realH1 = (doc.querySelector("h1")?.textContent || "").trim();
  const realDesc = doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
  const realLang = doc.documentElement.getAttribute("lang") || "";
  const realVp = doc.querySelector('meta[name="viewport"]');
  console.log(`    ground truth: title="${realTitle}" h1="${realH1}" lang="${realLang}" desc=${realDesc ? "yes" : "none"} viewport=${realVp ? "yes" : "no"}`);

  const report = analyzeHtml(html, "https://example.com");
  dump(report);

  const t = check(report, "seo-title")!;
  ok("title finding contains the real title", t.finding.includes(realTitle), `finding quotes "${realTitle}"`);
  if (realTitle.length < 15) ok("short real title is warn", t.status === "warn");
  else if (realTitle.length > 65) ok("long real title is warn", t.status === "warn");
  else ok("normal real title is pass", t.status === "pass");

  const d = check(report, "seo-description")!;
  if (!realDesc) ok("missing real description is fail (not invented)", d.status === "fail");
  else ok("present real description is not fail-for-missing", d.status !== "fail" || /too short|cut off/i.test(d.finding));

  const h = check(report, "seo-h1")!;
  if (realH1) ok("H1 finding quotes the real H1", h.finding.includes(realH1.slice(0, 40)) || h.status === "warn");
  else ok("missing H1 is fail", h.status === "fail");

  const l = check(report, "a11y-lang")!;
  if (realLang.length >= 2) ok("declared lang is pass", l.status === "pass");
  else ok("missing lang is fail (not invented as pass)", l.status === "fail");

  const v = check(report, "mob-viewport")!;
  if (!realVp) ok("missing viewport is fail", v.status === "fail");
  else ok("present viewport is not fail-for-missing", v.status !== "fail" || /device-width/i.test(v.finding) === false);
} catch (e) {
  notes.push("Direct fetch of example.com failed; ground-truth comparison skipped. " + (e instanceof Error ? e.message : String(e)));
  ok("direct example.com fetch", false, e instanceof Error ? e.message : String(e));
}

console.log("\n============================================================");
console.log(`RESULT  passed=${passed}  failed=${failed}`);
if (failures.length) {
  console.log("FAILURES:");
  failures.forEach((f) => console.log("  - " + f));
}
if (notes.length) {
  console.log("NOTES:");
  notes.forEach((n) => console.log("  - " + n));
}
process.exitCode = failed > 0 ? 1 : 0;
