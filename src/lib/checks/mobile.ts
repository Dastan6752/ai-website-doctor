import type { AuditContext, CheckResult, NotCheckedItem } from "../types";
import { describeElement, makeCheck, pluralise, shorten, text } from "./helpers";

function parseViewport(content: string): Record<string, string> {
  const map: Record<string, string> = {};
  content.split(",").forEach((part) => {
    const [k, v] = part.split("=");
    if (k && v) map[k.trim().toLowerCase()] = v.trim().toLowerCase();
  });
  return map;
}

export function mobileChecks(ctx: AuditContext): CheckResult[] {
  const { doc } = ctx;
  const out: CheckResult[] = [];
  const mk = (c: Omit<CheckResult, "category">) => out.push(makeCheck("mobile", c));

  const viewportEl = doc.querySelector('meta[name="viewport" i]');
  const viewportContent = viewportEl?.getAttribute("content") || "";
  const vp = parseViewport(viewportContent);

  /* ---------- 1. Viewport tag ---------- */
  const hasDeviceWidth = (vp["width"] || "") === "device-width";
  mk({
    id: "mob-viewport",
    title: "The “mobile viewport” instruction",
    status: !viewportEl ? "fail" : hasDeviceWidth ? "pass" : "warn",
    weight: 3,
    metric: viewportEl ? (hasDeviceWidth ? "correct" : "unusual") : "missing",
    finding: !viewportEl
      ? "There is no viewport meta tag. Phones will assume your site is a desktop site and shrink the whole page down to fit, making text unreadably small."
      : hasDeviceWidth
        ? `Found a correct viewport tag: "${shorten(viewportContent, 80)}".`
        : `A viewport tag exists but it does not use width=device-width: "${shorten(viewportContent, 80)}". Fixed widths here cause sideways scrolling on phones.`,
    why: "This single line of HTML tells a phone to lay the page out at phone width. Without it, nothing else about your responsive design works.",
    fix: [
      'Add this inside <head>: <meta name="viewport" content="width=device-width, initial-scale=1">',
      "Remove any fixed pixel width (e.g. width=1024) from the viewport tag.",
      "Most modern themes include this already — if it is missing, your theme is probably over ten years old.",
    ],
  });

  /* ---------- 2. Pinch-zoom blocked ---------- */
  const maxScale = parseFloat(vp["maximum-scale"] || "");
  const zoomBlocked =
    vp["user-scalable"] === "no" || vp["user-scalable"] === "0" || (!Number.isNaN(maxScale) && maxScale < 2);
  mk({
    id: "mob-zoom",
    title: "Can visitors pinch to zoom?",
    status: !viewportEl ? "unknown" : zoomBlocked ? "fail" : "pass",
    weight: viewportEl ? 2 : 0,
    metric: !viewportEl ? "no viewport tag" : zoomBlocked ? "blocked" : "allowed",
    finding: !viewportEl
      ? "There is no viewport tag at all, so we cannot say how zooming is configured."
      : zoomBlocked
        ? `Zooming is disabled (${shorten(viewportContent, 80)}). Anyone who needs bigger text — a large share of over-50s customers — simply cannot read your page.`
        : "Zooming is allowed. Visitors can pinch to enlarge text and images.",
    why: "Blocking zoom is one of the most common and most harmful mobile mistakes. It is also an accessibility failure under WCAG 1.4.4.",
    fix: [
      'Remove "user-scalable=no" and "maximum-scale=1" from the viewport tag.',
      'The safe value is: <meta name="viewport" content="width=device-width, initial-scale=1">',
      "If zooming was disabled to hide a layout bug, fix the layout instead.",
    ],
  });

  /* ---------- 3. Responsive CSS (media queries) ---------- */
  const inlineCss = Array.from(doc.querySelectorAll("style"))
    .map((s) => s.textContent || "")
    .join("\n");
  const fetchedCss = ctx.extras.css.filter((c) => c.ok);
  const allCss = inlineCss + "\n" + fetchedCss.map((c) => c.text).join("\n");
  const mediaQueryCount = (allCss.match(/@media[^{]*\(/gi) || []).length;
  const linkMedia = Array.from(doc.querySelectorAll("link[rel~='stylesheet' i][media]")).filter((l) =>
    /max-width|min-width/i.test(l.getAttribute("media") || ""),
  ).length;
  const haveAnyCss = inlineCss.trim().length > 0 || fetchedCss.length > 0;
  const totalResponsiveSignals = mediaQueryCount + linkMedia;

  mk({
    id: "mob-media-queries",
    title: "Does the CSS adapt to small screens?",
    status: !haveAnyCss
      ? "unknown"
      : totalResponsiveSignals === 0
        ? "fail"
        : totalResponsiveSignals < 3
          ? "warn"
          : "pass",
    weight: haveAnyCss ? 3 : 0,
    metric: haveAnyCss ? `${totalResponsiveSignals} rules` : "CSS unreadable",
    finding: !haveAnyCss
      ? "We could not read any of your CSS (no inline styles, and your stylesheet files could not be downloaded through the proxy). We will not guess — this check did not run."
      : totalResponsiveSignals === 0
        ? `We read ${fetchedCss.length ? pluralise(fetchedCss.length, "stylesheet") + " plus inline CSS" : "the inline CSS"} and found no @media rules at all. That usually means the layout is fixed and will not re-flow on a phone.`
        : `Found ${pluralise(mediaQueryCount, "@media rule")}${linkMedia ? ` and ${pluralise(linkMedia, "responsive stylesheet link")}` : ""} in the CSS we could read${fetchedCss.length ? ` (${fetchedCss.length} of ${ctx.extras.css.length} stylesheets downloaded)` : ""}.`,
    evidence: fetchedCss.map((c) => `read: ${shorten(c.url, 70)}`),
    why: "Media queries are how a design switches from a wide desktop layout to a single column on a phone. No media queries almost always means a desktop-only design.",
    fix: [
      "Use a responsive theme, or ask your developer to add breakpoints (e.g. @media (max-width: 768px)).",
      "Design mobile-first: start with a single column and add complexity for wider screens.",
      "Test by narrowing your desktop browser window to about 375 px wide.",
    ],
  });

  /* ---------- 4. Fixed-width elements ---------- */
  const fixedWidth: string[] = [];
  Array.from(doc.querySelectorAll("[style]")).forEach((el) => {
    const style = el.getAttribute("style") || "";
    const m = style.match(/(?:^|;)\s*(?:min-)?width\s*:\s*(\d{3,5})px/i);
    if (m && parseInt(m[1], 10) > 480) fixedWidth.push(`${describeElement(el)} → width:${m[1]}px`);
  });
  Array.from(doc.querySelectorAll("[width]")).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "img" || tag === "svg" || tag === "canvas" || tag === "video") return; // dimension hints, fine
    const v = parseInt(el.getAttribute("width") || "", 10);
    if (!Number.isNaN(v) && v > 480) fixedWidth.push(`${describeElement(el)} → width="${v}"`);
  });
  mk({
    id: "mob-fixed-widths",
    title: "Elements locked to a wide fixed size",
    status: fixedWidth.length === 0 ? "pass" : fixedWidth.length <= 3 ? "warn" : "fail",
    weight: 2,
    metric: pluralise(fixedWidth.length, "element"),
    finding:
      fixedWidth.length === 0
        ? "No elements with a hard-coded width wider than 480 px were found in the HTML."
        : `${pluralise(fixedWidth.length, "element")} have a fixed width wider than a phone screen. These are the classic cause of “my site scrolls sideways on mobile”.`,
    evidence: fixedWidth.slice(0, 8),
    why: "A phone screen is roughly 360–430 px wide. Anything wider that cannot shrink pushes the whole layout sideways, hides your buttons and looks broken.",
    fix: [
      "Replace fixed pixel widths with max-width: 100% so elements shrink on small screens.",
      "For images: img { max-width: 100%; height: auto; }.",
      "Old-style HTML width attributes on tables and divs should be moved into responsive CSS.",
    ],
  });

  /* ---------- 5. Tiny text ---------- */
  const tiny: string[] = [];
  Array.from(doc.querySelectorAll("[style]")).forEach((el) => {
    const m = (el.getAttribute("style") || "").match(/font-size\s*:\s*(\d{1,2}(?:\.\d+)?)px/i);
    if (m && parseFloat(m[1]) < 12) tiny.push(`${describeElement(el)} → font-size:${m[1]}px`);
  });
  const cssTinyMatches = (allCss.match(/font-size\s*:\s*(?:[0-9]|1[01])(?:\.\d+)?px/gi) || []).length;
  mk({
    id: "mob-tiny-text",
    title: "Text that is too small to read on a phone",
    status: tiny.length === 0 && cssTinyMatches === 0 ? "pass" : tiny.length + cssTinyMatches <= 3 ? "warn" : "fail",
    weight: 1,
    metric: `${tiny.length + cssTinyMatches} spots`,
    finding:
      tiny.length === 0 && cssTinyMatches === 0
        ? "We found no font sizes under 12 px in the HTML or in the CSS we could read."
        : `Found ${tiny.length} inline style(s) and ${cssTinyMatches} CSS rule(s) setting text smaller than 12 px.`,
    evidence: tiny.slice(0, 6),
    why: "Body text below about 16 px forces people to zoom in on a phone. Most visitors will not bother — they leave instead.",
    fix: [
      "Use at least 16 px for body text and 14 px as an absolute minimum for small print.",
      "Set sizes in rem so they respect the visitor's own browser settings.",
      "Check your footer and legal text — that is where tiny fonts usually hide.",
    ],
  });

  /* ---------- 6. Responsive images ---------- */
  const images = Array.from(doc.querySelectorAll("img"));
  const responsiveImgs = images.filter((i) => i.hasAttribute("srcset") || i.closest("picture"));
  mk({
    id: "mob-responsive-images",
    title: "Serving smaller images to phones",
    status:
      images.length === 0
        ? "info"
        : responsiveImgs.length === 0
          ? "warn"
          : responsiveImgs.length >= images.length * 0.6
            ? "pass"
            : "warn",
    weight: images.length === 0 ? 0 : 1,
    metric: images.length === 0 ? "no images" : `${responsiveImgs.length}/${images.length}`,
    finding:
      images.length === 0
        ? "No <img> tags on this page to check."
        : responsiveImgs.length === 0
          ? `None of the ${images.length} images use srcset or <picture>, so phones download the same large desktop image files.`
          : `${responsiveImgs.length} of ${images.length} images offer multiple sizes via srcset or <picture>.`,
    why: "Sending a 2000-pixel-wide photo to a 390-pixel-wide phone wastes your visitor's mobile data and makes the page feel slow for no visual benefit.",
    fix: [
      'Use srcset: <img src="photo-800.jpg" srcset="photo-400.jpg 400w, photo-800.jpg 800w" sizes="(max-width: 600px) 100vw, 800px" alt="...">.',
      "Most CMS platforms generate these sizes automatically — make sure the feature is not disabled.",
      "Export photos at the size they are actually displayed, not straight from the camera.",
    ],
  });

  /* ---------- 7. Wide tables ---------- */
  const wideTables = Array.from(doc.querySelectorAll("table")).filter((t) => {
    const firstRow = t.querySelector("tr");
    return (firstRow?.children.length || 0) >= 4;
  });
  mk({
    id: "mob-wide-tables",
    title: "Wide data tables on small screens",
    status: wideTables.length === 0 ? "pass" : "warn",
    weight: 1,
    metric: pluralise(wideTables.length, "table"),
    finding:
      wideTables.length === 0
        ? "No tables with four or more columns were found, so nothing obvious will overflow sideways."
        : `${pluralise(wideTables.length, "table")} with four or more columns. Wide tables rarely fit on a phone and usually break the layout.`,
    why: "Tables do not re-flow. On a 390 px screen a 6-column price list either overflows the page or squashes into unreadable slivers.",
    fix: [
      "Wrap tables in a scrollable container: <div style=\"overflow-x:auto\">…</div>.",
      "On small screens, turn each row into a stacked card with labels.",
      "Show fewer, more important columns on mobile.",
    ],
  });

  /* ---------- 8. Tap-to-call (from v1 — high value for small businesses) ---------- */
  const telLinks = doc.querySelectorAll('a[href^="tel:" i]').length;
  const mailLinks = doc.querySelectorAll('a[href^="mailto:" i]').length;
  const bodyText = text(doc.body);
  const looksLikePhone = /(\+?\d[\d\s().-]{7,}\d)/.test(bodyText);
  mk({
    id: "mob-tap-to-call",
    title: "Tap-to-call phone number",
    status: telLinks > 0 ? "pass" : looksLikePhone ? "warn" : "info",
    weight: telLinks > 0 || looksLikePhone ? 1 : 0,
    metric: telLinks > 0 ? `${telLinks} tel:` : looksLikePhone ? "text only" : "none found",
    finding:
      telLinks > 0
        ? `Found ${pluralise(telLinks, "tappable phone link")} (and ${pluralise(mailLinks, "email link")}). A visitor on a phone can call you in one tap.`
        : looksLikePhone
          ? "We found text that looks like a phone number, but it is not wrapped in a tel: link. A mobile visitor has to copy it by hand — and many simply do not bother."
          : "No tappable phone link and no phone-shaped text were found. For many local businesses the phone call is the sale, so this is worth adding if you take calls.",
    why: "On a phone, a tel: link is the difference between a customer calling you in one tap and them leaving to find a number they can actually use.",
    fix:
      telLinks > 0
        ? ["Put the number in the header so it is visible without scrolling."]
        : [
            'Wrap your number in a link: <a href="tel:+441234567890">01234 567890</a>.',
            "Use the full international format in the href so it dials correctly from abroad.",
            "Put a clear “Call now” button near the top of the page on mobile.",
          ],
  });

  /* ---------- 9. Legacy technology phones cannot run ---------- */
  const legacy: string[] = [];
  doc.querySelectorAll("object, embed").forEach((el) => {
    const t = (el.getAttribute("type") || "") + (el.getAttribute("src") || el.getAttribute("data") || "");
    if (/flash|shockwave|\.swf|java/i.test(t)) legacy.push(`<${el.tagName.toLowerCase()}> ${shorten(t, 50)}`);
  });
  doc.querySelectorAll("frameset, frame, marquee, blink").forEach((el) => legacy.push(`<${el.tagName.toLowerCase()}>`));
  if (legacy.length) {
    mk({
      id: "mob-legacy-tech",
      title: "Technology phones cannot run",
      status: "fail",
      weight: 3,
      metric: pluralise(legacy.length, "element"),
      finding: `Found ${pluralise(legacy.length, "element")} using Flash, Java, frames or other formats that no modern mobile browser supports: ${legacy.slice(0, 6).join(", ")}.`,
      evidence: legacy.slice(0, 8),
      why: "Visitors see an empty grey box where that content should be. If it is your menu, gallery or booking form, they cannot use your site at all.",
      fix: [
        "Replace Flash/Java with HTML5: <video> for animation, CSS for effects, normal images for galleries.",
        "Replace framesets with a single page plus CSS layout.",
        "If this came with an old template, it is usually faster to move to a modern theme than to patch it.",
      ],
    });
  }

  return out;
}

export const mobileNotChecked: NotCheckedItem[] = [
  {
    category: "mobile",
    title: "Tap target size and spacing",
    reason:
      "Deciding whether a button is big enough requires measuring it after the page is rendered and styled. We only read the HTML and CSS source. Not implemented.",
  },
  {
    category: "mobile",
    title: "Actual horizontal scrolling / overflow detection",
    reason:
      "We flag fixed widths that commonly cause it, but proving the page scrolls sideways needs a real rendered viewport. Not implemented.",
  },
  {
    category: "mobile",
    title: "Screenshots on real device sizes",
    reason: "Rendering your site in an iframe is blocked by most sites' security headers. Not implemented.",
  },
  {
    category: "mobile",
    title: "Mobile network / throttled load simulation",
    reason: "Requires a controlled test environment, not a browser tab. Not implemented.",
  },
];
