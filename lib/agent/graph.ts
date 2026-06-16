import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { hybridSearch, type RetrievedChunk } from '../retrieve/search';
import { rerank } from '../retrieve/rerank';
import { hasConfidentMatch } from './gate';
import { decideAfterGrade, MAX_ATTEMPTS } from './corrective';

/**
 * Corrective-RAG as an explicit LangGraph state machine (the variant where a
 * graph framework earns its place over a plain tool-loop):
 *
 *   rewrite → retrieve → grade ─┬─ confident ──► generate ─► END
 *      ▲                        ├─ weak, tries left ─► (loop back to rewrite)
 *      └────────────────────────┘
 *                               └─ weak, out of tries ─► refuse ─► END
 *
 * It reuses the same retrieval (hybrid + rerank) and the same refusal gate as
 * the product agent, so the moat is identical — the graph only adds the
 * self-correcting query-rewrite loop on top.
 */

const REFUSAL = "The MCP TypeScript SDK docs I have don't cover this.";

const llm = new ChatGoogleGenerativeAI({
  model: 'gemini-2.5-flash',
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const State = Annotation.Root({
  question: Annotation<string>(),
  query: Annotation<string>(),
  docs: Annotation<RetrievedChunk[]>(),
  attempts: Annotation<number>(),
  answer: Annotation<string>(),
});
type GraphState = typeof State.State;

/** Turn the question (or, on retry, a broadened rephrase) into a search query. */
async function rewrite(state: GraphState): Promise<Partial<GraphState>> {
  const attempt = state.attempts + 1;
  const retryHint =
    attempt > 1 ? ` This is retry #${attempt}; the previous query retrieved nothing relevant — broaden or rephrase it.` : '';
  const res = await llm.invoke([
    ['system', `Rewrite the user's question into a concise documentation search query. Return only the query.${retryHint}`],
    ['human', state.question],
  ]);
  return { query: String(res.content).trim(), attempts: attempt };
}

/** Hybrid retrieve + rerank for the current query. */
async function retrieve(state: GraphState): Promise<Partial<GraphState>> {
  const candidates = await hybridSearch(state.query, { limit: 12 });
  const docs = await rerank(state.query, candidates, 6);
  return { docs };
}

/** Grade retrieval with the same confidence gate the product agent uses. */
function grade(state: GraphState) {
  return decideAfterGrade(hasConfidentMatch(state.docs), state.attempts, MAX_ATTEMPTS);
}

/** Write a cited, version-correct answer from the retrieved docs. */
async function generate(state: GraphState): Promise<Partial<GraphState>> {
  const context = state.docs
    .map((d) => `[${d.version}] ${d.heading} — ${d.url}\n${d.content}`)
    .join('\n\n---\n\n');
  const res = await llm.invoke([
    [
      'system',
      'Answer the question using ONLY the context. After each claim, cite the source exactly as "[version] heading — url" from the context. ' +
        'If the answer differs between v1 and v2, give both, labeled. Be concise. ' +
        `If the context does not actually answer the question, reply with exactly this and nothing else: "${REFUSAL}"`,
    ],
    ['human', `Question: ${state.question}\n\nContext:\n${context}`],
  ]);
  return { answer: String(res.content) };
}

function refuse(): Partial<GraphState> {
  return { answer: REFUSAL };
}

const app = new StateGraph(State)
  .addNode('rewrite', rewrite)
  .addNode('retrieve', retrieve)
  .addNode('generate', generate)
  .addNode('refuse', refuse)
  .addEdge(START, 'rewrite')
  .addEdge('rewrite', 'retrieve')
  .addConditionalEdges('retrieve', grade, {
    generate: 'generate',
    rewrite: 'rewrite',
    refuse: 'refuse',
  })
  .addEdge('generate', END)
  .addEdge('refuse', END)
  .compile();

export interface GraphAnswer {
  text: string;
  attempts: number;
}

/** Run the Corrective-RAG graph for a question. */
export async function answerWithGraph(question: string): Promise<GraphAnswer> {
  const final = await app.invoke({ question, attempts: 0 });
  return { text: final.answer, attempts: final.attempts };
}
