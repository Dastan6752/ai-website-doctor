import type { AuditContext, CheckResult, NotCheckedItem } from "../types";
import { makeCheck, pluralise, shorten, text } from "./helpers";

export function seoChecks(ctx: AuditContext): CheckResult[] {
  const { doc } = ctx;
  const out: CheckResult[] = [];
  const mk = (c: Omit<CheckResult, "category">) => out.push(makeCheck("seo", c));

  /* ---------- 1. Title ---------- */
  const titleText = text(doc.querySelector("title"));
  const titleLen = titleText.length;
  mk({
    id: "seo-title",
    title: "Page title (the words shown in the Google result)",
    status: titleLen === 0 ? "fail" : titleLen < 15 || titleLen > 65 ? "warn" : "pass",
    weight: 3,
    metric: titleLen ? `${titleLen} chars` : "missing",
    finding:
      titleLen === 0
        ? "This page has no <title>. Google will invent one from your page content, and browser tabs will show the bare URL."
        : `Your title is ${titleLen} characters: “${titleText}”. ${
            titleLen < 15
              ? "That is very short — you are wasting valuable space in search results."
              : titleLen > 65
                ? "Google usually cuts titles off at around 60 characters, so the end will be hidden."
                : "That length displays well in search results."
          }`,
    why: "The title is the blue clickable headline in Google and the name of the browser tab. It is the single biggest on-page influence on whether someone clicks your result instead of a competitor's.",
    fix: [
      "Aim for 50–60 characters.",
      "Put the most important words first: “Emergency Plumber in Leeds | 24/7 Callout — Smith & Sons”.",
      "Give every page its own unique title — never leave several pages called “Home”.",
    ],
  });

  /* ---------- 2. Meta description ---------- */
  const descEl = doc.querySelector('meta[name="description" i]');
  const desc = (descEl?.getAttribute("content") || "").trim();
  mk({
    id: "seo-description",
    title: "Meta description (the summary under your Google result)",
    status: !desc ? "fail" : desc.length < 50 || desc.length > 165 ? "warn" : "pass",
    weight: 3,
    metric: desc ? `${desc.length} chars` : "missing",
    finding: !desc
      ? "There is no meta description. Google will scrape a random sentence from your page instead, which is often a cookie notice or a menu."
      : `Your description is ${desc.length} characters: “${shorten(desc, 170)}”. ${
          desc.length < 50
            ? "Too short to be persuasive."
            : desc.length > 165
              ? "It will be cut off mid-sentence in the results."
              : "Good length."
        }`,
    why: "It is your free advert in the search results. A clear, benefit-led sentence measurably increases the number of people who click.",
    fix: [
      "Write 120–155 characters describing what the visitor gets.",
      "Include your town or service area if you serve local customers.",
      "Finish with a reason to click: “Free quote within 24 hours.”",
      "Write a different one for every page.",
    ],
  });

  /* ---------- 3. H1 ---------- */
  const h1s = Array.from(doc.querySelectorAll("h1")).filter((h) => text(h).length > 0);
  mk({
    id: "seo-h1",
    title: "Main heading (H1) on the page",
    status: h1s.length === 1 ? "pass" : h1s.length === 0 ? "fail" : "warn",
    weight: 2,
    metric: pluralise(h1s.length, "H1"),
    finding:
      h1s.length === 0
        ? "No visible H1 heading was found. Search engines and screen readers both use the H1 to understand what the page is about."
        : h1s.length === 1
          ? `Exactly one H1: “${shorten(text(h1s[0]), 100)}”.`
          : `There are ${h1s.length} H1 headings: ${h1s.slice(0, 4).map((h) => `“${shorten(text(h), 40)}”`).join(", ")}. Multiple top-level headings dilute the page's topic.`,
    why: "The H1 is the on-page equivalent of a newspaper headline. One clear H1 tells Google and your visitor, in one line, what this page is for.",
    fix: [
      "Use exactly one H1 per page, describing the page's purpose.",
      "Include the phrase a customer would actually search for.",
      "Do not use the H1 just for your logo or company name on every page.",
    ],
  });

  /* ---------- 4. Indexability ---------- */
  const robotsMeta = (doc.querySelector('meta[name="robots" i]')?.getAttribute("content") || "").toLowerCase();
  const noindex = /noindex/.test(robotsMeta);
  const nofollow = /nofollow/.test(robotsMeta);
  mk({
    id: "seo-indexable",
    title: "Google is allowed to list this page",
    status: noindex ? "fail" : nofollow ? "warn" : "pass",
    weight: 3,
    metric: noindex ? "noindex!" : robotsMeta ? shorten(robotsMeta, 24) : "indexable",
    finding: noindex
      ? `🚨 This page contains <meta name="robots" content="${shorten(robotsMeta, 60)}">. That is an explicit instruction telling Google NOT to list this page. It will never appear in search results while this is in place.`
      : nofollow
        ? `The robots meta tag says "${shorten(robotsMeta, 60)}". The page can be listed, but Google is told not to follow the links on it.`
        : robotsMeta
          ? `The robots meta tag says "${shorten(robotsMeta, 60)}" — nothing here blocks indexing.`
          : "No robots meta tag blocking indexing was found, so the page can be listed normally.",
    why: "A stray noindex tag — usually left over from when the site was being built — is the number one reason a brand-new website never appears in Google.",
    fix: [
      "Remove the noindex instruction from pages you want found.",
      "In WordPress, check Settings → Reading → “Discourage search engines from indexing this site” is UNCHECKED.",
      "In Wix/Squarespace/Shopify, look for a per-page “Hide from search engines” toggle.",
      "After fixing, request indexing in Google Search Console.",
    ],
  });

  /* ---------- 5. Canonical ---------- */
  const canonical = doc.querySelector('link[rel="canonical" i]')?.getAttribute("href") || "";
  let canonicalValid = canonical.length > 0;
  if (canonical && ctx.url) {
    try {
      new URL(canonical, ctx.url.href);
    } catch {
      canonicalValid = false;
    }
  }
  mk({
    id: "seo-canonical",
    title: "Canonical link (prevents duplicate-page confusion)",
    status: canonicalValid ? "pass" : "warn",
    weight: 1,
    metric: canonical ? "present" : "missing",
    finding: canonicalValid
      ? `A canonical URL is declared: ${shorten(canonical, 90)}`
      : canonical
        ? `A canonical tag exists but the value could not be read as a URL: “${shorten(canonical, 70)}”.`
        : "No canonical link was found. If the same content is reachable at several addresses (with/without www, with tracking parameters), Google has to guess which is the real one.",
    why: "Online shops in particular end up with dozens of URLs showing the same product. A canonical tag concentrates all the ranking value on one address instead of splitting it.",
    fix: [
      'Add <link rel="canonical" href="https://www.example.com/the-page"> to each page, pointing at its preferred address.',
      "Most SEO plugins (Yoast, Rank Math, SEOPress) do this automatically — check it is switched on.",
      "Make sure the canonical points to a page that actually loads (status 200).",
    ],
  });

  /* ---------- 6. Social sharing preview ---------- */
  const og = ["og:title", "og:description", "og:image"].map((p) => ({
    prop: p,
    value: doc.querySelector(`meta[property="${p}" i]`)?.getAttribute("content") || "",
  }));
  const ogFound = og.filter((o) => o.value.trim().length > 0);
  const twitterCard = doc.querySelector('meta[name="twitter:card" i]')?.getAttribute("content") || "";
  mk({
    id: "seo-social",
    title: "How your page looks when shared on social media",
    status: ogFound.length === 3 ? "pass" : ogFound.length === 0 ? "fail" : "warn",
    weight: 1,
    metric: `${ogFound.length}/3 tags`,
    finding:
      ogFound.length === 0
        ? "No Open Graph tags were found. When someone shares your page on Facebook, LinkedIn or WhatsApp it will show a bare link with no picture and whatever text the platform scrapes."
        : `Found ${ogFound.map((o) => o.prop).join(", ")}${twitterCard ? ` plus a Twitter card type of "${twitterCard}"` : ""}. Missing: ${og.filter((o) => !o.value).map((o) => o.prop).join(", ") || "nothing"}.`,
    evidence: ogFound.map((o) => `${o.prop}: ${shorten(o.value, 70)}`),
    why: "A shared link with a big image gets far more clicks than a bare URL. For a small business, word-of-mouth sharing in WhatsApp groups and Facebook pages is often the main traffic source.",
    fix: [
      'Add og:title, og:description and og:image (1200×630 px) to <head>.',
      'Add <meta name="twitter:card" content="summary_large_image">.',
      "Test with Facebook's Sharing Debugger or LinkedIn's Post Inspector after publishing.",
    ],
  });

  /* ---------- 7. Structured data ---------- */
  const ldNodes = Array.from(doc.querySelectorAll('script[type="application/ld+json" i]'));
  const parsedTypes: string[] = [];
  let brokenJson = 0;
  ldNodes.forEach((n) => {
    try {
      const data = JSON.parse(n.textContent || "{}");
      const collect = (d: unknown) => {
        if (Array.isArray(d)) return d.forEach(collect);
        if (d && typeof d === "object") {
          const t = (d as Record<string, unknown>)["@type"];
          if (typeof t === "string") parsedTypes.push(t);
          else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && parsedTypes.push(x));
          const graph = (d as Record<string, unknown>)["@graph"];
          if (graph) collect(graph);
        }
      };
      collect(data);
    } catch {
      brokenJson += 1;
    }
  });
  mk({
    id: "seo-structured-data",
    title: "Structured data (helps Google show extra detail)",
    status: brokenJson > 0 ? "fail" : ldNodes.length === 0 ? "warn" : "pass",
    weight: 1,
    metric: ldNodes.length ? `${ldNodes.length} block(s)` : "none",
    finding:
      ldNodes.length === 0
        ? "No JSON-LD structured data was found. Google has to work out your opening hours, address and reviews from plain text — and often gets it wrong."
        : brokenJson > 0
          ? `${pluralise(brokenJson, "structured-data block")} contain invalid JSON and will be ignored by search engines.`
          : `Found ${pluralise(ldNodes.length, "valid JSON-LD block")} describing: ${Array.from(new Set(parsedTypes)).join(", ") || "unnamed types"}.`,
    evidence: Array.from(new Set(parsedTypes)).slice(0, 10),
    why: "Structured data is what produces star ratings, opening hours, FAQs and event dates directly in the search results. For a local business, LocalBusiness markup is the difference between a plain link and a rich listing.",
    fix: [
      "Add LocalBusiness (or Organization) markup with your name, address, phone and opening hours.",
      "Add Product + AggregateRating markup if you sell online, FAQPage for FAQ sections.",
      "Validate with Google's Rich Results Test before relying on it.",
      "SEO plugins can generate most of this for you.",
    ],
  });

  /* ---------- 8. HTTPS ---------- */
  if (!ctx.url || ctx.source !== "url") {
    mk({
      id: "seo-https",
      title: "Secure connection (HTTPS)",
      status: "unknown",
      weight: 0,
      metric: "no request made",
      finding:
        "This report was built from HTML you pasted in, so no request was made to your server. We will not assume whether it is served over HTTPS — check your browser's address bar for a padlock instead.",
      why: "Browsers label http:// pages “Not secure”, which scares visitors away, and Google treats HTTPS as a ranking signal.",
      fix: [
        "Visit your site and look for the padlock icon next to the address.",
        "If it is missing, ask your host to enable a free SSL certificate and redirect http:// to https://.",
      ],
    });

    const insecurePasted = Array.from(doc.querySelectorAll("[src], [href]"))
      .map((el) => el.getAttribute("src") || el.getAttribute("href") || "")
      .filter((v) => /^http:\/\//i.test(v));
    mk({
      id: "seo-mixed-content",
      title: "Insecure http:// references in the markup",
      status: insecurePasted.length === 0 ? "pass" : "warn",
      weight: 0,
      metric: `${insecurePasted.length} found`,
      finding:
        insecurePasted.length === 0
          ? "No http:// references were found in the HTML you pasted."
          : `${pluralise(insecurePasted.length, "reference")} point at insecure http:// addresses. This only causes a browser warning if the page itself is served over https — which we cannot confirm from pasted HTML, so this is not scored.`,
      evidence: Array.from(new Set(insecurePasted)).slice(0, 8).map((u) => shorten(u, 90)),
      why: "Mixed content silently breaks images and scripts and can remove the padlock from the address bar.",
      fix: ["Change http:// to https:// throughout your content, theme files and database."],
    });
  } else {
    const isHttps = ctx.url.protocol === "https:";
    mk({
      id: "seo-https",
      title: "Secure connection (HTTPS)",
      status: isHttps ? "pass" : "fail",
      weight: 3,
      metric: isHttps ? "https" : "http only",
      finding: isHttps
        ? `The page was served over HTTPS (${ctx.url.origin}).`
        : `This page was requested over plain HTTP (${ctx.url.origin}). Chrome shows a “Not secure” warning next to the address, and Google treats HTTPS as a ranking signal.`,
      why: "Visitors — especially anyone about to type a phone number or card detail — abandon sites that show a “Not secure” warning. Certificates are free with Let's Encrypt and included by nearly every host.",
      fix: [
        "Ask your host to enable a free SSL certificate (most have a one-click option).",
        "Redirect all http:// traffic to https:// permanently (301).",
        "Update internal links and image URLs to https so no mixed-content warnings remain.",
      ],
    });

    /* ---------- 9. Mixed content ---------- */
    if (isHttps) {
      const insecure = Array.from(doc.querySelectorAll("[src], [href]"))
        .map((el) => el.getAttribute("src") || el.getAttribute("href") || "")
        .filter((v) => /^http:\/\//i.test(v));
      mk({
        id: "seo-mixed-content",
        title: "Insecure files on a secure page",
        status: insecure.length === 0 ? "pass" : "fail",
        weight: 2,
        metric: `${insecure.length} found`,
        finding:
          insecure.length === 0
            ? "Every resource referenced in the HTML uses https:// — no mixed-content problems in the page source."
            : `${pluralise(insecure.length, "reference")} still point at insecure http:// addresses on an otherwise secure page. Browsers block or warn about these.`,
        evidence: Array.from(new Set(insecure)).slice(0, 8).map((u) => shorten(u, 90)),
        why: "Mixed content silently breaks images, fonts and scripts and can remove the padlock from your address bar, undermining trust at the exact moment someone is deciding to buy.",
        fix: [
          "Change http:// to https:// in your content, theme files and database.",
          "On WordPress, a search-and-replace tool or the “Better Search Replace” plugin fixes old URLs in bulk.",
          "Re-check after fixing — browsers cache mixed-content warnings.",
        ],
      });
    }
  }

  /* ---------- 10. Content depth ---------- */
  const bodyClone = doc.body?.cloneNode(true) as HTMLElement | undefined;
  bodyClone?.querySelectorAll("script, style, noscript, template").forEach((n) => n.remove());
  const bodyText = (bodyClone?.textContent || "").replace(/\s+/g, " ").trim();
  const words = bodyText ? bodyText.split(" ").filter((w) => w.length > 1).length : 0;
  mk({
    id: "seo-content-depth",
    title: "Amount of readable text in the HTML",
    status: words >= 300 ? "pass" : words >= 120 ? "warn" : "fail",
    weight: 2,
    metric: `${words} words`,
    finding:
      words >= 300
        ? `About ${words} words of text were delivered in the HTML — enough for a search engine to understand the topic.`
        : `Only about ${words} words of text were found in the delivered HTML. ${
            words < 120
              ? "Either the page is very thin, or your content is inserted by JavaScript after the page loads — in which case some crawlers and all of this report's text checks see very little."
              : "That is on the thin side for a page you want to rank."
          }`,
    why: "Search engines rank text they can read. Pages built mostly from images, sliders or JavaScript often have almost no indexable content, which is why they never rank for anything.",
    fix: [
      "Aim for 300+ genuinely useful words on pages you want found in search.",
      "Write the answers to the questions customers actually ask you on the phone.",
      "If your site is a JavaScript app, enable server-side rendering or pre-rendering.",
      "Never hide important text inside images.",
    ],
  });

  /* ---------- 11. Favicon ---------- */
  const favicon = doc.querySelector('link[rel~="icon" i], link[rel="shortcut icon" i], link[rel="apple-touch-icon" i]');
  mk({
    id: "seo-favicon",
    title: "Site icon (favicon)",
    status: favicon ? "pass" : "warn",
    weight: 1,
    metric: favicon ? "declared" : "not declared",
    finding: favicon
      ? `A site icon is declared: ${shorten(favicon.getAttribute("href") || "", 70)}`
      : "No favicon link was found in the HTML. (Some sites still work because browsers look for /favicon.ico automatically — we did not test that file.)",
    why: "The little icon appears in browser tabs, bookmarks and increasingly next to your listing on mobile search results. Its absence looks unfinished.",
    fix: [
      'Add <link rel="icon" href="/favicon.ico" sizes="any"> and an apple-touch-icon for iOS home screens.',
      "Use a simple, high-contrast mark — it is displayed at 16×16 pixels.",
    ],
  });

  /* ---------- 12. Internal links (from v1) ---------- */
  const anchors = Array.from(doc.querySelectorAll("a[href]"));
  const pageHost = ctx.url?.hostname.replace(/^www\./, "") ?? "";
  const internal = anchors.filter((a) => {
    const href = a.getAttribute("href") || "";
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return false;
    try {
      const abs = new URL(href, ctx.url?.href || "https://example.invalid/");
      if (!/^https?:$/i.test(abs.protocol)) return false;
      if (!pageHost) return href.startsWith("/") || href.startsWith("./");
      return abs.hostname.replace(/^www\./, "") === pageHost;
    } catch {
      return false;
    }
  });
  mk({
    id: "seo-internal-links",
    title: "Links to your other pages",
    status: internal.length >= 5 ? "pass" : internal.length >= 1 ? "warn" : "fail",
    weight: 1,
    metric: `${internal.length} internal`,
    finding: `We counted ${internal.length} links pointing to pages on your own domain, out of ${anchors.length} links on the page. ${
      internal.length >= 5
        ? "That is enough for visitors and Google to find the rest of your site."
        : "Google discovers pages by following links, and visitors who land here have nowhere obvious to go next."
    }`,
    why: "A page with no internal links is a dead end. Search engines may never find your services, and customers bounce instead of browsing.",
    fix:
      internal.length >= 5
        ? ["Use descriptive link text (e.g. “boiler repair prices”) rather than “click here”."]
        : [
            "Add a clear navigation menu that appears on every page.",
            "Link from your text to related services where it genuinely helps the reader.",
            "Add a footer with links to your main service pages, contact page and location.",
          ],
  });

  /* ---------- 13. robots.txt (real fetch) ---------- */
  const robots = ctx.extras.robotsTxt;
  if (robots.attempted) {
    const blocksAll = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*($|\n)/i.test(robots.text);
    mk({
      id: "seo-robots-txt",
      title: "robots.txt file",
      status: !robots.ok ? "unknown" : blocksAll ? "fail" : "pass",
      weight: robots.ok ? 1 : 0,
      metric: robots.ok ? (blocksAll ? "blocks crawlers" : "ok") : "not readable",
      finding: !robots.ok
        ? `We asked for ${ctx.url?.origin}/robots.txt but did not get a readable file back${robots.status ? ` (HTTP ${robots.status})` : ""}. This is not necessarily a problem — a missing robots.txt means “crawl everything” — but we could not verify it, so nothing is assumed.`
        : blocksAll
          ? "🚨 Your robots.txt contains “Disallow: /” for all crawlers. That tells Google to stay away from the entire site."
          : "robots.txt was found and does not block the whole site from being crawled.",
      evidence: robots.ok ? robots.text.split("\n").slice(0, 12).map((l) => l.trim()).filter(Boolean) : undefined,
      why: "robots.txt is the first file a search engine reads. One wrong line here can remove an entire website from Google.",
      fix: [
        "Keep robots.txt simple; only block admin or checkout areas.",
        "Never leave “Disallow: /” on a live site (it is common on staging sites that get copied live).",
        "Add a Sitemap: line pointing to your XML sitemap.",
      ],
    });
  }

  /* ---------- 13. Sitemap (real fetch) ---------- */
  const sitemap = ctx.extras.sitemap;
  if (sitemap.attempted) {
    const declaredInRobots = /sitemap:\s*\S+/i.exec(robots.text || "")?.[0];
    mk({
      id: "seo-sitemap",
      title: "XML sitemap",
      status: sitemap.ok ? "pass" : declaredInRobots ? "warn" : "unknown",
      weight: 1,
      metric: sitemap.ok ? "found" : "not confirmed",
      finding: sitemap.ok
        ? `An XML sitemap responded at ${shorten(sitemap.url, 80)}.`
        : declaredInRobots
          ? `robots.txt points to a sitemap (${shorten(declaredInRobots, 70)}) but we could not download ${shorten(sitemap.url, 60)} to confirm it works.`
          : `We could not confirm a sitemap at ${shorten(sitemap.url, 70)}${sitemap.status ? ` (HTTP ${sitemap.status})` : ""}. It may exist at a different address — we are not assuming either way.`,
      why: "A sitemap is a list of every page you want indexed. Without one, Google finds pages only by following links, and newer pages can wait weeks.",
      fix: [
        "Generate /sitemap.xml with your CMS or SEO plugin.",
        "Reference it from robots.txt: Sitemap: https://example.com/sitemap.xml.",
        "Submit it in Google Search Console and Bing Webmaster Tools.",
      ],
    });
  }

  return out;
}

export const seoNotChecked: NotCheckedItem[] = [
  {
    category: "seo",
    title: "Keyword rankings, search volume and competitor comparison",
    reason:
      "This needs live search-engine data from a paid API (Semrush, Ahrefs, DataForSEO). We will not invent positions. Not implemented.",
  },
  {
    category: "seo",
    title: "Backlinks and domain authority",
    reason: "Requires a crawled link index. Not implemented.",
  },
  {
    category: "seo",
    title: "Whether your pages are actually indexed by Google",
    reason:
      "Only Google Search Console can tell you this for your own site. Connect your property there — it is free. Not implemented.",
  },
  {
    category: "seo",
    title: "Site-wide crawl: broken links, duplicate titles, orphan pages",
    reason:
      "This report looks at one single URL. Crawling every page would need a server-side crawler. Not implemented.",
  },
  {
    category: "seo",
    title: "Google Business Profile, reviews and local citations",
    reason: "Requires access to third-party local-listing data. Not implemented.",
  },
];
