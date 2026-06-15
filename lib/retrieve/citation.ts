/** Pure citation formatter — kept free of DB imports so it can be unit-tested without credentials. */
export function formatCitation(c: { version: string; heading: string; url: string }): string {
  return `[${c.version}] ${c.heading} — ${c.url}`;
}
