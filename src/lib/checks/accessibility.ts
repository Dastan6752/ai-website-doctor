import type { AuditContext, CheckResult, NotCheckedItem } from "../types";
import { accessibleName, describeElement, makeCheck, pluralise, shorten, text } from "./helpers";

const VAGUE_LINKS = [
  "click here",
  "here",
  "read more",
  "more",
  "learn more",
  "this link",
  "link",
  "continue",
  "details",
  "download",
];

export function accessibilityChecks(ctx: AuditContext): CheckResult[] {
  const { doc } = ctx;
  const out: CheckResult[] = [];
  const mk = (c: Omit<CheckResult, "category">) => out.push(makeCheck("accessibility", c));

  /* ---------- 1. Language ---------- */
  const lang = doc.documentElement.getAttribute("lang");
  mk({
    id: "a11y-lang",
    title: "Page language is declared",
    status: lang && lang.trim().length >= 2 ? "pass" : "fail",
    weight: 2,
    metric: lang ? lang : "missing",
    finding:
      lang && lang.trim().length >= 2
        ? `The page declares its language as "${lang}".`
        : 'The <html> tag has no lang attribute, so screen readers do not know which language to pronounce. They will guess — often with the wrong accent, which makes content unintelligible.',
    why: "One attribute decides whether a blind visitor hears your page in English or has it read out with a French pronunciation engine. It also helps browsers offer the right translation.",
    fix: [
      'Set the language on the opening html tag: <html lang="en"> (or "en-GB", "es", "de"…).',
      "In WordPress this comes from Settings → General → Site Language.",
      'If part of the page is in another language, mark that section: <span lang="fr">…</span>.',
    ],
  });

  /* ---------- 2. Image alt text ---------- */
  const images = Array.from(doc.querySelectorAll("img"));
  const missingAlt = images.filter((img) => !img.hasAttribute("alt"));
  const emptyAlt = images.filter((img) => img.hasAttribute("alt") && !(img.getAttribute("alt") || "").trim());
  mk({
    id: "a11y-img-alt",
    title: "Images have alternative text",
    status: images.length === 0 ? "info" : missingAlt.length === 0 ? "pass" : missingAlt.length <= 2 ? "warn" : "fail",
    weight: images.length === 0 ? 0 : 3,
    metric: images.length === 0 ? "no images" : `${missingAlt.length}/${images.length} missing`,
    finding:
      images.length === 0
        ? "This page contains no <img> tags."
        : missingAlt.length === 0
          ? `All ${images.length} images have an alt attribute (${emptyAlt.length} are marked decorative with alt="", which is correct for purely visual images).`
          : `${missingAlt.length} of ${images.length} images have no alt attribute at all. A screen reader will announce the file name instead, e.g. “IMG underscore 4821 dot jpeg”.`,
    evidence: missingAlt.slice(0, 8).map((img) => shorten(img.getAttribute("src") || describeElement(img), 90)),
    why: "Alt text is what blind visitors hear, what is shown when an image fails to load, and what Google uses to understand your pictures. Missing alt text on a product photo can lose you a sale.",
    fix: [
      'Describe what the image shows, in a short sentence: alt="Baker holding a tray of sourdough loaves".',
      'If an image is purely decorative, use alt="" so screen readers skip it.',
      'Never write alt="image" or stuff it with keywords.',
      "In most CMS media libraries there is an “Alt text” field next to every upload.",
    ],
  });

  /* ---------- 3. Form labels ---------- */
  const fields = Array.from(doc.querySelectorAll("input, select, textarea")).filter((el) => {
    const type = (el.getAttribute("type") || "").toLowerCase();
    return !["hidden", "submit", "button", "reset", "image"].includes(type);
  });
  const unlabelled = fields.filter((el) => {
    if (el.getAttribute("aria-label")?.trim()) return false;
    if (el.getAttribute("aria-labelledby")?.trim()) return false;
    if (el.getAttribute("title")?.trim()) return false;
    if (el.closest("label")) return false;
    const id = el.getAttribute("id");
    if (id) {
      const esc = id.replace(/["\\]/g, "\\$&");
      if (doc.querySelector(`label[for="${esc}"]`)) return false;
    }
    return true;
  });
  mk({
    id: "a11y-form-labels",
    title: "Form fields have proper labels",
    status: fields.length === 0 ? "info" : unlabelled.length === 0 ? "pass" : "fail",
    weight: fields.length === 0 ? 0 : 3,
    metric: fields.length === 0 ? "no form fields" : `${unlabelled.length}/${fields.length} unlabelled`,
    finding:
      fields.length === 0
        ? "No form fields (inputs, selects or textareas) were found on this page."
        : unlabelled.length === 0
          ? `All ${fields.length} form fields have a label a screen reader can use.`
          : `${unlabelled.length} of ${fields.length} form fields have no label, aria-label or title. Someone using a screen reader hears “edit text, blank” and has no idea what to type.`,
    evidence: unlabelled.slice(0, 8).map((el) => describeElement(el)),
    why: "Your contact form is where money is made. If a field is unlabelled, people using assistive technology abandon it — and placeholder text alone disappears as soon as they start typing.",
    fix: [
      'Pair every field with a label: <label for="email">Email address</label><input id="email" type="email">.',
      "Placeholder text is not a label — keep both.",
      'If the design has no room for visible text, use aria-label="Email address" on the input.',
      "Check your form plugin's settings — many have a “show labels” option that is off by default.",
    ],
  });

  /* ---------- 4. Links with no readable text ---------- */
  const links = Array.from(doc.querySelectorAll("a[href]"));
  const emptyLinks = links.filter((a) => accessibleName(a).length === 0);
  mk({
    id: "a11y-empty-links",
    title: "Links that announce nothing",
    status: links.length === 0 ? "info" : emptyLinks.length === 0 ? "pass" : emptyLinks.length <= 2 ? "warn" : "fail",
    weight: links.length === 0 ? 0 : 2,
    metric: links.length === 0 ? "no links" : `${emptyLinks.length} empty`,
    finding:
      links.length === 0
        ? "No links were found on this page."
        : emptyLinks.length === 0
          ? `All ${links.length} links have readable text or a label.`
          : `${emptyLinks.length} of ${links.length} links contain no text and no label — typically icon links such as social media buttons.`,
    evidence: emptyLinks.slice(0, 8).map((a) => describeElement(a)),
    why: "A screen reader reads an empty link as just “link”. Visitors tabbing through your header hear “link, link, link” and give up.",
    fix: [
      'Add a hidden label to icon links: <a href="..." aria-label="Visit our Facebook page">.',
      'Give icons inside links a <title> (SVG) or alt text (img).',
      "Never rely on an icon font character alone to convey meaning.",
    ],
  });

  /* ---------- 5. Vague link text ---------- */
  const vague = links.filter((a) => {
    const name = accessibleName(a).toLowerCase().replace(/[^a-z ]/g, "").trim();
    return name.length > 0 && VAGUE_LINKS.includes(name);
  });
  mk({
    id: "a11y-vague-links",
    title: "Link text that makes sense out of context",
    status: links.length === 0 ? "info" : vague.length === 0 ? "pass" : vague.length <= 3 ? "warn" : "fail",
    weight: links.length === 0 ? 0 : 1,
    metric: links.length === 0 ? "no links" : `${vague.length} vague`,
    finding:
      links.length === 0
        ? "No links to assess."
        : vague.length === 0
          ? "No “click here” style links were found — your link text describes its destination."
          : `${pluralise(vague.length, "link")} use generic wording such as “click here” or “read more”.`,
    evidence: Array.from(new Set(vague.map((a) => `“${accessibleName(a)}” → ${shorten(a.getAttribute("href") || "", 50)}`))).slice(0, 8),
    why: "Screen reader users often jump through a list of all links on a page. A list of twelve items that all say “read more” is useless. Descriptive links also help your SEO.",
    fix: [
      'Replace “Read more” with the destination: “Read more about our garden maintenance plans”.',
      "If the design needs short text, keep it short visually but add an aria-label with the full phrase.",
    ],
  });

  /* ---------- 6. Buttons without names ---------- */
  const buttons = Array.from(doc.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]'));
  const namelessButtons = buttons.filter((b) => accessibleName(b).length === 0);
  mk({
    id: "a11y-button-names",
    title: "Buttons say what they do",
    status: buttons.length === 0 ? "info" : namelessButtons.length === 0 ? "pass" : "fail",
    weight: buttons.length === 0 ? 0 : 2,
    metric: buttons.length === 0 ? "no buttons" : `${namelessButtons.length}/${buttons.length} unnamed`,
    finding:
      buttons.length === 0
        ? "No button elements were found in the HTML (your buttons may be links styled as buttons)."
        : namelessButtons.length === 0
          ? `All ${buttons.length} buttons have a readable name.`
          : `${namelessButtons.length} of ${buttons.length} buttons have no text or label — usually hamburger menus, search icons and close buttons.`,
    evidence: namelessButtons.slice(0, 8).map((b) => describeElement(b)),
    why: "The mobile menu button is often the single most important control on a phone. If it is unnamed, screen reader users cannot open your navigation at all.",
    fix: [
      '<button aria-label="Open main menu">☰</button>',
      "Add visually-hidden text inside the button if you prefer real text to aria-label.",
      "Test it: unplug your mouse and tab through the page.",
    ],
  });

  /* ---------- 7. Heading structure ---------- */
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const levels = headings.map((h) => parseInt(h.tagName.substring(1), 10));
  const skips: string[] = [];
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      skips.push(`h${levels[i - 1]} “${shorten(text(headings[i - 1]), 40)}” → h${levels[i]} “${shorten(text(headings[i]), 40)}”`);
    }
  }
  const emptyHeadings = headings.filter((h) => text(h).length === 0).length;
  mk({
    id: "a11y-heading-order",
    title: "Headings follow a logical order",
    status: headings.length === 0 ? "fail" : skips.length === 0 && emptyHeadings === 0 ? "pass" : skips.length > 3 ? "fail" : "warn",
    weight: 1,
    metric: headings.length === 0 ? "none" : `${headings.length} headings`,
    finding:
      headings.length === 0
        ? "This page has no headings at all. Screen reader users navigate by headings, so the page is one undifferentiated block of text to them."
        : skips.length === 0 && emptyHeadings === 0
          ? `${headings.length} headings found and the levels step down in order — exactly how it should be.`
          : `${headings.length} headings found. ${skips.length ? `${pluralise(skips.length, "place")} skip a level` : ""}${skips.length && emptyHeadings ? " and " : ""}${emptyHeadings ? `${pluralise(emptyHeadings, "heading")} are empty` : ""}.`,
    evidence: skips.slice(0, 6),
    why: "Headings are the table of contents of your page. Jumping from a heading level 1 straight to a level 4 is like a book going from Chapter 1 to Section 1.3.2 — confusing for people and for Google.",
    fix: [
      "Use one h1 for the page title, h2 for main sections, h3 for sub-sections, and so on.",
      "Never pick a heading level because of how big the text looks — change the size with CSS instead.",
      "Remove empty headings that page builders sometimes leave behind.",
    ],
  });

  /* ---------- 8. iframes ---------- */
  const iframes = Array.from(doc.querySelectorAll("iframe"));
  const untitledIframes = iframes.filter((f) => !(f.getAttribute("title") || "").trim() && !(f.getAttribute("aria-label") || "").trim());
  mk({
    id: "a11y-iframe-title",
    title: "Embedded content (maps, videos) is labelled",
    status: iframes.length === 0 ? "info" : untitledIframes.length === 0 ? "pass" : "warn",
    weight: iframes.length === 0 ? 0 : 1,
    metric: iframes.length === 0 ? "no embeds" : `${untitledIframes.length}/${iframes.length} untitled`,
    finding:
      iframes.length === 0
        ? "No iframes (embedded maps, videos or forms) were found."
        : untitledIframes.length === 0
          ? `All ${iframes.length} embedded frames have a title.`
          : `${untitledIframes.length} of ${iframes.length} embedded frames have no title attribute, so they are announced only as “frame”.`,
    evidence: untitledIframes.slice(0, 5).map((f) => shorten(f.getAttribute("src") || describeElement(f), 80)),
    why: "Screen reader users get a list of frames on the page. “Frame” tells them nothing; “Google map of our shop location” tells them everything.",
    fix: ['Add a title: <iframe title="Map showing our shop on Market Street" src="..."></iframe>.'],
  });

  /* ---------- 9. Positive tabindex ---------- */
  const badTabindex = Array.from(doc.querySelectorAll("[tabindex]")).filter((el) => {
    const v = parseInt(el.getAttribute("tabindex") || "", 10);
    return !Number.isNaN(v) && v > 0;
  });
  mk({
    id: "a11y-tabindex",
    title: "Keyboard tab order is not hijacked",
    status: badTabindex.length === 0 ? "pass" : "warn",
    weight: 1,
    metric: `${badTabindex.length} found`,
    finding:
      badTabindex.length === 0
        ? "No elements force themselves to the front of the keyboard tab order."
        : `${pluralise(badTabindex.length, "element")} use a positive tabindex, which pushes them ahead of everything else when a visitor presses Tab.`,
    evidence: badTabindex.slice(0, 6).map((el) => describeElement(el)),
    why: "People who cannot use a mouse move through a page with the Tab key. A positive tabindex scrambles that order and makes the page feel random.",
    fix: [
      'Use tabindex="0" (or no tabindex at all) and let the natural order of the HTML do the work.',
      'tabindex="-1" is fine for elements you focus programmatically, e.g. a modal dialog.',
    ],
  });

  /* ---------- 10. Landmarks & skip link ---------- */
  const hasMain = !!doc.querySelector('main, [role="main"]');
  const hasNav = !!doc.querySelector('nav, [role="navigation"]');
  const skipLink = Array.from(doc.querySelectorAll("a[href^='#']"))
    .slice(0, 5)
    .find((a) => /skip|jump/i.test(text(a) + " " + (a.getAttribute("aria-label") || "")));
  const landmarkScore = (hasMain ? 1 : 0) + (hasNav ? 1 : 0) + (skipLink ? 1 : 0);
  mk({
    id: "a11y-landmarks",
    title: "Page regions and a “skip to content” link",
    status: landmarkScore === 3 ? "pass" : landmarkScore === 0 ? "fail" : "warn",
    weight: 1,
    metric: `${landmarkScore}/3`,
    finding: `${hasMain ? "✔ a <main> region" : "✘ no <main> region"}, ${hasNav ? "✔ a <nav> region" : "✘ no <nav> region"}, ${skipLink ? "✔ a skip link" : "✘ no skip link"} was found.`,
    why: "Landmarks let screen reader users jump straight to your content instead of listening to the whole menu on every page. A skip link does the same for keyboard users.",
    fix: [
      "Wrap your main content in <main> … </main> (once per page).",
      "Wrap your menu in <nav> … </nav>.",
      'Add a skip link as the very first element in <body>: <a class="skip" href="#main">Skip to content</a>, visible when focused.',
    ],
  });

  /* ---------- 11. Deprecated presentational tags (from v1) ---------- */
  const deprecated: string[] = [];
  (["font", "center", "marquee", "blink", "big", "strike"] as const).forEach((tag) => {
    const n = doc.querySelectorAll(tag).length;
    if (n) deprecated.push(`<${tag}> × ${n}`);
  });
  if (deprecated.length) {
    mk({
      id: "a11y-deprecated",
      title: "Outdated HTML tags",
      status: "warn",
      weight: 1,
      metric: pluralise(deprecated.length, "tag type", "tag types"),
      finding: `This page still uses tags removed from the HTML standard: ${deprecated.join(", ")}.`,
      evidence: deprecated,
      why: "Browsers still render most of them, but they resist responsive styling, break text resizing for low-vision users, and are a strong sign the page predates mobile phones.",
      fix: [
        "Replace <font> and <center> with CSS (color, font-family, text-align: center).",
        "Remove <marquee> and <blink> entirely — moving text is an accessibility hazard.",
        "This is usually a sign the template itself needs updating.",
      ],
    });
  }

  /* ---------- 12. Auto-playing media (from v1) ---------- */
  const autoplay = Array.from(doc.querySelectorAll("video[autoplay], audio[autoplay]"));
  if (autoplay.length) {
    const unmuted = autoplay.filter((el) => !el.hasAttribute("muted"));
    mk({
      id: "a11y-autoplay",
      title: "Auto-playing media",
      status: unmuted.length ? "warn" : "pass",
      weight: 1,
      metric: unmuted.length ? `${unmuted.length} unmuted` : "muted",
      finding: unmuted.length
        ? `${pluralise(unmuted.length, "media element")} starts playing with sound without the visitor asking.`
        : "Auto-playing media is muted, which is the acceptable pattern.",
      why: "Unmuted autoplay is startling in an office or a quiet room, talks over a screen reader, and most mobile browsers block it anyway — so the visitor may just see a frozen black box.",
      fix: unmuted.length
        ? [
            "Add the muted attribute, or better, require a click to play.",
            "Always include the controls attribute so people can stop it.",
            "Provide captions for any spoken content.",
          ]
        : ["Provide captions for spoken content so the video works with the sound off."],
    });
  }

  return out;
}

export const accessibilityNotChecked: NotCheckedItem[] = [
  {
    category: "accessibility",
    title: "Colour contrast between text and background",
    reason:
      "Real contrast depends on the computed colours after all CSS, images and overlays are applied. Reading the source is not enough, so we do not report a contrast figure. Not implemented.",
  },
  {
    category: "accessibility",
    title: "Visible keyboard focus and focus order",
    reason: "Needs a rendered page that can actually be tabbed through. Not implemented.",
  },
  {
    category: "accessibility",
    title: "ARIA correctness in context, and live regions",
    reason:
      "Whether an ARIA role is appropriate depends on the interaction it describes — this needs human judgement. Not implemented.",
  },
  {
    category: "accessibility",
    title: "Video captions, audio transcripts, motion sensitivity",
    reason: "Requires inspecting the media files themselves and how they behave. Not implemented.",
  },
  {
    category: "accessibility",
    title: "Content rendered by JavaScript after load",
    reason:
      "We read the HTML as it is delivered. Anything your JavaScript adds afterwards (menus, modals, cookie banners) is not in this report.",
  },
];
