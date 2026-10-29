export type CategoryId = "performance" | "mobile" | "accessibility" | "seo";

/**
 * pass / warn / fail  -> a real check ran and produced a verdict (counts toward score)
 * info                -> we measured something real but there is no pass/fail threshold
 * unknown             -> the check could not be completed (missing data). Never guessed.
 */
export type CheckStatus = "pass" | "warn" | "fail" | "info" | "unknown";

export interface CheckResult {
  id: string;
  category: CategoryId;
  title: string;
  status: CheckStatus;
  /** 0 = not scored (info / contextual) */
  weight: number;
  /** Plain-language description of what was actually found on the page. */
  finding: string;
  /** Why a small business owner should care. */
  why: string;
  /** Practical, concrete steps. */
  fix: string[];
  /** Raw evidence taken from the page (never invented). */
  evidence?: string[];
  /** Short badge value, e.g. "142 KB" or "3 images". */
  metric?: string;
}

export interface NotCheckedItem {
  category: CategoryId;
  title: string;
  reason: string;
}

export interface FetchMeta {
  requestedUrl: string;
  finalUrl: string;
  proxy: string | null;
  httpStatus: number | null;
  contentType: string | null;
  bytes: number;
  elapsedMs: number;
  /** the proxy re-serialised the markup, so byte counts are approximate */
  normalised?: boolean;
  notes: string[];
}

export interface StyleSheetFetch {
  url: string;
  ok: boolean;
  bytes: number;
  text: string;
  error?: string;
}

export interface ExtraFetches {
  cssAttempted: boolean;
  css: StyleSheetFetch[];
  robotsTxt: { attempted: boolean; ok: boolean; status: number | null; text: string };
  sitemap: { attempted: boolean; ok: boolean; status: number | null; url: string };
}

export interface AuditContext {
  url: URL | null;
  html: string;
  doc: Document;
  extras: ExtraFetches;
  fetchMeta: FetchMeta | null;
  source: "url" | "html";
}

export interface CategoryScore {
  score: number | null;
  earned: number;
  possible: number;
  pass: number;
  warn: number;
  fail: number;
  info: number;
  unknown: number;
}

export interface AuditReport {
  source: "url" | "html";
  target: string;
  finishedAt: string;
  fetchMeta: FetchMeta | null;
  extras: ExtraFetches;
  checks: CheckResult[];
  notChecked: NotCheckedItem[];
  categories: Record<CategoryId, CategoryScore>;
  overall: CategoryScore;
  contextNotes: string[];
}

export const CATEGORY_META: Record<
  CategoryId,
  { label: string; short: string; blurb: string; accent: string; soft: string; ring: string }
> = {
  performance: {
    label: "Performance",
    short: "Speed",
    blurb: "How heavy the page is and what might make it feel slow.",
    accent: "#4f46e5",
    soft: "bg-indigo-50 text-indigo-700 border-indigo-200",
    ring: "ring-indigo-200",
  },
  mobile: {
    label: "Mobile friendliness",
    short: "Mobile",
    blurb: "Whether the page is set up to work properly on a phone.",
    accent: "#0d9488",
    soft: "bg-teal-50 text-teal-700 border-teal-200",
    ring: "ring-teal-200",
  },
  accessibility: {
    label: "Accessibility",
    short: "Access",
    blurb: "Whether people using screen readers or keyboards can use the page.",
    accent: "#b45309",
    soft: "bg-amber-50 text-amber-700 border-amber-200",
    ring: "ring-amber-200",
  },
  seo: {
    label: "SEO & discoverability",
    short: "SEO",
    blurb: "Whether search engines can understand and list your page.",
    accent: "#be185d",
    soft: "bg-pink-50 text-pink-700 border-pink-200",
    ring: "ring-pink-200",
  },
};

export const CATEGORY_ORDER: CategoryId[] = ["performance", "mobile", "accessibility", "seo"];
