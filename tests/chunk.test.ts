import { describe, it, expect } from 'vitest';
import { chunkMarkdown } from '../lib/ingest/chunk';

const base = {
  title: 'Server',
  url: 'https://github.com/modelcontextprotocol/typescript-sdk/blob/1.29.0/docs/server.md',
  version: 'v1',
  source: 'sdk-docs',
};

describe('chunkMarkdown', () => {
  it('splits a doc into one chunk per H2 section plus the lead', () => {
    const markdown = [
      'An MCP server exposes tools and resources.',
      '',
      '## Registering tools',
      '',
      'Call server.tool() to register a tool.',
      '',
      '## Registering resources',
      '',
      'Call server.resource().',
    ].join('\n');

    const chunks = chunkMarkdown({ ...base, markdown });

    expect(chunks).toHaveLength(3); // lead + 2 sections
    expect(chunks[0].heading).toBe('Server');
    expect(chunks[0].url).toBe(base.url);
    expect(chunks[1].heading).toBe('Server > Registering tools');
    expect(chunks[1].url).toBe(base.url + '#registering-tools');
    expect(chunks[2].content).toContain('server.resource()');
  });

  it('carries version and source on every chunk', () => {
    const chunks = chunkMarkdown({ ...base, markdown: '## A\n\ntext' });
    expect(chunks.every((c) => c.version === 'v1' && c.source === 'sdk-docs')).toBe(true);
  });

  it('splits an oversized section into multiple chunks with the same heading', () => {
    const para = 'word '.repeat(120); // ~600 chars
    const markdown = `## Big\n\n${para}\n\n${para}\n\n${para}`; // ~1800 chars > 1500
    const chunks = chunkMarkdown({ ...base, markdown });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.heading === 'Server > Big')).toBe(true);
  });

  it('never splits inside a fenced code block', () => {
    const code = '```ts\n' + 'const x = 1;\n'.repeat(60) + '```';
    const markdown = `## Code\n\nLead.\n\n${code}\n\nTrailer.`;
    const chunks = chunkMarkdown({ ...base, markdown });
    const fenceChunks = chunks.filter((c) => c.content.includes('```ts'));
    expect(fenceChunks).toHaveLength(1);
    const opens = (fenceChunks[0].content.match(/```/g) || []).length;
    expect(opens % 2).toBe(0); // balanced fences — not cut mid-block
  });

  it('drops empty sections', () => {
    const chunks = chunkMarkdown({ ...base, markdown: '## Empty\n\n\n## Real\n\ncontent' });
    expect(chunks.map((c) => c.heading)).toEqual(['Server > Real']);
  });
});
