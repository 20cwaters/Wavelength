import { useState } from 'react';
import { useGame } from '../useGame';

export default function RoomHeader({ onRules, onTopic }: { onRules: () => void; onTopic: () => void }) {
  const { view, actions } = useGame();
  const [copied, setCopied] = useState(false);
  if (!view) return null;

  const party = view.mode === 'party';
  const skippable = party
    ? ['authoring', 'guessing'].includes(view.phase)
    : ['clue', 'guessing', 'bonus'].includes(view.phase);
  const skipLabel = party && view.phase === 'authoring' ? '⏩ Force start' : '⏭ Skip';
  const skipConfirm =
    party && view.phase === 'authoring'
      ? 'Start guessing now? Players still writing clues will be skipped.'
      : party
        ? 'Skip this dial? Nobody scores.'
        : 'Skip this round? No points will be scored.';

  const copy = async () => {
    const url = `${location.origin}/?room=${view.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt('Copy this invite link:', url);
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold">
          📡 <span className="brand-gradient uppercase tracking-[0.22em]">Wavelength</span>
        </span>
        <button className="btn btn-ghost px-3 py-1 font-mono text-sm" onClick={copy} title="Copy invite link">
          {view.code} {copied ? '✅' : '🔗'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-ghost px-3 py-1 text-sm" onClick={onRules}>
          📖 Rules
        </button>
        <button className="btn btn-ghost px-3 py-1 text-sm" onClick={onTopic}>
          ✏️ Topics ({view.customTopicCount})
        </button>
        {view.you.isHost && skippable && (
          <button
            className="btn btn-ghost px-3 py-1 text-sm"
            onClick={() => {
              if (confirm(skipConfirm)) actions.skipRound();
            }}
          >
            {skipLabel}
          </button>
        )}
        <button
          className="btn btn-ghost px-3 py-1 text-sm"
          onClick={() => {
            if (confirm('Leave this room?')) actions.leave();
          }}
        >
          🚪 Leave
        </button>
      </div>
    </header>
  );
}
