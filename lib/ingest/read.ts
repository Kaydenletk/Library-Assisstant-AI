import { readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { DocInput } from './chunk';
import { SDK_GIT_REF } from './repo';

const DOC_VERSION = 'v1';

export function extractTitle(markdown: string, fileName: string): string {
  const h1 = markdown.split('\n').find((l) => /^#\s+/.test(l));
  if (h1) return h1.replace(/^#\s+/, '').trim();
  return fileName.replace(/\.md$/, '').replace(/[-_]/g, ' ');
}

export function blobUrl(relPath: string, ref: string): string {
  return `https://github.com/modelcontextprotocol/typescript-sdk/blob/${ref}/${relPath}`;
}

/** Read a doc file into a DocInput. `repoRoot` is the clone dir; `absPath` the file. */
export function readDocFile(absPath: string, repoRoot: string): DocInput {
  const raw = readFileSync(absPath, 'utf8');
  const { content } = matter(raw); // strips frontmatter if any; MCP docs are usually plain md
  const relPath = path.relative(repoRoot, absPath).split(path.sep).join('/');
  const fileName = path.basename(absPath);
  const source = fileName === 'README.md' ? 'readme' : 'sdk-docs';
  return {
    markdown: content,
    title: extractTitle(content, fileName),
    url: blobUrl(relPath, SDK_GIT_REF),
    version: DOC_VERSION,
    source,
  };
}
