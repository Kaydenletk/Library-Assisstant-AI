import { embedMany } from 'ai';
import { db } from '../db/client';
import { chunks as chunksTable, type NewChunk } from '../db/schema';
import type { Chunk } from './chunk';

const EMBED_MODEL = 'openai/text-embedding-3-small';
const BATCH = 96;

/** Embed chunks and insert them. Returns the number of rows written. */
export async function embedAndStore(chunks: Chunk[]): Promise<number> {
  let written = 0;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const { embeddings } = await embedMany({
      model: EMBED_MODEL,
      values: slice.map((c) => c.content),
    });
    const rows: NewChunk[] = slice.map((c, j) => ({
      content: c.content,
      heading: c.heading,
      url: c.url,
      version: c.version,
      source: c.source,
      embedding: embeddings[j],
    }));
    await db.insert(chunksTable).values(rows);
    written += rows.length;
  }
  return written;
}
