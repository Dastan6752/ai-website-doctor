import { useCallback, useEffect, useRef, useState } from "react";
import Landing from "./components/Landing";
import ReportView from "./components/ReportView";
import { StethoscopeIcon } from "./components/Icons";
import { AnalysisError, analyzeHtml, analyzeUrl } from "./lib/analyze";
import type { AuditReport } from "./lib/types";

interface ErrorState {
  message: string;
  hint: string;
}

export default function App() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ step: "", pct: 0 });
  const [error, setError] = useState<ErrorState | null>(null);
  const [lastUrl, setLastUrl] = useState("");
  const topRef = useRef<HTMLDivElement>(null);

  // Gentle "creep" so the bar keeps moving while we wait on a slow server.
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      setProgress((p) => (p.pct >= 94 ? p : { ...p, pct: p.pct + 1 }));
    }, 450);
    return () => clearInterval(id);
  }, [loading]);

  const runUrl = useCallback(async (rawUrl: string) => {
    setError(null);
    setLoading(true);
    setProgress({ step: "Starting…", pct: 4 });
    setLastUrl(rawUrl);
    try {
      const result = await analyzeUrl(rawUrl, (step, pct) =>
        setProgress((prev) => ({ step, pct: Math.max(prev.pct, pct) })),
      );
      setReport(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (err instanceof AnalysisError) {
        setError({ message: err.message, hint: err.hint });
      } else {
        setError({
          message: "Something went wrong while analysing that address.",
          hint: err instanceof Error ? err.message : "Please try again in a moment.",
        });
      }
    } finally {
      setLoading(false);
      setProgress({ step: "", pct: 0 });
    }
  }, []);

  const runHtml = useCallback((html: string, label: string) => {
    setError(null);
    setLoading(true);
    try {
      const result = analyzeHtml(html, label);
      setReport(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (err instanceof AnalysisError) setError({ message: err.message, hint: err.hint });
      else
        setError({
          message: "That HTML could not be read.",
          hint: err instanceof Error ? err.message : "Please check what you pasted and try again.",
        });
    } finally {
      setLoading(false);
    }
  }, []);

  // Allow deep-linking: ?url=example.com
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u = params.get("url");
    if (u) {
      setLastUrl(u);
      void runUrl(u);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid-bg min-h-screen">
      <div ref={topRef} />

      <header className="no-print sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-[60px] max-w-5xl items-center gap-3 px-4 sm:px-6">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25">
            <StethoscopeIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-[15px] font-bold tracking-tight text-slate-900">AI Website Doctor</h1>
            <p className="truncate text-[11px] text-slate-500">Honest, automated checks for small business websites</p>
          </div>
          {report && (
            <button
              onClick={() => {
                setReport(null);
                setError(null);
                window.scrollTo({ top: 0 });
              }}
              className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95"
            >
              Scan another
            </button>
          )}
        </div>
      </header>

      <main>
        {report ? (
          <ReportView
            report={report}
            busy={loading}
            onReset={() => {
              setReport(null);
              setError(null);
              window.scrollTo({ top: 0 });
            }}
            onRerun={() => void runUrl(lastUrl)}
          />
        ) : (
          <Landing
            onAnalyzeUrl={(u) => void runUrl(u)}
            onAnalyzeHtml={runHtml}
            loading={loading}
            progress={progress}
            error={error}
            initialUrl={lastUrl}
          />
        )}
      </main>

      <footer className="no-print border-t border-slate-200 bg-white/70 py-6">
        <div className="mx-auto max-w-5xl px-4 text-center text-xs leading-relaxed text-slate-500 sm:px-6">
          <p>
            <strong className="text-slate-700">AI Website Doctor</strong> runs entirely in your browser. Pages are
            fetched through public CORS proxies, so avoid scanning private or password-protected URLs.
          </p>
          <p className="mt-1.5">
            Results describe only what is present in the delivered HTML and CSS. Checks that cannot be performed are
            labelled as such — never estimated or invented.
          </p>
        </div>
      </footer>
    </div>
  );
}
