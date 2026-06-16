import { stepCountIs } from 'ai';
import { chatModel } from './model';
import { SYSTEM_PROMPT } from './prompt';
import { searchDocs } from './tools';

/** Max agent steps: enough for search → (optional refine) → answer, bounded so it can't loop. */
export const MAX_STEPS = 5;

/**
 * One source of truth for the agent's wiring, shared by the CLI (`generateText`
 * in answer.ts) and the chat route (`streamText`). Keeping model + system prompt
 * + tools + stop condition together means the terminal and the browser behave
 * identically.
 */
export const agentConfig = {
  model: chatModel,
  system: SYSTEM_PROMPT,
  tools: { searchDocs },
  stopWhen: stepCountIs(MAX_STEPS),
} as const;
