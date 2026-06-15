import '../lib/load-env';
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
  console.log('pgvector extension ensured.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
