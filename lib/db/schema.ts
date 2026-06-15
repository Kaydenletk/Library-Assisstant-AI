import { pgTable, serial, text, vector, index } from 'drizzle-orm/pg-core';

export const chunks = pgTable(
  'chunks',
  {
    id: serial('id').primaryKey(),
    content: text('content').notNull(),
    heading: text('heading').notNull(), // breadcrumb, e.g. "Server > Registering tools"
    url: text('url').notNull(),         // GitHub blob URL incl. #anchor
    version: text('version').notNull().default('v1'),     // 'v1' | 'v2'
    source: text('source').notNull().default('sdk-docs'), // 'sdk-docs' | 'readme' | 'spec'
    embedding: vector('embedding', { dimensions: 1536 }),
  },
  (table) => [
    index('chunks_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
);

export type ChunkRow = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
