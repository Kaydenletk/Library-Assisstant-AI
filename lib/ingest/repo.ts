import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const SDK_REPO = 'https://github.com/modelcontextprotocol/typescript-sdk.git';
export const SDK_GIT_REF = 'v1.29.0'; // verified via git ls-remote --tags
const CACHE_DIR = path.resolve('.cache/mcp-sdk');

/** Shallow-clone the SDK repo at SDK_GIT_REF into .cache (idempotent). Returns the repo root. */
export function cloneSdkRepo(): string {
  if (existsSync(CACHE_DIR)) return CACHE_DIR;
  execSync(
    `git clone --depth 1 --branch ${SDK_GIT_REF} ${SDK_REPO} ${JSON.stringify(CACHE_DIR)}`,
    { stdio: 'inherit' },
  );
  return CACHE_DIR;
}

/** Absolute paths of the doc files to ingest: docs/*.md (minus the TOC) + README.md. */
export function listDocFiles(repoRoot: string): string[] {
  const docsDir = path.join(repoRoot, 'docs');
  const docs = readdirSync(docsDir)
    .filter((f) => f.endsWith('.md') && f !== 'documents.md') // documents.md is just a TOC
    .map((f) => path.join(docsDir, f));
  const readme = path.join(repoRoot, 'README.md');
  return existsSync(readme) ? [readme, ...docs] : docs;
}
