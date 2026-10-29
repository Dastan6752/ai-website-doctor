import type { AuditContext, CheckResult, NotCheckedItem } from "../types";
import { byteLength } from "../fetchSite";
import { describeElement, kb, makeCheck, pluralise, shorten } from "./helpers";

const HEAVY_LIBS: { match: RegExp; name: string }[] = [
  { match: /jquery[.-]/i, name: "jQuery" },
  { match: /jquery-migrate/i, name: "jQuery Migrate" },
  { match: /bootstrap(\.bundle)?(\.min)?\.js/i, name: "Bootstrap JS" },
  { match: /font-?awesome/i, name: "Font Awesome" },
  { match: /moment(\.min)?\.js/i, name: "Moment.js" },
  { match: /lodash(\.min)?\.js/i, name: "Lodash" },
  { match: /slick(\.min)?\.js|owl\.carousel|swiper/i, name: "A carousel/slider library" },
  { match: /gtm\.js|googletagmanager/i, name: "Google Tag Manager" },
  { match: /react-dom|vue(\.min)?\.js|angular/i, name: "A JavaScript framework bundle" },
];

export function performanceChecks(ctx: AuditContext): CheckResult[] {
  const { doc } = ctx;
  const out: CheckResult[] = [];
  const mk = (c: Omit<CheckResult, "category">) => out.push(makeCheck("performance", c));

  /* ---------- 1. HTML document weight ---------- */
  const htmlBytes = ctx.fetchMeta?.bytes || byteLength(ctx.html);
  const approx = ctx.fetchMeta?.normalised === true;
  mk({
    id: "perf-html-size",
    title: "Size of the page's HTML file",
    status: approx ? "info" : htmlBytes <= 120_000 ? "pass" : htmlBytes <= 300_000 ? "warn" : "fail",
    weight: approx ? 0 : 2,
    metric: `${approx ? "~" : ""}${kb(htmlBytes)}`,
    finding: `The HTML document we received is ${kb(htmlBytes)}. ${
      approx
        ? "⚠️ It reached us through a proxy that re-formats markup, so this figure is approximate and is not being scored."
        : htmlBytes <= 120_000
          ? "That is a healthy size — browsers can read it quickly."
          : htmlBytes <= 300_000
            ? "That is larger than ideal. A typical page is under 120 KB of HTML."
            : "That is very large. Pages this heavy feel sluggish on mobile data."
    }`,
    why: "The HTML file is the very first thing a visitor downloads. Until it arrives, the screen stays blank. On a phone with a weak signal every extra 100 KB is noticeable delay.",
    fix: [
      "Turn on Gzip or Brotli compression on your hosting (most hosts have a one-click toggle, or ask support).",
      "Move long inline <style> and <script> blocks into separate .css / .js files so they can be cached.",
      "If you use a page builder (Elementor, Divi, WPBakery…), delete unused sections and widgets — they still ship in the HTML.",
      "Remove HTML comments and duplicated markup left over from old templates.",
    ],
  });

  /* ---------- 2. Render-blocking scripts in <head> ---------- */
  const headScripts = Array.from(doc.querySelectorAll("head script[src]")).filter((s) => {
    const type = (s.getAttribute("type") || "").toLowerCase();
    if (type && type !== "text/javascript" && type !== "module" && type !== "application/javascript")
      return false;
    if (type === "module") return false; // modules are deferred by default
    return !s.hasAttribute("defer") && !s.hasAttribute("async");
  });
  mk({
    id: "perf-render-blocking-js",
    title: "Scripts that block the page from showing",
    status: headScripts.length === 0 ? "pass" : headScripts.length <= 2 ? "warn" : "fail",
    weight: 3,
    metric: pluralise(headScripts.length, "script"),
    finding:
      headScripts.length === 0
        ? "No blocking scripts were found in the <head>. Scripts either load in the background or sit at the end of the page."
        : `${pluralise(headScripts.length, "script")} in the <head> of your page ${headScripts.length === 1 ? "is" : "are"} loaded without "async" or "defer", so the browser stops drawing the page until ${headScripts.length === 1 ? "it is" : "they are"} downloaded and run.`,
    evidence: headScripts.slice(0, 8).map((s) => shorten(s.getAttribute("src") || "", 90)),
    why: "A blocking script freezes the page build-up. Visitors stare at a white screen for longer, and Google measures that delay as part of your page experience score.",
    fix: [
      'Add the "defer" attribute to scripts that are not needed immediately: <script src="..." defer></script>.',
      'Use "async" for independent tags such as analytics.',
      "Move anything non-essential (chat widgets, popups, review badges) to the bottom of the page or load it after a user interaction.",
      "In WordPress, a caching plugin like WP Rocket, LiteSpeed Cache or Autoptimize can do this for you with a checkbox.",
    ],
  });

  /* ---------- 3. Stylesheet count ---------- */
  const stylesheets = Array.from(
    doc.querySelectorAll('link[rel~="stylesheet" i][href]'),
  ) as HTMLLinkElement[];
  mk({
    id: "perf-stylesheets",
    title: "Number of separate stylesheet files",
    status: stylesheets.length <= 4 ? "pass" : stylesheets.length <= 8 ? "warn" : "fail",
    weight: 2,
    metric: pluralise(stylesheets.length, "file"),
    finding: `The page links to ${pluralise(stylesheets.length, "CSS file")}. ${
      stylesheets.length <= 4
        ? "That is a reasonable number."
        : "Each one is a separate download that must finish before the page can be painted."
    }`,
    evidence: stylesheets.slice(0, 10).map((l) => shorten(l.getAttribute("href") || "", 90)),
    why: "Every stylesheet is a round-trip to the server. A page with a dozen CSS files can lose a second or more before anything appears, especially on mobile networks.",
    fix: [
      "Combine your CSS files into one (most caching/optimisation plugins offer “combine CSS”).",
      "Remove stylesheets from plugins or themes you no longer use.",
      "Load rarely-used CSS (print styles, pop-up styles) with media attributes so it does not block the first paint.",
    ],
  });

  /* ---------- 4. Inline CSS / JS weight ---------- */
  const inlineStyles = Array.from(doc.querySelectorAll("style"));
  const inlineScripts = Array.from(doc.querySelectorAll("script:not([src])"));
  const inlineBytes =
    inlineStyles.reduce((n, el) => n + byteLength(el.textContent || ""), 0) +
    inlineScripts.reduce((n, el) => n + byteLength(el.textContent || ""), 0);
  mk({
    id: "perf-inline-weight",
    title: "Code written directly inside the page",
    status: inlineBytes <= 40_000 ? "pass" : inlineBytes <= 120_000 ? "warn" : "fail",
    weight: 1,
    metric: kb(inlineBytes),
    finding: `${kb(inlineBytes)} of CSS and JavaScript is written directly inside the HTML (${inlineStyles.length} <style> and ${inlineScripts.length} inline <script> blocks).`,
    why: "Code embedded in the page cannot be cached by the browser, so returning visitors download it again on every single page view.",
    fix: [
      "Keep only the small amount of “critical CSS” inline; move the rest to cached .css files.",
      "Move inline scripts into external files served with long cache headers.",
      "Watch out for page builders that inject a copy of the same CSS into every page.",
    ],
  });

  /* ---------- 5. Images without dimensions (layout shift) ---------- */
  const images = Array.from(doc.querySelectorAll("img"));
  const noDims = images.filter((img) => {
    const style = (img.getAttribute("style") || "").toLowerCase();
    const hasInline = /(^|;)\s*(width|aspect-ratio)\s*:/.test(style);
    return !(img.hasAttribute("width") && img.hasAttribute("height")) && !hasInline;
  });
  mk({
    id: "perf-image-dimensions",
    title: "Images without a reserved width and height",
    status: images.length === 0 ? "info" : noDims.length === 0 ? "pass" : noDims.length <= 3 ? "warn" : "fail",
    weight: images.length === 0 ? 0 : 2,
    metric: images.length === 0 ? "no images" : `${noDims.length}/${images.length}`,
    finding:
      images.length === 0
        ? "This page has no <img> tags, so there is nothing to measure here. (Background images set in CSS are not visible to this check.)"
        : `${noDims.length} of ${images.length} images have no width/height attributes, so the browser does not know how much space to leave for them.`,
    evidence: noDims.slice(0, 8).map((img) => shorten(img.getAttribute("src") || describeElement(img), 90)),
    why: "Without reserved space, text jumps around as images pop in. It is annoying for visitors (people tap the wrong button) and Google penalises it as “layout shift”.",
    fix: [
      'Add the real pixel size to every image: <img src="..." width="800" height="600" alt="...">.',
      "Keep your CSS responsive (width: 100%; height: auto) — the attributes only tell the browser the aspect ratio.",
      "Most modern CMS themes add these automatically; if yours does not, it is usually a one-line template fix.",
    ],
  });

  /* ---------- 6. Lazy loading ---------- */
  const lazyCandidates = images.slice(2);
  const notLazy = lazyCandidates.filter((img) => (img.getAttribute("loading") || "").toLowerCase() !== "lazy");
  mk({
    id: "perf-lazy-images",
    title: "Lazy loading for images further down the page",
    status:
      images.length <= 2
        ? "info"
        : notLazy.length === 0
          ? "pass"
          : notLazy.length <= Math.max(2, lazyCandidates.length * 0.4)
            ? "warn"
            : "fail",
    weight: images.length <= 2 ? 0 : 1,
    metric: images.length <= 2 ? `${images.length} images` : `${notLazy.length} eager`,
    finding:
      images.length <= 2
        ? `Only ${pluralise(images.length, "image")} found — lazy loading would make little difference.`
        : `${notLazy.length} of the ${lazyCandidates.length} images below the first two are downloaded immediately instead of when the visitor scrolls to them.`,
    why: "Images the visitor may never scroll to still eat bandwidth and compete with the content they actually want to see first.",
    fix: [
      'Add loading="lazy" to images that are not visible when the page opens.',
      'Do NOT lazy-load your logo or main hero image — those should load straight away (loading="eager").',
      "Most CMS platforms have this built in; check that an optimisation plugin is not switching it off.",
    ],
  });

  /* ---------- 7. Total referenced resources ---------- */
  const resourceEls = Array.from(
    doc.querySelectorAll("img[src], script[src], link[rel~='stylesheet' i][href], iframe[src], video[src], source[src], audio[src]"),
  );
  const totalRefs = resourceEls.length;
  mk({
    id: "perf-resource-count",
    title: "How many files the page asks for",
    status: totalRefs <= 40 ? "pass" : totalRefs <= 80 ? "warn" : "fail",
    weight: 2,
    metric: `${totalRefs} files`,
    finding: `We counted ${totalRefs} files referenced in the HTML (images, scripts, stylesheets, iframes and media). This does not include files that JavaScript or CSS request later.`,
    why: "Each file is a separate request. Dozens of requests add up to real waiting time on mobile connections even when every single file is small.",
    fix: [
      "Combine CSS and JavaScript files where you can.",
      "Replace icon images with icon fonts or inline SVG.",
      "Delete unused plugins — each one usually adds its own scripts and styles to every page.",
      "Use a CDN so files come from a server near your visitor.",
    ],
  });

  /* ---------- 8. Third-party / iframe embeds ---------- */
  const host = ctx.url?.hostname ?? "";
  const thirdParty = new Set<string>();
  resourceEls.forEach((el) => {
    const raw = el.getAttribute("src") || el.getAttribute("href") || "";
    if (!/^https?:\/\//i.test(raw)) return;
    try {
      const h = new URL(raw).hostname;
      if (host && (h === host || h.endsWith(`.${host}`) || host.endsWith(`.${h}`))) return;
      thirdParty.add(h);
    } catch {
      /* ignore */
    }
  });
  const tpList = Array.from(thirdParty);
  mk({
    id: "perf-third-party",
    title: "Files loaded from other companies' servers",
    status: tpList.length === 0 ? "pass" : tpList.length <= 5 ? "warn" : "fail",
    weight: 2,
    metric: `${tpList.length} domains`,
    finding:
      tpList.length === 0
        ? "Everything on this page is served from your own domain — nice and predictable."
        : `Content is pulled from ${pluralise(tpList.length, "outside domain")}. If any of them is slow, your page is slow too.`,
    evidence: tpList.slice(0, 12),
    why: "Fonts, chat widgets, tracking pixels and embedded videos run on someone else's server. You cannot control their speed or downtime, but your visitors experience it as your website being slow.",
    fix: [
      "Keep only the third-party tools you genuinely use — audit tracking pixels once a year.",
      "Self-host fonts instead of loading them from Google Fonts.",
      "Replace embedded YouTube/Vimeo players with a click-to-play thumbnail.",
      'Add <link rel="preconnect"> for the few third parties you must keep.',
    ],
  });

  /* ---------- 9. Known heavy libraries (informational) ---------- */
  const scriptSrcs = Array.from(doc.querySelectorAll("script[src]")).map((s) => s.getAttribute("src") || "");
  const found = HEAVY_LIBS.filter((lib) => scriptSrcs.some((src) => lib.match.test(src))).map((l) => l.name);
  mk({
    id: "perf-libraries",
    title: "Well-known libraries detected",
    status: "info",
    weight: 0,
    metric: found.length ? `${found.length} found` : "none spotted",
    finding: found.length
      ? `We recognised these libraries in your script tags: ${Array.from(new Set(found)).join(", ")}. This is information, not a problem in itself — we cannot measure their real file size from here.`
      : "We did not recognise any of the common heavyweight libraries by file name. (They may still be bundled inside your own JavaScript files.)",
    why: "Older libraries such as jQuery or Moment.js are often loaded out of habit by themes and plugins, and can add hundreds of kilobytes that modern browsers no longer need.",
    fix: [
      "Ask your developer whether anything still depends on the older libraries listed.",
      "Look for lighter alternatives (e.g. native date formatting instead of Moment.js).",
      "If a plugin loads a library on every page but only needs it on one, restrict it to that page.",
    ],
  });

  /* ---------- 10. Image formats declared in the HTML (from v1 — extensions only, not file sizes) ---------- */
  if (images.length > 0) {
    const srcOf = (img: Element) => img.getAttribute("src") || img.getAttribute("data-src") || "";
    const ext = (s: string) => (s.split("?")[0].match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
    const srcs = images.map(srcOf);
    const legacyImgs = srcs.filter((s) => ["jpg", "jpeg", "png", "gif", "bmp"].includes(ext(s)));
    const modernImgs = srcs.filter((s) => ["webp", "avif", "svg"].includes(ext(s)));
    mk({
      id: "perf-image-formats",
      title: "Image formats named in the HTML",
      status: images.length === 0 ? "info" : legacyImgs.length > 12 ? "fail" : legacyImgs.length > 5 ? "warn" : "pass",
      weight: 1,
      metric: `${modernImgs.length} modern / ${legacyImgs.length} legacy`,
      finding: `${legacyImgs.length} of ${images.length} images use older filename extensions (JPG/PNG/GIF) and ${modernImgs.length} use WebP, AVIF or SVG. This only reads the URL — we did not download the files, so we are not reporting kilobytes.`,
      why: "WebP and AVIF are typically 25–50% smaller than JPEG at the same quality. On a phone that is real waiting time and real mobile data.",
      fix: [
        "Export photos as WebP — most CMS plugins can convert a whole library in one click.",
        "Keep a JPEG/PNG fallback inside a <picture> element for older browsers if you still need one.",
        "Resize before uploading: a 4000 px camera photo displayed at 800 px wastes most of the download. (We cannot measure that from the HTML alone.)",
      ],
    });
  }

  /* ---------- 11. WordPress plugins loading files (from v1) ---------- */
  if (/wp-content|wp-includes/.test(ctx.html)) {
    const plugins = new Set<string>();
    const re = /wp-content\/plugins\/([a-z0-9_-]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(ctx.html))) plugins.add(m[1]);
    mk({
      id: "perf-wp-plugins",
      title: "WordPress plugins loading files on this page",
      status: plugins.size <= 6 ? "pass" : plugins.size <= 12 ? "warn" : "fail",
      weight: 2,
      metric: `${plugins.size} plugins`,
      finding: `WordPress paths were found in the HTML. ${plugins.size} distinct plugin folder${plugins.size === 1 ? "" : "s"} are loading CSS or JavaScript on this page${plugins.size ? `: ${Array.from(plugins).slice(0, 12).join(", ")}` : ""}.`,
      evidence: Array.from(plugins).slice(0, 16),
      why: "Most plugins load their files on every page even when unused. This is the single most common cause of a slow WordPress site.",
      fix:
        plugins.size <= 6
          ? ["Review new plugins for the files they add before keeping them."]
          : [
              "Deactivate and delete plugins you no longer use — deactivating alone is not enough for security.",
              "Use a plugin like Asset CleanUp or Perfmatters to stop plugins loading where they are not needed.",
              "Add a caching plugin and enable file combining.",
            ],
    });
  }

  /* ---------- 12. CSS payload (only when stylesheets were actually downloaded) ---------- */
  if (ctx.extras.cssAttempted) {
    const okFiles = ctx.extras.css.filter((c) => c.ok);
    if (okFiles.length > 0) {
      const cssBytes = okFiles.reduce((n, c) => n + c.bytes, 0);
      mk({
        id: "perf-css-weight",
        title: "Size of the stylesheets we were able to download",
        status: cssBytes <= 150_000 ? "pass" : cssBytes <= 400_000 ? "warn" : "fail",
        weight: 1,
        metric: kb(cssBytes),
        finding: `We downloaded ${pluralise(okFiles.length, "stylesheet")} (out of ${stylesheets.length} linked) totalling ${kb(cssBytes)} before compression.`,
        evidence: okFiles.map((c) => `${kb(c.bytes)} — ${shorten(c.url, 70)}`),
        why: "CSS blocks rendering: the browser will not paint anything until it has parsed your stylesheets. Bloated theme CSS is one of the most common causes of a slow first impression.",
        fix: [
          "Remove CSS for features and page-builder widgets you do not use.",
          "Enable Gzip/Brotli compression so the transferred size is a fraction of this.",
          "Consider a “remove unused CSS” option in your optimisation plugin, then test the site carefully.",
        ],
      });
    } else {
      mk({
        id: "perf-css-weight",
        title: "Size of the stylesheets",
        status: "unknown",
        weight: 0,
        finding:
          "We tried to download your CSS files but none of them could be read through the proxy (they may be blocked, behind a CDN rule, or on a different domain). No guess is shown here.",
        why: "CSS size directly affects how quickly a page can be painted.",
        fix: ["Check the file size of your main stylesheet in your browser's developer tools (Network tab)."],
      });
    }
  }

  /* ---------- 11. Measured round-trip (clearly labelled) ---------- */
  if (ctx.fetchMeta && ctx.source === "url") {
    mk({
      id: "perf-roundtrip",
      title: "Measured download time (through a proxy)",
      status: "info",
      weight: 0,
      metric: `${(ctx.fetchMeta.elapsedMs / 1000).toFixed(2)}s`,
      finding: `Fetching the HTML took ${(ctx.fetchMeta.elapsedMs / 1000).toFixed(2)} seconds in total. ⚠️ This figure includes the time taken by the public proxy service we have to use, so it is NOT your real server response time and should not be treated as a page-speed score.`,
      why: "We show it only for transparency about what this tool measured. Use a lab tool that loads the page in a real browser for trustworthy timings.",
      fix: [
        "For a real measurement, run PageSpeed Insights (pagespeed.web.dev) or WebPageTest on the same URL.",
        "Compare results at different times of day — shared hosting is often slow at peak times.",
      ],
    });
  }

  /*
   * When the markup had to be retrieved through a re-serialising proxy we cannot
   * trust anything that depends on HOW resources are referenced (the proxy may
   * inline, merge or re-order them). Those checks are demoted to "could not check"
   * rather than reported as findings.
   */
  if (approx) {
    const unreliable = new Set([
      "perf-render-blocking-js",
      "perf-stylesheets",
      "perf-inline-weight",
      "perf-resource-count",
      "perf-third-party",
    ]);
    out.forEach((check) => {
      if (!unreliable.has(check.id)) return;
      check.status = "unknown";
      check.weight = 0;
      check.finding = `${check.finding}\n\n⚠️ Not scored: this page reached us through a proxy that rebuilds the markup and can inline or re-order stylesheets and scripts, so the number above may not match your real page. Open your page and press Ctrl+U to see the true source, or use the “Paste HTML” tab for an accurate result.`;
    });
  }

  return out;
}

export const performanceNotChecked: NotCheckedItem[] = [
  {
    category: "performance",
    title: "Core Web Vitals (LCP, CLS, INP)",
    reason:
      "These require loading your page in a real browser engine and watching it paint. A browser-only tool cannot do this for another website. Not implemented.",
  },
  {
    category: "performance",
    title: "Image file weight and modern formats (WebP / AVIF)",
    reason:
      "We would have to download every image to measure it. We list which images lack dimensions, but we never estimate file sizes we have not measured. Not implemented.",
  },
  {
    category: "performance",
    title: "Server compression, caching headers, CDN and TTFB",
    reason:
      "The page is fetched through a public CORS proxy, so the original response headers and server timing are not visible to us. Not implemented.",
  },
  {
    category: "performance",
    title: "JavaScript execution time and main-thread blocking",
    reason: "Requires actually running your JavaScript in a controlled browser environment. Not implemented.",
  },
];
