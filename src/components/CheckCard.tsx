import { useState } from "react";
import type { CheckResult, CheckStatus } from "../lib/types";
import { cn } from "../utils/cn";
import { AlertIcon, CheckIcon, ChevronIcon, InfoIcon, QuestionIcon, WrenchIcon, XIcon } from "./Icons";

export const STATUS_META: Record<
  CheckStatus,
  { label: string; chip: string; dot: string; icon: typeof CheckIcon; border: string }
> = {
  pass: {
    label: "Passed",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    icon: CheckIcon,
    border: "border-l-emerald-400",
  },
  warn: {
    label: "Needs work",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
    icon: AlertIcon,
    border: "border-l-amber-400",
  },
  fail: {
    label: "Problem found",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
    icon: XIcon,
    border: "border-l-rose-400",
  },
  info: {
    label: "For information",
    chip: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
    icon: InfoIcon,
    border: "border-l-slate-300",
  },
  unknown: {
    label: "Could not check",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-400",
    icon: QuestionIcon,
    border: "border-l-violet-300",
  },
};

interface Props {
  check: CheckResult;
  index: number;
  defaultOpen?: boolean;
}

export default function CheckCard({ check, index, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = STATUS_META[check.status];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "print-break animate-fade-up overflow-hidden rounded-xl border border-l-4 border-slate-200 bg-white shadow-sm card-hover",
        meta.border,
      )}
      style={{ animationDelay: `${Math.min(index * 45, 400)}ms` }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:p-5"
      >
        <span
          className={cn(
            "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
            meta.chip,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] font-semibold text-slate-900">{check.title}</span>
            {check.metric && (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                {check.metric}
              </span>
            )}
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap sm:hidden",
                meta.chip,
              )}
            >
              {meta.label}
            </span>
          </span>
          <span
            className={cn(
              "mt-1.5 block whitespace-pre-line text-sm leading-relaxed text-slate-600",
              !open && "line-clamp-2",
            )}
          >
            {check.finding}
          </span>
        </span>

        <span className="ml-1 flex shrink-0 flex-col items-end gap-2">
          <span
            className={cn(
              "hidden rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap sm:inline-block",
              meta.chip,
            )}
          >
            {meta.label}
          </span>
          <ChevronIcon
            className={cn("h-4 w-4 text-slate-400 transition-transform duration-300", open && "rotate-180")}
          />
        </span>
      </button>

      <div className={cn("accordion-panel", open && "open")}>
        <div className="accordion-inner">
          <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Why this matters</h4>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{check.why}</p>
            </div>

            {check.evidence && check.evidence.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  What we found on your page
                </h4>
                <ul className="thin-scroll mt-1.5 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2.5">
                  {check.evidence.map((e, i) => (
                    <li key={i} className="break-all font-mono text-[11px] leading-relaxed text-slate-600">
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                <WrenchIcon className="h-3.5 w-3.5" />
                How to fix it
              </h4>
              <ul className="mt-2 space-y-2">
                {check.fix.map((f, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                    <span className="break-words">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[11px] italic text-slate-400">
              Check ID: <span className="font-mono">{check.id}</span> ·{" "}
              {check.weight > 0
                ? `counts toward the category score (weight ${check.weight})`
                : "not counted in the score"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
