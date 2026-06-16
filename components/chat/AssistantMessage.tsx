import { Fragment } from 'react';
import { splitCodeBlocks } from '@/lib/ui/blocks';
import { parseCitations, splitInlineCode } from '@/lib/ui/citations';
import { CitationChip } from './CitationChip';
import { CopyButton } from './CopyButton';

/** Render a text run, styling inline `code` spans. */
function InlineText({ text }: { text: string }) {
  return (
    <>
      {splitInlineCode(text).map((span, i) =>
        span.code ? (
          <code key={i} className="inline-code">
            {span.value}
          </code>
        ) : (
          <Fragment key={i}>{span.value}</Fragment>
        ),
      )}
    </>
  );
}

/** Render assistant prose with inline citations lifted into chips. */
function Prose({ text }: { text: string }) {
  const segments = parseCitations(text);
  return (
    <p className="assistant-prose">
      {segments.map((seg, i) =>
        seg.type === 'text' ? (
          <InlineText key={i} text={seg.value} />
        ) : (
          <CitationChip key={i} version={seg.version} label={seg.label} url={seg.url} />
        ),
      )}
    </p>
  );
}

/** Render a full assistant message: prose (with citation chips) + code blocks. */
export function AssistantMessage({ text }: { text: string }) {
  const blocks = splitCodeBlocks(text);
  return (
    <div className="assistant-message">
      {blocks.map((block, i) =>
        block.type === 'code' ? (
          <pre key={i} className="code-block" data-lang={block.lang}>
            <CopyButton code={block.value} />
            <code>{block.value}</code>
          </pre>
        ) : (
          <Prose key={i} text={block.value} />
        ),
      )}
    </div>
  );
}
