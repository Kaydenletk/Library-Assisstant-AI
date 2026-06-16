import type { EvalCase, CaseResult } from './metrics';

/**
 * Pure scorecard aggregation + markdown rendering for the eval harness. No I/O
 * here — scripts/eval.ts owns reading the golden set and writing REPORT.md — so
 * this stays unit-testable without credentials. The runner and the committed
 * scorecard share these functions, so the console summary and the markdown can
 * never drift apart.
 */

export interface Band {
  passed: number;
  total: number;
}

export interface Scorecard {
  /** Every case. */
  overall: Band;
  /** Should-refuse cases — the refusal-discipline axis. */
  refusal: Band;
  /** Should-answer cases — answered and grounded with a citation. */
  answered: Band;
  /** Version-pinned answer cases — every citation in the requested version. */
  versioned: Band;
}

const band = (results: ReadonlyArray<CaseResult>, applies: (r: CaseResult) => boolean): Band => {
  const subset = results.filter(applies);
  return { passed: subset.filter((r) => r.pass).length, total: subset.length };
};

/** Roll per-case results into the four product-axis bands. */
export function scorecard(cases: ReadonlyArray<EvalCase>, results: ReadonlyArray<CaseResult>): Scorecard {
  const versionOf = new Map(cases.map((c) => [c.id, c.version]));
  return {
    overall: band(results, () => true),
    refusal: band(results, (r) => r.expect === 'refuse'),
    answered: band(results, (r) => r.expect === 'answer'),
    versioned: band(results, (r) => r.expect === 'answer' && versionOf.get(r.id) !== undefined),
  };
}

const pct = (b: Band): string => (b.total === 0 ? 'n/a' : `${Math.round((b.passed / b.total) * 100)}%`);
const cell = (b: Band): string => (b.total === 0 ? 'n/a' : `${b.passed}/${b.total} (${pct(b)})`);

/** Markdown scorecard for docs/eval/REPORT.md. */
export function renderReport(
  cases: ReadonlyArray<EvalCase>,
  results: ReadonlyArray<CaseResult>,
  when: Date = new Date(),
): string {
  const sc = scorecard(cases, results);
  const versionOf = new Map(cases.map((c) => [c.id, c.version]));
  const lines: string[] = [];

  lines.push('# Eval Scorecard — MCP TypeScript SDK Doc Assistant');
  lines.push('');
  lines.push(`_Generated ${when.toISOString().slice(0, 10)} · ${sc.overall.total} cases · \`pnpm eval\`_`);
  lines.push('');
  lines.push('Scores the three product disciplines: refuse when the docs do not cover it, cite every claim, and keep version-pinned answers in their version.');
  lines.push('');
  lines.push('| Axis | Score | Measures |');
  lines.push('| --- | --- | --- |');
  lines.push(`| Overall pass | ${cell(sc.overall)} | All cases |`);
  lines.push(`| Refusal accuracy | ${cell(sc.refusal)} | Refuses out-of-scope questions |`);
  lines.push(`| Answer + citation | ${cell(sc.answered)} | Answers in-scope questions, grounded by a source |`);
  lines.push(`| Version-correctness | ${cell(sc.versioned)} | v1/v2-pinned answers cite only that version |`);
  lines.push('');
  lines.push('## Cases');
  lines.push('');
  lines.push('| ID | Expect | Version | Result | Citations |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const r of results) {
    const v = versionOf.get(r.id) ?? '—';
    const detail = r.refused ? 'refused' : `${r.citationCount} [${r.citedVersions.join(',') || '—'}]`;
    lines.push(`| ${r.id} | ${r.expect} | ${v} | ${r.pass ? '✓ pass' : '✗ fail'} | ${detail} |`);
  }
  lines.push('');
  return lines.join('\n');
}
