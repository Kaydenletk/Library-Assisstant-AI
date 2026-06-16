import '../lib/load-env';
import { answerWithGraph } from '../lib/agent/graph';

async function main() {
  const question = process.argv.slice(2).join(' ');
  if (!question) {
    console.error('Usage: pnpm answer:graph "your question"');
    process.exit(1);
  }
  console.log(`\nQ: ${question}\n`);
  const { text, attempts } = await answerWithGraph(question);
  console.log(text);
  console.log(`\n(Corrective-RAG: ${attempts} retrieval attempt${attempts === 1 ? '' : 's'})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
