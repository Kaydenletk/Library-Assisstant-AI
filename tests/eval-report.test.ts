import { describe, it, expect } from 'vitest';
import { scorecard, renderReport } from '../eval/report';
import type { EvalCase, CaseResult } from '../eval/metrics';

const cases: EvalCase[] = [
  { id: 'a1', question: 'register tool', expect: 'answer' },
  { id: 'v2', question: 'in v2…', expect: 'answer', version: 'v2' },
  { id: 'r1', question: 'deploy k8s', expect: 'refuse' },
];

const results: CaseResult[] = [
  { id: 'a1', expect: 'answer', refused: false, citationCount: 1, citedVersions: ['v2'], pass: true },
  { id: 'v2', expect: 'answer', refused: false, citationCount: 1, citedVersions: ['v1'], pass: false },
  { id: 'r1', expect: 'refuse', refused: true, citationCount: 0, citedVersions: [], pass: true },
];

describe('scorecard', () => {
  it('bands cases by axis', () => {
    const sc = scorecard(cases, results);
    expect(sc.overall).toEqual({ passed: 2, total: 3 });
    expect(sc.refusal).toEqual({ passed: 1, total: 1 });
    expect(sc.answered).toEqual({ passed: 1, total: 2 });
    // only the v2-pinned case counts toward version-correctness, and it failed
    expect(sc.versioned).toEqual({ passed: 0, total: 1 });
  });
});

describe('renderReport', () => {
  it('renders the axis table and a row per case', () => {
    const md = renderReport(cases, results, new Date('2026-06-16T00:00:00Z'));
    expect(md).toContain('2026-06-16');
    expect(md).toContain('Refusal accuracy');
    expect(md).toContain('| a1 |');
    expect(md).toContain('| v2 |');
    expect(md).toContain('| r1 |');
    expect(md).toContain('✗ fail');
    expect(md).toContain('refused');
  });
});
