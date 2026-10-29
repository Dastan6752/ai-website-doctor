import { JSDOM } from "jsdom";

const { window } = new JSDOM("<!doctype html><html></html>", { url: "https://example.test/" });
(globalThis as any).DOMParser = window.DOMParser;
(globalThis as any).HTMLElement = window.HTMLElement;
(globalThis as any).Element = window.Element;
(globalThis as any).Document = window.Document;

const { normaliseUrl } = await import("../src/lib/fetchSite.ts");
const { analyzeHtml, AnalysisError } = await import("../src/lib/analyze.ts");

let p = 0;
let f = 0;
function ok(n: string, c: boolean, d = "") {
  if (c) {
    p++;
    console.log(" PASS", n, d);
  } else {
    f++;
    console.log(" FAIL", n, d);
  }
}

console.log("=== URL validation ===");
ok("empty", normaliseUrl("").url === null);
ok("garbage", normaliseUrl("%%%").url === null);
ok("localhost", !!normaliseUrl("localhost").error);
ok("127.0.0.1", !!normaliseUrl("127.0.0.1").error);
ok("no-dot", normaliseUrl("https://foo").url === null);
ok("bare domain", normaliseUrl("example.com").url?.href === "https://example.com/");
ok("http kept", normaliseUrl("http://example.com/x").url?.protocol === "http:");
ok("trim", normaliseUrl("  https://www.wikipedia.org  ").url?.hostname === "www.wikipedia.org");

console.log("=== empty HTML ===");
try {
  analyzeHtml("  ", "");
  ok("empty throws", false);
} catch (e) {
  ok("empty throws", e instanceof AnalysisError);
}

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
const r = analyzeHtml(fixture, "https://fixture.test");
const c = (id: string) => r.checks.find((x) => x.id === id)!;
console.log("=== fixture ===");
console.log(
  " overall",
  r.overall.score,
  "pass",
  r.overall.pass,
  "warn",
  r.overall.warn,
  "fail",
  r.overall.fail,
  "info",
  r.overall.info,
  "unk",
  r.overall.unknown,
  "n",
  r.checks.length,
);
ok("checks>=20", r.checks.length >= 20, String(r.checks.length));
ok("source html", r.source === "html");
ok("notChecked", r.notChecked.length > 0, String(r.notChecked.length));
ok("notes mention paste", r.contextNotes.some((n) => /pasted|no network/i.test(n)));
ok("short title warn", c("seo-title").status === "warn", c("seo-title").status);
ok("title quotes Hi", /Hi/.test(c("seo-title").finding));
ok("desc fail", c("seo-description").status === "fail");
ok("two H1 warn", c("seo-h1").status === "warn");
ok("noindex fail", c("seo-indexable").status === "fail");
ok("noindex quotes", /noindex/i.test(c("seo-indexable").finding));
ok("lang fail", c("a11y-lang").status === "fail");
ok("alt warn/fail", ["warn", "fail"].includes(c("a11y-img-alt").status), c("a11y-img-alt").status + " " + c("a11y-img-alt").metric);
ok("alt evidence hero", (c("a11y-img-alt").evidence || []).some((e) => /hero/.test(e)));
ok("form fail", c("a11y-form-labels").status === "fail");
ok("empty link", ["warn", "fail"].includes(c("a11y-empty-links").status));
ok("click here", ["warn", "fail"].includes(c("a11y-vague-links").status));
ok("nameless button", c("a11y-button-names").status === "fail");
ok("iframe warn", c("a11y-iframe-title").status === "warn");
ok("viewport fail", c("mob-viewport").status === "fail");
ok("zoom unknown", c("mob-zoom").status === "unknown");
ok("960px flagged", ["warn", "fail"].includes(c("mob-fixed-widths").status));
ok("960 evidence", (c("mob-fixed-widths").evidence || []).some((e) => /960/.test(e)));
ok("9px flagged", ["warn", "fail"].includes(c("mob-tiny-text").status));
ok("blocking js", ["warn", "fail"].includes(c("perf-render-blocking-js").status));
ok("blocking evidence", (c("perf-render-blocking-js").evidence || []).some((e) => /blocking/.test(e)));
ok("9 css fail", c("perf-stylesheets").status === "fail", c("perf-stylesheets").status + " " + c("perf-stylesheets").metric);
ok("https unknown on paste", c("seo-https").status === "unknown");
ok("no robots check", !c("seo-robots-txt"));
ok("no sitemap check", !c("seo-sitemap"));
ok("tap-to-call present", !!c("mob-tap-to-call"));
ok("internal links fail on fixture", c("seo-internal-links").status === "fail" || c("seo-internal-links").status === "warn", c("seo-internal-links").status);
ok("960px still flagged", ["warn", "fail"].includes(c("mob-fixed-widths").status));
ok(
  "all have finding+fix",
  r.checks.every((x) => x.finding && x.fix.length),
);
const scored = r.checks.filter((x) => ["pass", "warn", "fail"].includes(x.status));
ok("possible matches weights", r.overall.possible === scored.reduce((n, x) => n + x.weight, 0));
ok("score 0-100", typeof r.overall.score === "number" && r.overall.score! >= 0 && r.overall.score! <= 100);

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
const g = analyzeHtml(good, "https://acme.test/");
const gc = (id: string) => g.checks.find((x) => x.id === id)!;
console.log("=== healthy ===");
console.log(" overall", g.overall.score, "fail", g.overall.fail, "warn", g.overall.warn);
ok("healthy >=80", (g.overall.score ?? 0) >= 80, String(g.overall.score));
ok("lang pass", gc("a11y-lang").status === "pass");
ok("viewport pass", gc("mob-viewport").status === "pass");
ok("zoom pass", gc("mob-zoom").status === "pass");
ok("title pass", gc("seo-title").status === "pass");
ok("desc pass", gc("seo-description").status === "pass");
ok("h1 pass", gc("seo-h1").status === "pass");
ok("index pass", gc("seo-indexable").status === "pass");
ok("alt pass", gc("a11y-img-alt").status === "pass");
ok("labels pass", gc("a11y-form-labels").status === "pass");
ok("mq pass", gc("mob-media-queries").status === "pass", gc("mob-media-queries").status + " " + gc("mob-media-queries").metric);
ok("social pass", gc("seo-social").status === "pass");
ok("ld pass", gc("seo-structured-data").status === "pass");

