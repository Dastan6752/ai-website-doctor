import { JSDOM } from "jsdom";
const { window } = new JSDOM("<!doctype html><html></html>");
(globalThis as any).DOMParser = window.DOMParser;
(globalThis as any).HTMLElement = window.HTMLElement;
(globalThis as any).Element = window.Element;
(globalThis as any).Document = window.Document;

const { analyzeHtml } = await import("../src/lib/analyze.ts");
const { reportToMarkdown } = await import("../src/lib/exportMarkdown.ts");

const html = `<!doctype html><html lang="en"><head><title>Markdown Export Title Here</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><h1>Hello</h1><p>${"word ".repeat(80)}</p></body></html>`;
const report = analyzeHtml(html, "https://md.test");
const md = reportToMarkdown(report);
let fail = 0;
function ok(n: string, c: boolean) {
  console.log(c ? " PASS" : " FAIL", n);
  if (!c) fail++;
}
ok("has title heading", md.includes("# AI Website Doctor report"));
ok("quotes page title", md.includes("Markdown Export Title Here"));
ok("has not implemented section", /Not implemented/i.test(md));
ok("has performance section", /## Performance/i.test(md));
ok("has mobile section", /## Mobile/i.test(md));
ok("has accessibility section", /## Accessibility/i.test(md));
ok("has seo section", /## SEO/i.test(md));
ok("mentions pasted source", /pasted/i.test(md));
ok("long enough", md.length > 1500);
console.log("chars", md.length);
process.exit(fail ? 1 : 0);
