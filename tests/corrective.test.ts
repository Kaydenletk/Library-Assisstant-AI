import { describe, it, expect } from 'vitest';
import { decideAfterGrade } from '../lib/agent/corrective';

describe('decideAfterGrade', () => {
  it('generates when retrieval is confident', () => {
    expect(decideAfterGrade(true, 1, 2)).toBe('generate');
    expect(decideAfterGrade(true, 5, 2)).toBe('generate'); // confidence wins regardless
  });
  it('rewrites and retries when weak but tries remain', () => {
    expect(decideAfterGrade(false, 1, 2)).toBe('rewrite');
  });
  it('refuses when weak and out of tries', () => {
    expect(decideAfterGrade(false, 2, 2)).toBe('refuse');
    expect(decideAfterGrade(false, 3, 2)).toBe('refuse');
  });
});
