export interface DocInput {
  markdown: string;
  title: string;
  url: string;
  version: string;
  source: string;
}

export interface Chunk {
  content: string;
  heading: string; // "Title" or "Title > Section"
  url: string;     // base url, plus #anchor for H2 sections
  version: string;
  source: string;
}

const MAX_CHARS = 1500;

interface Section {
  heading: string;
  anchor: string | null;
  body: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Split markdown into sections by top-level H2 headings, keeping the lead under the title. */
function splitSections(doc: DocInput): Section[] {
  const lines = doc.markdown.split('\n');
  const sections: Section[] = [];
  let heading = doc.title;
  let anchor: string | null = null;
  let buf: string[] = [];
  let inFence = false;

  const flush = () => {
    sections.push({ heading, anchor, body: buf.join('\n').trim() });
    buf = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) inFence = !inFence;
    const isH2 = !inFence && /^##\s+/.test(line);
    if (isH2) {
      flush();
      const text = line.replace(/^##\s+/, '').trim();
      heading = `${doc.title} > ${text}`;
      anchor = slugify(text);
    } else {
      buf.push(line);
    }
  }
  flush();
  return sections.filter((s) => s.body.length > 0);
}

/** Split a section body into <=MAX_CHARS pieces on blank lines, never inside a code fence. */
function packParagraphs(body: string): string[] {
  const lines = body.split('\n');
  const atoms: string[] = []; // a paragraph or a whole code block
  let buf: string[] = [];
  let inFence = false;

  const flush = () => {
    const text = buf.join('\n').trim();
    if (text) atoms.push(text);
    buf = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      buf.push(line);
      if (!inFence) flush(); // closing fence ends the atom
      continue;
    }
    if (!inFence && line.trim() === '') {
      flush();
    } else {
      buf.push(line);
    }
  }
  flush();

  const pieces: string[] = [];
  let current = '';
  for (const atom of atoms) {
    if (current && current.length + atom.length + 2 > MAX_CHARS) {
      pieces.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${atom}` : atom;
  }
  if (current) pieces.push(current);
  return pieces;
}

export function chunkMarkdown(doc: DocInput): Chunk[] {
  const sections = splitSections(doc);
  const chunks: Chunk[] = [];
  for (const section of sections) {
    const url = section.anchor ? `${doc.url}#${section.anchor}` : doc.url;
    for (const content of packParagraphs(section.body)) {
      chunks.push({
        content,
        heading: section.heading,
        url,
        version: doc.version,
        source: doc.source,
      });
    }
  }
  return chunks;
}
