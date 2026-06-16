interface StarterPromptsProps {
  onPick: (prompt: string) => void;
}

/** Curated openers that each show off one discipline of the assistant. */
const STARTERS: { prompt: string; tag: string; note: string }[] = [
  {
    prompt: 'How do I register a tool on an MCP server?',
    tag: 'v1 vs v2',
    note: 'Returns both versions, labeled',
  },
  {
    prompt: 'In v2, how do I set up the Streamable HTTP transport?',
    tag: 'version-pinned',
    note: 'v2 only',
  },
  {
    prompt: 'What does the MCP protocol specify about authorization?',
    tag: 'protocol spec',
    note: 'Cites the 2025-11-25 revision',
  },
  {
    prompt: 'How do I deploy a Kubernetes cluster on AWS?',
    tag: 'out of scope',
    note: 'Refuses instead of guessing',
  },
];

export function StarterPrompts({ onPick }: StarterPromptsProps) {
  return (
    <ul className="starters">
      {STARTERS.map((s) => (
        <li key={s.prompt}>
          <button type="button" className="starter" onClick={() => onPick(s.prompt)}>
            <span className="starter__tag">{s.tag}</span>
            <span className="starter__prompt">{s.prompt}</span>
            <span className="starter__note">{s.note}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
