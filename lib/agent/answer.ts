import { generateText } from 'ai';
import { agentConfig, MAX_STEPS } from './config';

export { MAX_STEPS };

export interface AnswerResult {
  text: string;
  steps: number;
}

/**
 * Agentic answer loop (non-streaming, for the CLI). The model calls searchDocs
 * (possibly once per version), then writes a cited, version-correct answer — or
 * refuses when the tool reports no relevant docs.
 */
export async function answer(question: string): Promise<AnswerResult> {
  const result = await generateText({ ...agentConfig, prompt: question });
  return { text: result.text, steps: result.steps.length };
}
