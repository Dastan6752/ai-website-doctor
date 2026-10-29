import { useMemo, useState } from "react";
import { CATEGORY_META, CATEGORY_ORDER, type AuditReport, type CategoryId, type CheckStatus } from "../lib/types";
import { cn } from "../utils/cn";
import CheckCard, { STATUS_META } from "./CheckCard";
import ScoreRing, { scoreColor, scoreWord } from "./ScoreRing";
import { reportToMarkdown } from "../lib/exportMarkdown";
import {
  AlertIcon,
  ArrowLeftIcon,
  BoltIcon,
  DownloadIcon,
  EyeIcon,
  InfoIcon,
  LinkIcon,
  PhoneIcon,
  PrintIcon,
  QuestionIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
} from "./Icons";

const CATEGORY_ICON: Record<CategoryId, typeof BoltIcon> = {
  performance: BoltIcon,
  mobile: PhoneIcon,
  accessibility: EyeIcon,
  seo: SearchIcon,
};

type Filter = "all" | "problems" | "passed" | "unknown";

interface Props {
  report: AuditReport;
  onReset: () => void;
  onRerun: () => void;
  busy: boolean;
}

function bytesLabel(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function ReportView({ report, onReset, onRerun, busy }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [showMethod, setShowMethod] = useState(false);

  const counts = report.overall;
  const problemChecks = useMemo(
    () =>
      report.checks
        .filter((c) => c.status === "fail" || c.status === "warn")
        .sort((a, b) => {
          const sev = (s: CheckStatus) => (s === "fail" ? 0 : 1);
          return sev(a.status) - sev(b.status) || b.weight - a.weight;
        }),
    [report.checks],
  );

  const matches = (status: CheckStatus) => {
    if (filter === "all") return true;
    if (filter === "problems") return status === "fail" || status === "warn";
    if (filter === "passed") return status === "pass";
    return status === "unknown" || status === "info";
  };

  const fileStem = () => {
    const host = report.fetchMeta?.finalUrl?.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-") || "report";
    return `website-doctor-${host}`.slice(0, 70);
  };

  const downloadBlob = (contents: string, mime: string, filename: string) => {
    const blob = new Blob([contents], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadJson = () =>
    downloadBlob(JSON.stringify(report, null, 2), "application/json", `${fileStem()}.json`);

  const downloadMarkdown = () =>
    downloadBlob(reportToMarkdown(report), "text/markdown;charset=utf-8", `${fileStem()}.md`);

  const finished = new Date(report.finishedAt);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6">
      {/* Top bar */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
        >
          <ArrowLeftIcon className="h-4 w-4" /> New scan
        </button>
        {report.source === "url" && (
          <button
            onClick={onRerun}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
          >
            <RefreshIcon className={cn("h-4 w-4", busy && "animate-spin-slow")} /> Re-run
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={downloadMarkdown}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
          >
            <DownloadIcon className="h-4 w-4" /> <span className="hidden sm:inline">Download</span> report
          </button>
          <button
            onClick={downloadJson}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
          >
            JSON
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
          >
            <PrintIcon className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      {/* Summary card */}
      <section className="animate-pop mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
        <div className="flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-center">
          <div className="flex shrink-0 justify-center">
            <ScoreRing score={counts.score} size={148} label="of 100" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <LinkIcon className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 break-all text-sm font-medium text-slate-700">
                {report.fetchMeta?.finalUrl || report.target}
              </span>
            </div>
            <h2
              className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ color: scoreColor(counts.score) }}
            >
              {scoreWord(counts.score)}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {counts.fail + counts.warn === 0 ? (
                <>Every automated check we could run passed. Well done.</>
              ) : (
                <>
                  We found <strong className="text-rose-600">{counts.fail} clear problem{counts.fail === 1 ? "" : "s"}</strong>{" "}
                  and <strong className="text-amber-600">{counts.warn} thing{counts.warn === 1 ? "" : "s"} to improve</strong>{" "}
                  on this page. {counts.pass} check{counts.pass === 1 ? "" : "s"} passed.
                </>
              )}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  ["fail", counts.fail],
                  ["warn", counts.warn],
                  ["pass", counts.pass],
                  ["unknown", counts.unknown],
                  ["info", counts.info],
                ] as [CheckStatus, number][]
              ).map(([status, n]) => (
                <span
                  key={status}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                    STATUS_META[status].chip,
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[status].dot)} />
                  {n} {STATUS_META[status].label.toLowerCase()}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Facts strip */}
        <dl className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 text-center sm:grid-cols-4">
          {[
            { k: "HTML size", v: report.fetchMeta ? bytesLabel(report.fetchMeta.bytes) : "—" },
            {
              k: "HTTP status",
              v: report.fetchMeta?.httpStatus ? String(report.fetchMeta.httpStatus) : report.source === "html" ? "n/a" : "unknown",
            },
            { k: "Checks scored", v: `${counts.pass + counts.warn + counts.fail}` },
            { k: "Scanned", v: finished.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
          ].map((item) => (
            <div key={item.k} className="bg-white px-3 py-3">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{item.k}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800">{item.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Context notes */}
      {report.contextNotes.length > 0 && (
        <div className="animate-fade-up mt-4 space-y-2">
          {report.contextNotes.map((note, i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-sm leading-relaxed text-amber-900">{note}</p>
            </div>
          ))}
        </div>
      )}

      {/* Methodology */}
      <div className="animate-fade-up mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <button
          onClick={() => setShowMethod((v) => !v)}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ShieldIcon className="h-4 w-4 text-indigo-500" />
          How this score was calculated (and what it does not include)
          <span className="ml-auto text-xs font-normal text-slate-400">{showMethod ? "Hide" : "Show"}</span>
        </button>
        <div className={cn("accordion-panel", showMethod && "open")}>
          <div className="accordion-inner">
            <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 px-4 py-4 text-sm leading-relaxed text-slate-600">
              <p>
                The score is a weighted average of the <strong>{counts.pass + counts.warn + counts.fail} checks</strong>{" "}
                that could actually be completed on this page. A pass earns full marks, a “needs work” earns half, a
                problem earns none. Checks marked <em>for information</em> or <em>could not check</em> are excluded
                entirely — they never silently help or hurt your score.
              </p>
              <p>
                It is <strong>not</strong> a Google score, a PageSpeed score or an official accessibility
                certification. It summarises this tool's own checks only. Two different tools will always give two
                different numbers.
              </p>
              <ul className="space-y-1.5">
                <li>
                  <strong>Source:</strong>{" "}
                  {report.source === "url"
                    ? `HTML downloaded via the public proxy ${report.fetchMeta?.proxy ?? "—"}`
                    : "HTML pasted in by you (no network requests made)"}
                </li>
                <li>
                  <strong>Content type:</strong> {report.fetchMeta?.contentType || "unknown"}
                </li>
                <li>
                  <strong>Stylesheets downloaded:</strong>{" "}
                  {report.extras.cssAttempted
                    ? `${report.extras.css.filter((c) => c.ok).length} of ${report.extras.css.length} attempted`
                    : "none attempted"}
                </li>
                <li>
                  <strong>robots.txt:</strong>{" "}
                  {report.extras.robotsTxt.attempted
                    ? report.extras.robotsTxt.ok
                      ? "downloaded and read"
                      : "requested but not readable"
                    : "not requested"}
                </li>
                <li>
                  <strong>Finished:</strong> {finished.toLocaleString()}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Category score cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CATEGORY_ORDER.map((id, i) => {
          const meta = CATEGORY_META[id];
          const cat = report.categories[id];
          const Icon = CATEGORY_ICON[id];
          return (
            <a
              key={id}
              href={`#cat-${id}`}
              className="animate-fade-up card-hover flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <ScoreRing score={cat.score} size={78} stroke={7} delay={200 + i * 100} />
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Icon className="h-3.5 w-3.5" style={{ color: meta.accent }} />
                {meta.short}
              </span>
              <span className="text-[10px] text-slate-400">
                {cat.fail + cat.warn === 0 ? "no issues found" : `${cat.fail + cat.warn} to look at`}
              </span>
            </a>
          );
        })}
      </div>

      {/* Priority fixes */}
      {problemChecks.length > 0 && (
        <section className="animate-fade-up mt-8 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-lg sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <AlertIcon className="h-5 w-5 text-amber-400" />
            Fix these first
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Ordered by how much difference they make. Tap any item further down for the full explanation.
          </p>
          <ol className="mt-4 space-y-2.5">
            {problemChecks.slice(0, 5).map((c, i) => (
              <li key={c.id} className="flex gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {c.title}
                    <span
                      className={cn(
                        "ml-2 rounded px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase",
                        c.status === "fail" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300",
                      )}
                    >
                      {c.status === "fail" ? "problem" : "improve"}
                    </span>
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{c.fix[0]}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Filter */}
      <div className="no-print sticky top-[60px] z-20 -mx-4 mt-8 border-y border-slate-200 bg-[#f6f7fb]/90 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="thin-scroll flex items-center gap-2 overflow-x-auto">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Show</span>
          {(
            [
              ["all", `All ${report.checks.length}`],
              ["problems", `Problems ${counts.fail + counts.warn}`],
              ["passed", `Passed ${counts.pass}`],
              ["unknown", `Not measurable ${counts.unknown + counts.info}`],
            ] as [Filter, string][]
          ).map(([key, lab]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                filter === key
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400",
              )}
            >
              {lab}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="mt-6 space-y-10">
        {CATEGORY_ORDER.map((id) => {
          const meta = CATEGORY_META[id];
          const cat = report.categories[id];
          const Icon = CATEGORY_ICON[id];
          const checks = report.checks.filter((c) => c.category === id && matches(c.status));
          const notChecked = report.notChecked.filter((n) => n.category === id);

          return (
            <section key={id} id={`cat-${id}`} className="scroll-mt-28">
              <header className="flex flex-wrap items-center gap-3">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
                  style={{ backgroundColor: meta.accent }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">{meta.label}</h2>
                  <p className="text-[13px] text-slate-500">{meta.blurb}</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold tabular-nums" style={{ color: scoreColor(cat.score) }}>
                    {cat.score === null ? "—" : cat.score}
                    <span className="text-xs font-medium text-slate-400">/100</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    {cat.pass + cat.warn + cat.fail} checks scored
                  </div>
                </div>
              </header>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="animate-bar h-full rounded-full"
                  style={{ width: `${cat.score ?? 0}%`, backgroundColor: scoreColor(cat.score) }}
                />
              </div>

              <div className="mt-4 space-y-3">
                {checks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-5 text-center text-sm text-slate-500">
                    No checks in this category match the current filter.
                  </p>
                ) : (
                  checks.map((c, i) => <CheckCard key={c.id} check={c} index={i} />)
                )}
              </div>

              {notChecked.length > 0 && (
                <div className="mt-4 rounded-xl border border-dashed border-violet-300 bg-violet-50/60 p-4">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-violet-800">
                    <QuestionIcon className="h-4 w-4" />
                    Not implemented in this tool
                  </h3>
                  <p className="mt-1.5 text-[13px] text-violet-900/70">
                    These are real issues worth investigating, but this app does not measure them — so no result is
                    shown and nothing here affects your score.
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {notChecked.map((n) => (
                      <li key={n.title} className="text-[13px] leading-relaxed">
                        <span className="font-semibold text-violet-900">{n.title}</span>
                        <span className="text-violet-900/70"> — {n.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Footer disclaimer */}
      <div className="mt-12 flex gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
        <div className="text-[13px] leading-relaxed text-slate-600">
          <p className="font-semibold text-slate-800">Please read this before acting on the report</p>
          <p className="mt-1.5">
            This report covers <strong>one page</strong> — the exact address above — as its HTML was delivered at{" "}
            {finished.toLocaleTimeString()}. Automated testing typically catches only a fraction of real
            accessibility and usability problems; nothing here replaces testing with real people and real devices.
            For trustworthy speed figures run{" "}
            <a
              className="font-medium text-indigo-600 underline underline-offset-2"
              href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(report.fetchMeta?.finalUrl || report.target)}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              PageSpeed Insights
            </a>
            , and for indexing questions use Google Search Console.
          </p>
        </div>
      </div>
    </div>
  );
}
