'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';

interface ComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
  busy: boolean;
}

export function Composer({ onSend, onStop, busy }: ComposerProps) {
  const [value, setValue] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || busy) return;
    onSend(text);
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  return (
    <form className="composer" onSubmit={submit}>
      <textarea
        className="composer__input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask about tools, transports, auth… (Shift+Enter for newline)"
        rows={1}
        aria-label="Ask a question about the MCP TypeScript SDK"
      />
      {busy ? (
        <button type="button" className="composer__btn composer__btn--stop" onClick={onStop}>
          Stop
        </button>
      ) : (
        <button type="submit" className="composer__btn" disabled={!value.trim()}>
          Ask <span aria-hidden>↵</span>
        </button>
      )}
    </form>
  );
}
