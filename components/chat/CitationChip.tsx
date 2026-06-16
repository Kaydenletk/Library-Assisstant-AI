import type { CSSProperties } from 'react';

interface CitationChipProps {
  version: string;
  label: string;
  url: string;
}

/** Map a citation's version to its semantic color tokens. */
function tone(version: string): { fg: string; wash: string; tag: string } {
  if (version === 'v1') return { fg: 'var(--v1)', wash: 'var(--v1-wash)', tag: 'v1' };
  if (version === 'v2') return { fg: 'var(--v2)', wash: 'var(--v2-wash)', tag: 'v2' };
  return { fg: 'var(--spec)', wash: 'var(--spec-wash)', tag: 'spec' }; // spec / date-tagged revision
}

export function CitationChip({ version, label, url }: CitationChipProps) {
  const t = tone(version);
  const style: CSSProperties = { color: t.fg, background: t.wash, borderColor: t.fg };
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${version} · ${label}`}
      className="citation-chip"
      style={style}
    >
      <span className="citation-chip__tag" style={{ background: t.fg }}>
        {t.tag}
      </span>
      <span className="citation-chip__label">{label}</span>
      <span aria-hidden className="citation-chip__arrow">
        ↗
      </span>
    </a>
  );
}
