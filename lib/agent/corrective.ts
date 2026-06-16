/**
 * Pure routing policy for the Corrective-RAG graph. After retrieval is graded:
 *   - confident match            → generate the answer
 *   - weak, but tries remain     → rewrite the query and retry (the "correction")
 *   - weak, out of tries         → refuse (the moat survives the loop)
 * Kept pure so the control flow is unit-tested without a model or DB.
 */
export type CorrectiveStep = 'generate' | 'rewrite' | 'refuse';

export const MAX_ATTEMPTS = 2;

export function decideAfterGrade(
  hasConfidentMatch: boolean,
  attempts: number,
  maxAttempts: number = MAX_ATTEMPTS,
): CorrectiveStep {
  if (hasConfidentMatch) return 'generate';
  if (attempts < maxAttempts) return 'rewrite';
  return 'refuse';
}
