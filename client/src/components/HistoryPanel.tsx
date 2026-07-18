import type { RoomView } from '../../../shared/types';
import { teamName, teamText } from '../ui';

export default function HistoryPanel({ view }: { view: RoomView }) {
  if (view.mode === 'party') {
    if (view.partyHistory.length === 0) return null;
    return (
      <details className="card-panel">
        <summary className="cursor-pointer font-semibold">
          📜 Dial history ({view.partyHistory.length})
        </summary>
        <ol className="mt-3 space-y-2 text-sm">
          {[...view.partyHistory].reverse().map((h) => (
            <li key={h.dialNumber} className="border-b border-slate-700/60 pb-2 last:border-none">
              <span className="font-bold">Dial {h.dialNumber}</span> · &ldquo;{h.clue}&rdquo; by{' '}
              <b>{h.authorName}</b> ({h.card.left} ↔ {h.card.right}) — target {h.target}°
              <div className="text-slate-400">
                {h.guesses.length > 0
                  ? h.guesses.map((g) => `${g.name} +${g.points}`).join(' · ')
                  : 'no guesses'}
                {' · '}writer +{h.authorPoints}
              </div>
            </li>
          ))}
        </ol>
      </details>
    );
  }

  if (view.history.length === 0) return null;
  return (
    <details className="card-panel">
      <summary className="cursor-pointer font-semibold">
        📜 Round history ({view.history.length})
      </summary>
      <ol className="mt-3 space-y-2 text-sm">
        {[...view.history].reverse().map((h) => (
          <li key={h.round} className="border-b border-slate-700/60 pb-2 last:border-none">
            <span className="font-bold">R{h.round}</span>{' '}
            <span className={teamText(h.psychicTeam)}>{teamName(h.psychicTeam)}</span> psychic{' '}
            <b>{h.psychicName}</b> · &ldquo;{h.card.left} ↔ {h.card.right}&rdquo;
            {h.skipped ? (
              <span className="text-slate-400"> — skipped</span>
            ) : (
              <>
                {' '}
                · clue &ldquo;{h.clue}&rdquo; —{' '}
                <b>
                  {h.points} pt{h.points === 1 ? '' : 's'}
                </b>{' '}
                <span className="text-slate-400">
                  (target {h.target}°, guess {h.guess}°)
                </span>
                {h.bonusAwarded && h.bonusTeam && (
                  <span className={teamText(h.bonusTeam)}> · +1 bonus {teamName(h.bonusTeam)}</span>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}
