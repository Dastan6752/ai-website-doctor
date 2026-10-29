import { CATEGORY_META, CATEGORY_ORDER } from "./types";
import type { AuditReport, CheckStatus } from "./types";

const STATUS_LABEL: Record<CheckStatus, string> = {
  pass: "PASS",
  warn: "NEEDS WORK",
  fail: "PROBLEM",
  info: "INFO",
  unknown: "COULD NOT CHECK",
};

/**
 * Developer-friendly Markdown export (carried over from v1).
 * Contains only checks that actually ran, plus the explicit not-implemented list.
 */
export function reportToMarkdown(report: AuditReport): string {
  const lines: string[] = [];
  const s = report.fetchMeta;
  const score = report.overall.score;
  lines.push(`# AI Website Doctor report`);
  lines.push(``);
  lines.push(`**Page analysed:** ${s?.finalUrl || report.target}`);
  lines.push(`**Generated:** ${new Date(report.finishedAt).toLocaleString()}`);
  lines.push(`**Checks run:** ${report.checks.length}`);
  lines.push(
    `**Overall score:** ${score === null ? "not scored" : `${score}/100`} (${report.overall.pass} passed, ${report.overall.warn} warnings, ${report.overall.fail} problems)`,
  );
  lines.push(``);
  lines.push(
    `> This score is a weighted average of the checks listed below that could actually be completed. It is not a Lighthouse, PageSpeed or Google score. Checks marked INFO or COULD NOT CHECK are excluded. The “Not implemented” list at the end was never measured.`,
  );
  lines.push(``);

  if (report.contextNotes.length) {
    lines.push(`## Important context`);
    report.contextNotes.forEach((n) => lines.push(`- ${n}`));
    lines.push(``);
  }

  lines.push(`## How the page was retrieved`);
  lines.push(`- Source: ${report.source === "url" ? "downloaded via proxy" : "HTML pasted in"}`);
  lines.push(`- Requested: ${s?.requestedUrl ?? report.target}`);
  lines.push(`- Final address: ${s?.finalUrl ?? report.target}`);
  lines.push(`- HTTP status: ${s?.httpStatus ?? "unknown"}`);
  lines.push(`- Content type: ${s?.contentType ?? "unknown"}`);
  lines.push(`- HTML size: ${s ? `${(s.bytes / 1024).toFixed(1)} KB` : "unknown"}`);
  lines.push(`- Retrieved via: ${s?.proxy ?? "n/a"}`);
  if (s?.normalised) lines.push(`- Markup was re-serialised by the proxy (byte counts are approximate)`);
  lines.push(
    `- Stylesheets inspected: ${report.extras.css.filter((c) => c.ok).length} of ${report.extras.css.length} attempted`,
  );
  lines.push(`- robots.txt: ${report.extras.robotsTxt.attempted ? (report.extras.robotsTxt.ok ? "read" : "requested but not readable") : "not requested"}`);
  lines.push(``);

  for (const id of CATEGORY_ORDER) {
    const cat = report.categories[id];
    const checks = report.checks.filter((c) => c.category === id);
    if (!checks.length) continue;
    lines.push(`## ${CATEGORY_META[id].label} — ${cat.score === null ? "not scored" : `${cat.score}/100`}`);
    lines.push(`${cat.pass} passed · ${cat.warn} warnings · ${cat.fail} problems · ${cat.unknown} could not check · ${cat.info} info`);
    lines.push(``);
    for (const c of checks) {
      lines.push(`### [${STATUS_LABEL[c.status]}] ${c.title}${c.metric ? `  (${c.metric})` : ""}`);
      lines.push(c.finding);
      lines.push(``);
      if (c.evidence?.length) {
        lines.push(`**What we found:**`);
        c.evidence.forEach((e) => lines.push(`- ${e}`));
        lines.push(``);
      }
      lines.push(`**Why this matters:** ${c.why}`);
      lines.push(``);
      if (c.status !== "pass") {
        lines.push(`**How to fix it:**`);
        c.fix.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
        lines.push(``);
      }
    }
  }

  lines.push(`## Not implemented in this tool`);
  lines.push(`These were never measured and do not affect the score.`);
  lines.push(``);
  for (const item of report.notChecked) {
    lines.push(`- **${item.title}** (${CATEGORY_META[item.category].short}) — ${item.reason}`);
  }
  lines.push(``);
  return lines.join("\n");
}