console.log("=== report shape ===");
ok("finishedAt ISO", /^\d{4}-\d{2}-\d{2}T/.test(g.finishedAt));
ok("4 categories", Object.keys(g.categories).length === 4);
ok(
  "check fields",
  g.checks.every((x) => x.id && x.title && x.status && x.finding && x.why && Array.isArray(x.fix)),
);
ok(
  "known statuses",
  g.checks.every((x) => ["pass", "warn", "fail", "info", "unknown"].includes(x.status)),
);

console.log("=== ground truth example.com via direct fetch ===");
try {
  const res = await fetch("https://example.com", { redirect: "follow" });
  const html = await res.text();
  ok("direct example.com", res.ok && html.length > 100, `HTTP ${res.status} ${html.length}B`);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const realTitle = (doc.querySelector("title")?.textContent || "").trim();
  const realH1 = (doc.querySelector("h1")?.textContent || "").trim();
  const realDesc = doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
  const realLang = doc.documentElement.getAttribute("lang") || "";
  const realVp = doc.querySelector('meta[name="viewport"]');
  console.log(` ground: title="${realTitle}" h1="${realH1}" lang="${realLang}" desc=${realDesc ? "yes" : "none"} vp=${realVp ? "yes" : "no"}`);
  const er = analyzeHtml(html, "https://example.com");
  const ec = (id: string) => er.checks.find((x) => x.id === id)!;
  console.log(" example overall", er.overall.score, "fail", er.overall.fail, "warn", er.overall.warn, "pass", er.overall.pass);
  ok("title quotes real", ec("seo-title").finding.includes(realTitle), realTitle);
  if (realTitle.length < 15) ok("short title warn", ec("seo-title").status === "warn");
  else if (realTitle.length > 65) ok("long title warn", ec("seo-title").status === "warn");
  else ok("normal title pass", ec("seo-title").status === "pass");
  if (!realDesc) ok("missing desc fail", ec("seo-description").status === "fail");
  if (realH1) ok("h1 quotes real", ec("seo-h1").finding.includes(realH1.slice(0, 40)) || ec("seo-h1").status === "warn");
  else ok("missing h1 fail", ec("seo-h1").status === "fail");
  if (realLang.length >= 2) ok("lang pass", ec("a11y-lang").status === "pass");
  else ok("missing lang fail", ec("a11y-lang").status === "fail");
  if (!realVp) ok("missing viewport fail", ec("mob-viewport").status === "fail");
  else ok("viewport not fail-for-missing", ec("mob-viewport").status !== "fail" || !/no viewport/i.test(ec("mob-viewport").finding));
} catch (e) {
  ok("direct example.com", false, e instanceof Error ? e.message : String(e));
}

console.log("RESULT pass=" + p + " fail=" + f);
process.exit(f ? 1 : 0);
