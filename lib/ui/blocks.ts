/**
 * Split an assistant message into prose and fenced code blocks so the UI can
 * render code in a styled <pre> while running prose through the citation parser.
 * Lightweight on purpose — avoids pulling in a full markdown renderer. Pure.
 */
export type Block =
  | { type: 'prose'; value: string }
  | { type: 'code'; lang: string; value: string };

const FENCE = /```(\w*)\n([\s\S]*?)```/g;

export function splitCodeBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let lastIndex = 0;
  for (const m of text.matchAll(FENCE)) {
    const [full, lang, code] = m;
    const start = m.index;
    if (start > lastIndex) {
      blocks.push({ type: 'prose', value: text.slice(lastIndex, start) });
    }
    blocks.push({ type: 'code', lang: lang || 'text', value: code.replace(/\n$/, '') });
    lastIndex = start + full.length;
  }
  if (lastIndex < text.length) {
    blocks.push({ type: 'prose', value: text.slice(lastIndex) });
  }
  return blocks;
}
