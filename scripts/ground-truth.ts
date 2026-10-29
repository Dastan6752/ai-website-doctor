import { JSDOM } from "jsdom";
const { window } = new JSDOM("<!doctype html><html></html>");
(globalThis as any).DOMParser = window.DOMParser;
(globalThis as any).HTMLElement = window.HTMLElement;
(globalThis as any).Element = window.Element;
(globalThis as any).Document = window.Document;

const { analyzeHtml } = await import("../src/lib/analyze.ts");

const sites = ["https://wordpress.org", "https://www.bbc.co.uk"];
for (const url of sites) {
  const res = await fetch(url, { redirect: "follow" });
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const title = (doc.querySelector("title")?.textContent || "").replace(/\s+/g, " ").trim();
  const desc = (doc.querySelector('meta[name="description" i]')?.getAttribute("content") || "").trim();
  const lang = doc.documentElement.getAttribute("lang") || "";
  const vp = doc.querySelector('meta[name="viewport" i]')?.getAttribute("content") || "";
  const h1s = Array.from(doc.querySelectorAll("h1")).map((h) => (h.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const imgs = doc.querySelectorAll("img").length;
  const missingAlt = Array.from(doc.querySelectorAll("img")).filter((i) => !i.hasAttribute("alt")).length;
  const report = analyzeHtml(html, url);
  const c = (id: string) => report.checks.find((x) => x.id === id)!;
  console.log("\n====", url, "HTTP", res.status, html.length, "bytes");
  console.log(" REAL title:", title.slice(0, 80));
  console.log(" FIND title:", c("seo-title").status, c("seo-title").finding.replace(/\s+/g, " ").slice(0, 120));
  console.log(" REAL desc length:", desc.length, desc ? "present" : "missing");
  console.log(" FIND desc:", c("seo-description").status, c("seo-description").metric);
  console.log(" REAL lang:", lang || "(none)");
  console.log(" FIND lang:", c("a11y-lang").status, c("a11y-lang").metric);
  console.log(" REAL viewport:", vp || "(none)");
  console.log(" FIND viewport:", c("mob-viewport").status, c("mob-viewport").metric);
  console.log(" REAL h1 count:", h1s.length, h1s[0]?.slice(0, 60));
  console.log(" FIND h1:", c("seo-h1").status, c("seo-h1").metric);
  console.log(" REAL imgs", imgs, "missingAlt", missingAlt);
  console.log(" FIND alt:", c("a11y-img-alt").status, c("a11y-img-alt").metric);
  const titleOk = c("seo-title").finding.includes(title.slice(0, 30));
  const descOk = desc ? c("seo-description").status !== "fail" || desc.length < 50 : c("seo-description").status === "fail";
  const langOk = lang.length >= 2 ? c("a11y-lang").status === "pass" : c("a11y-lang").status === "fail";
  const vpOk = vp ? c("mob-viewport").status !== "fail" || !/no viewport/i.test(c("mob-viewport").finding) : c("mob-viewport").status === "fail";
  const h1Ok = h1s.length === 0 ? c("seo-h1").status === "fail" : c("seo-h1").metric?.includes(String(h1s.length));
  const altOk = missingAlt === 0 ? c("a11y-img-alt").status === "pass" || c("a11y-img-alt").status === "info" : /missing/.test(c("a11y-img-alt").metric || "");
  console.log(" MATCH title", titleOk, "desc", descOk, "lang", langOk, "vp", vpOk, "h1", h1Ok, "alt", altOk);
  console.log(" SCORE", report.overall.score, "fail", report.overall.fail, "warn", report.overall.warn, "pass", report.overall.pass);
  if (![titleOk, descOk, langOk, vpOk, h1Ok, altOk].every(Boolean)) {
    console.log(" MISMATCH");
    process.exitCode = 1;
  }
}
