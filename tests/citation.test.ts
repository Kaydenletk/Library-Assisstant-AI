import { describe, it, expect } from 'vitest';
import { formatCitation } from '../lib/retrieve/citation';

describe('formatCitation', () => {
  it('renders version, heading, and url', () => {
    const c = {
      version: 'v1',
      heading: 'Server > Registering tools',
      url: 'https://github.com/modelcontextprotocol/typescript-sdk/blob/1.29.0/docs/server.md#registering-tools',
    };
    expect(formatCitation(c)).toBe(
      '[v1] Server > Registering tools — https://github.com/modelcontextprotocol/typescript-sdk/blob/1.29.0/docs/server.md#registering-tools',
    );
  });
});
