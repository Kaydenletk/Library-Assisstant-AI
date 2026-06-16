/**
 * Parse an assistant answer into renderable segments, lifting inline citations
 * (`[v2] heading — https://...`) out of the prose so the UI can show them as
 * version-badged chips instead of raw URLs. Pure + framework-free → unit-tested.
 */
export type Segment =
  | { type: 'text'; value: string }
  | { type: 'citation'; version: string; label: string; url: string };

/** Split a text run into plain + inline-`code` spans for styled rendering. */
export type InlineSpan = { code: boolean; value: string };
export function splitInlineCode(text: string): InlineSpan[] {
  return text
    .split(/(`[^`]+`)/)
    .filter((s) => s !== '')
    .map((s) =>
      s.startsWith('`') && s.endsWith('`')
        ? { code: true, value: s.slice(1, -1) }
        : { code: false, value: s },
    );
}

// version is v1 / v2 / spec / a date-tagged protocol revision (2025-11-25).
const CITATION = /\[(v1|v2|spec|\d{4}-\d{2}-\d{2})\]\s+(.+?)\s+—\s+(https?:\/\/\S+)/g;

/** Strip trailing sentence punctuation a URL match may have swallowed. */
function cleanUrl(url: string): string {
  return url.replace(/[.,;)\]]+$/, '');
}

export function parseCitations(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const m of text.matchAll(CITATION)) {
    const [full, version, label, rawUrl] = m;
    const start = m.index;
    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) });
    }
    const url = cleanUrl(rawUrl);
    segments.push({ type: 'citation', version, label: label.trim(), url });
    // Give back any trailing punctuation the URL match swallowed (e.g. a period).
    lastIndex = start + full.length - (rawUrl.length - url.length);
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}
