import '../lib/load-env';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { answer } from '../lib/agent/answer';
import { GOLDEN } from '../eval/dataset';
import { scoreCase, type CaseResult } from '../eval/metrics';
import { scorecard, renderReport } from '../eval/report';

const REPORT_PATH = join(process.cwd(), 'docs', 'eval', 'REPORT.md');

async function main() {
  console.log(`\nRunning eval over ${GOLDEN.length} cases…\n`);
  const results: CaseResult[] = [];

  for (const c of GOLDEN) {
    // Sequential to stay friendly with rate limits.
    const { text } = await answer(c.question);
    const r = scoreCase(c, text);
    results.push(r);
    const mark = r.pass ? '✓' : '✗';
    const detail = r.refused ? 'refused' : `${r.citationCount} cites [${r.citedVersions.join(',') || '—'}]`;
    console.log(`${mark} ${c.id.padEnd(16)} expect:${c.expect.padEnd(7)} ${detail}`);
  }

  const sc = scorecard(GOLDEN, results);
  const band = (b: { passed: number; total: number }) =>
    b.total === 0 ? 'n/a' : `${b.passed}/${b.total} (${Math.round((b.passed / b.total) * 100)}%)`;

  console.log('\n── Scorecard ───────────────────────────────');
  console.log(`Overall pass        ${band(sc.overall)}`);
  console.log(`Refusal accuracy    ${band(sc.refusal)}`);
  console.log(`Answer + citation   ${band(sc.answered)}`);
  console.log(`Version-correctness ${band(sc.versioned)}`);
  console.log('─────────────────────────────────────────────');

  mkdirSync(join(process.cwd(), 'docs', 'eval'), { recursive: true });
  writeFileSync(REPORT_PATH, renderReport(GOLDEN, results));
  console.log(`Wrote ${REPORT_PATH}\n`);

  const failed = results.filter((r) => !r.pass);
  if (failed.length > 0) {
    console.log(`Failures: ${failed.map((r) => r.id).join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
