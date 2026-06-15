import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

type DB = NeonHttpDatabase<typeof schema>;

let cached: DB | undefined;

function getDb(): DB {
  if (!cached) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    cached = drizzle({ client: neon(process.env.DATABASE_URL), schema });
  }
  return cached;
}

/**
 * Lazily-initialized Drizzle client. Importing `db` does NOT require DATABASE_URL;
 * it is only read on first actual query, so pure modules that merely import the
 * dependency graph (e.g. for types) don't blow up without credentials.
 */
export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? value.bind(real) : value;
  },
});
