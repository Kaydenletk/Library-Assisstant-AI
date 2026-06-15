import '../lib/load-env';
import { search } from '../lib/retrieve/search';

async function main() {
  const query = process.argv.slice(2).join(' ');
  if (!query) {
    console.error('Usage: pnpm ask "your question"');
    process.exit(1);
  }
  const results = await search(query);
  console.log(`\nQuery: ${query}\n`);
  for (const r of results) {
    console.log(`• (${r.similarity.toFixed(3)}) ${r.citation}`);
    console.log(`    ${r.content.slice(0, 160).replace(/\n/g, ' ')}…\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
