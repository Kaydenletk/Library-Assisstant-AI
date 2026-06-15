import { embed } from 'ai';
import { cosineDistance, desc, gt, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { chunks } from '../db/schema';
import { formatCitation } from './citation';

const EMBED_MODEL = 'openai/text-embedding-3-small';

export interface RetrievedChunk {
  content: string;
  heading: string;
  url: string;
  version: string;
  source: string;
  similarity: number;
  citation: string;
}

export { formatCitation };

export async function search(
  query: string,
  limit = 8,
  minSimilarity = 0.3,
): Promise<RetrievedChunk[]> {
  const { embedding } = await embed({ model: EMBED_MODEL, value: query });
  const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, embedding)})`;
  const rows = await db
    .select({
      content: chunks.content,
      heading: chunks.heading,
      url: chunks.url,
      version: chunks.version,
      source: chunks.source,
      similarity,
    })
    .from(chunks)
    .where(gt(similarity, minSimilarity))
    .orderBy((t) => desc(t.similarity))
    .limit(limit);

  return rows.map((r) => ({ ...r, citation: formatCitation(r) }));
}
