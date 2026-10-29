import { useState } from "react";
import { cn } from "../utils/cn";
import {
  AlertIcon,
  BoltIcon,
  CheckIcon,
  CodeIcon,
  EyeIcon,
  GlobeIcon,
  InfoIcon,
  PhoneIcon,
  QuestionIcon,
  SearchIcon,
  SparkIcon,
} from "./Icons";

interface Props {
  onAnalyzeUrl: (url: string) => void;
  onAnalyzeHtml: (html: string, label: string) => void;
  loading: boolean;
  progress: { step: string; pct: number };
  error: { message: string; hint: string } | null;
  initialUrl?: string;
}

const CAPABILITIES: { icon: typeof BoltIcon; title: string; items: string[]; accent: string }[] = [
  {
    icon: BoltIcon,
    title: "Performance",
    accent: "from-indigo-500 to-violet-500",
    items: [
      "HTML and stylesheet weight",
      "Render-blocking scripts",
      "Images without reserved space",
      "Third-party domains & request count",
    ],
  },
  {
    icon: PhoneIcon,
    title: "Mobile",
    accent: "from-teal-500 to-emerald-500",
    items: [
      "Viewport tag & pinch-zoom",
      "Responsive CSS (@media rules)",
      "Fixed widths that cause sideways scroll",
      "Tap-to-call phone links",
    ],
  },
  {
    icon: EyeIcon,
    title: "Accessibility",
    accent: "from-amber-500 to-orange-500",
    items: [
      "Missing image alt text",
      "Unlabelled form fields",
      "Empty links & unnamed buttons",
      "Heading order and page landmarks",
    ],
  },
  {
    icon: SearchIcon,
    title: "SEO",
    accent: "from-pink-500 to-rose-500",
    items: [
      "Title, description, H1, canonical",
      "Accidental “noindex” blocks",
      "robots.txt and XML sitemap (fetched live)",
      "Structured data & social preview tags",
    ],
  },
];

const NOT_DONE = [
  "Core Web Vitals or any real speed score",
  "Colour-contrast measurement",
  "Keyword rankings, backlinks or competitor data",
  "Crawling more than the single page you enter",
  "Anything your JavaScript renders after the page loads",
];

export default function Landing({ onAnalyzeUrl, onAnalyzeHtml, loading, progress, error, initialUrl }: Props) {
  const [mode, setMode] = useState<"url" | "html">("url");
  const [url, setUrl] = useState(initialUrl ?? "");
  const [html, setHtml] = useState("");
  const [label, setLabel] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (mode === "url") onAnalyzeUrl(url);
    else onAnalyzeHtml(html, label);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
      {/* Hero */}
      <div className="animate-fade-up text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm backdrop-blur">
          <SparkIcon className="h-3.5 w-3.5" />
          Real checks on your real HTML — no invented results
        </span>
        <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Find out what's wrong
          <br className="hidden sm:block" /> with your website
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-600 sm:text-lg">
          Enter your address and we'll download your page, inspect the code, and explain any problems in plain
          English — with practical steps to fix each one.
        </p>
      </div>

      {/* Form card */}
      <form
        onSubmit={submit}
        className="animate-fade-up mx-auto mt-8 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60 sm:p-6"
        style={{ animationDelay: "90ms" }}
      >
        <div className="mb-4 flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setMode("url")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 transition-all",
              mode === "url" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            <GlobeIcon className="h-4 w-4" /> Website address
          </button>
          <button
            type="button"
            onClick={() => setMode("html")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 transition-all",
              mode === "html" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            <CodeIcon className="h-4 w-4" /> Paste HTML
          </button>
        </div>

        {mode === "url" ? (
          <div className="space-y-3">
            <label htmlFor="site-url" className="block text-sm font-medium text-slate-700">
              Your website address
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <GlobeIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="site-url"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  value={url}
                  disabled={loading}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="example.com"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-11 pr-4 text-base text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all",
                  "hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
                  !loading && url.trim() && "animate-pulse-ring",
                )}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/40 border-t-white" />
                    Analysing…
                  </>
                ) : (
                  <>
                    <SearchIcon className="h-5 w-5" />
                    Analyze Website
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Public pages only. Your page is fetched through a public read-only proxy because browsers cannot read
              other sites directly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <label htmlFor="paste-html" className="block text-sm font-medium text-slate-700">
              Paste your page source
            </label>
            <p className="text-xs text-slate-500">
              Open your site, press <kbd className="rounded border border-slate-300 bg-slate-50 px-1">Ctrl</kbd>+
              <kbd className="rounded border border-slate-300 bg-slate-50 px-1">U</kbd> (or ⌥⌘U on Mac), select all and
              paste it here. Useful when a site blocks automated requests. No network requests are made in this mode,
              so robots.txt, sitemap and stylesheet checks are skipped rather than guessed.
            </p>
            <textarea
              id="paste-html"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={7}
              spellCheck={false}
              placeholder="<!doctype html>&#10;<html lang=&quot;en&quot;> …"
              className="thin-scroll w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Which address is this? (optional)"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
              <button
                type="submit"
                disabled={loading || !html.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <SearchIcon className="h-5 w-5" />
                Analyze HTML
              </button>
            </div>
          </div>
        )}

        {/* progress */}
        {loading && (
          <div className="animate-fade-in mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="flex items-center justify-between text-sm font-medium text-indigo-800">
              <span>{progress.step}</span>
              <span className="tabular-nums">{progress.pct}%</span>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-indigo-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-out"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-indigo-700/80">
              Some sites and proxies are slow — this can take up to 30 seconds.
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="animate-fade-up mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex gap-3">
              <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-rose-800">{error.message}</p>
                <p className="mt-1 text-sm leading-relaxed text-rose-700/90">{error.hint}</p>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Honesty panel */}
      <div
        className="animate-fade-up mx-auto mt-6 flex max-w-3xl gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur"
        style={{ animationDelay: "160ms" }}
      >
        <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
        <p className="text-[13px] leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">How this tool works.</span> It downloads the HTML of the one
          page you enter (plus its stylesheets, <code className="font-mono text-[12px]">robots.txt</code> and sitemap
          where possible) and inspects the actual code. Every result below comes from something found — or genuinely
          not found — in your page. Nothing is simulated, and anything we cannot measure is labelled{" "}
          <span className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700">
            <QuestionIcon className="h-3 w-3" /> Could not check
          </span>{" "}
          instead of being guessed.
        </p>
      </div>

      {/* What we check */}
      <div className="mt-12">
        <h2 className="text-center text-lg font-semibold text-slate-900">What gets checked</h2>
        <p className="mx-auto mt-1.5 max-w-xl text-center text-sm text-slate-500">
          Around 30 automated checks across four areas, all run against your page's real source code.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {CAPABILITIES.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className="animate-fade-up card-hover rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                style={{ animationDelay: `${200 + i * 70}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                      cap.accent,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-semibold text-slate-900">{cap.title}</h3>
                </div>
                <ul className="mt-4 space-y-2">
                  {cap.items.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-slate-600">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* What we do NOT check */}
      <div
        className="animate-fade-up mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5"
        style={{ animationDelay: "480ms" }}
      >
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-600">
          <QuestionIcon className="h-4 w-4" />
          Not implemented — deliberately left blank
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          These are things a browser-based tool genuinely cannot measure. Rather than showing a made-up number, this
          app tells you so and points you at the right tool:
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {NOT_DONE.map((n) => (
            <li key={n} className="flex gap-2 text-sm text-slate-500">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
