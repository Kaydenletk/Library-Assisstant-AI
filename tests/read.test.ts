import { describe, it, expect } from 'vitest';
import { extractTitle, blobUrl } from '../lib/ingest/read';

describe('extractTitle', () => {
  it('uses the first H1 when present', () => {
    expect(extractTitle('# Building Servers\n\nintro', 'server.md')).toBe('Building Servers');
  });
  it('falls back to a humanized filename when no H1', () => {
    expect(extractTitle('no heading here', 'server-quickstart.md')).toBe('server quickstart');
  });
});

describe('blobUrl', () => {
  it('builds a GitHub blob URL from the repo-relative path', () => {
    expect(blobUrl('docs/server.md', 'v1.29.0')).toBe(
      'https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.29.0/docs/server.md',
    );
  });
});
