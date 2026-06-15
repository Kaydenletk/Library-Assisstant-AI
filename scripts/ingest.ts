import '../lib/load-env';
import { cloneSdkRepo, listDocFiles, SDK_GIT_REF } from '../lib/ingest/repo';
import { readDocFile } from '../lib/ingest/read';
import { chunkMarkdown, type Chunk } from '../lib/ingest/chunk';
import { embedAndStore } from '../lib/ingest/embed-store';

async function main() {
  const repoRoot = cloneSdkRepo();
  const files = listDocFiles(repoRoot);
  console.log(`Ingesting ${files.length} files from MCP TS SDK @ ${SDK_GIT_REF}`);

  const allChunks: Chunk[] = [];
  for (const file of files) {
    const doc = readDocFile(file, repoRoot);
    const chunks = chunkMarkdown(doc);
    allChunks.push(...chunks);
    console.log(`  ${doc.title}: ${chunks.length} chunks`);
  }

  console.log(`Embedding + storing ${allChunks.length} chunks...`);
  const written = await embedAndStore(allChunks);
  console.log(`Done. Wrote ${written} chunks.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
