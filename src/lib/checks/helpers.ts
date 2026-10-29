import type { CheckResult, CheckStatus, CategoryId } from "../types";

export function text(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function shorten(value: string, max = 90): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function kb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes / 1024 >= 100 ? 0 : 1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function pluralise(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : (plural ?? `${singular}s`)}`;
}

export function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.getAttribute("id");
  const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 2);
  let label = `<${tag}`;
  if (id) label += `#${id}`;
  if (cls.length) label += `.${cls.join(".")}`;
  label += ">";
  const src = el.getAttribute("src") || el.getAttribute("href");
  if (src) label += ` ${shorten(src, 60)}`;
  const inner = text(el);
  if (!src && inner) label += ` “${shorten(inner, 40)}”`;
  return label;
}

export function worst(...statuses: CheckStatus[]): CheckStatus {
  const rank: Record<CheckStatus, number> = { pass: 0, info: 1, unknown: 2, warn: 3, fail: 4 };
  return statuses.reduce((a, b) => (rank[b] > rank[a] ? b : a), "pass" as CheckStatus);
}

export function makeCheck(
  category: CategoryId,
  input: Omit<CheckResult, "category">,
): CheckResult {
  return { category, ...input };
}

export function attrLower(el: Element, name: string): string {
  return (el.getAttribute(name) || "").trim().toLowerCase();
}

/** Accessible name approximation for links/buttons from static HTML. */
export function accessibleName(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria && aria.trim()) return aria.trim();
  if (el.getAttribute("aria-labelledby")) return "(aria-labelledby)";
  const own = text(el);
  if (own) return own;
  const img = el.querySelector("img[alt]");
  const alt = img?.getAttribute("alt")?.trim();
  if (alt) return alt;
  const title = el.getAttribute("title");
  if (title && title.trim()) return title.trim();
  const svgTitle = text(el.querySelector("svg > title"));
  if (svgTitle) return svgTitle;
  const value = el.getAttribute("value");
  if (value && value.trim()) return value.trim();
  return "";
}
