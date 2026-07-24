import { useEffect, useState } from 'react';
import { clampDial } from '../../../shared/game';
import type { RoomView, SpectrumCard } from '../../../shared/types';
import { PLAYER_COLORS } from '../ui';
import { useGame, type GameActions } from '../useGame';
import Dial from './Dial';
import { ClueForm } from './Game';
import HistoryPanel from './HistoryPanel';
import Tip from './TutorialTip';

interface PV {
  view: RoomView;
  actions: GameActions;
}

const colorOf = (view: RoomView, playerId: string): string => {
  const i = view.players.findIndex((p) => p.id === playerId);
  return PLAYER_COLORS[(i < 0 ? 0 : i) % PLAYER_COLORS.length];
};

function SpectrumLabels({ card }: { card: SpectrumCard | null }) {
  if (!card) return null;
  return (
    <div className="mt-1 flex items-start justify-between gap-4">
      <span className="spectrum-chip spectrum-left">⬅ {card.left}</span>
      {card.deck === 'custom' && (
        <span className="self-center text-xs text-slate-500">
          custom topic{card.submittedBy ? ` by ${card.submittedBy}` : ''}
        </span>
      )}
      <span className="spectrum-chip spectrum-right">{card.right} ➡</span>
    </div>
  );
}

function LockDots({ locked, needed }: { locked: number; needed: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      {Array.from({ length: needed }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full transition-colors ${
            i < locked ? 'bg-amber-400 shadow-[0_0_6px_rgba(229,166,46,0.8)]' : 'bg-slate-600'
          }`}
        />
      ))}
    </span>
  );
}

function Leaderboard({ view }: { view: RoomView }) {
  const medals = ['🥇', '🥈', '🥉'];
  const rows = view.players
    .map((p) => ({ p, score: view.partyScores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
      {rows.map(({ p, score }, i) => (
        <span
          key={p.id}
          className={`flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 shadow-sm ${
            p.connected ? '' : 'opacity-40'
          } ${p.id === view.you.id ? 'ring-1 ring-amber-400/70' : ''}`}
        >
          {medals[i] && score > 0 ? `${medals[i]} ` : ''}
          <span style={{ color: colorOf(view, p.id) }}>●</span>
          {p.isPsychic && '⭐'}
          {p.isHost && '👑'}
          {p.name}
          <b className="ml-1">{score}</b>
        </span>
      ))}
    </div>
  );
}

function PartyHeader({ view }: { view: RoomView }) {
  const author = view.players.find((p) => p.id === view.party?.authorId);
  return (
    <div className="card-panel space-y-2 py-3">
      <div className="text-center text-sm text-slate-400">
        {view.phase === 'authoring'
          ? '✍️ Everyone is writing their clues…'
          : view.phase === 'gameover'
            ? '🏁 Game over — final standings'
            : view.party
              ? `Dial ${view.party.dialNumber} of ${view.party.totalDials}`
              : ''}
        {author && view.phase !== 'authoring' && view.phase !== 'gameover' && (
          <span>
            {' '}
            · ⭐ <b className="text-slate-200">{author.name}</b>&apos;s clue
          </span>
        )}
      </div>
      <Leaderboard view={view} />
    </div>
  );
}

function AuthoringPanel({ view, actions }: PV) {
  const a = view.authoring;
  if (!a) return null;

  if (a.yourCard) {
    const c = a.yourCard;
    return (
      <div className="card-panel space-y-3">
        <Tip id="party-author">
          You&apos;re writing {c.total} clue{c.total > 1 ? 's' : ''}, one per spectrum. Only you can
          see this target zone. Give a clue — a word or short phrase — that sits exactly where the
          bullseye is. Later everyone else will guess your dials, and you earn the average of their
          points, so clear clues pay off!
        </Tip>
        <div className="text-center text-sm text-slate-400">
          🤫 Your card {c.index} of {c.total} — only you can see this target
        </div>
        <Dial value={90} showPointer={false} target={c.target} interactive={false} />
        <SpectrumLabels card={c.card} />
        <ClueForm key={c.index} onSubmit={actions.authorClue} />
      </div>
    );
  }

  return (
    <div className="card-panel space-y-2 text-center">
      {a.participating ? (
        <div className="text-xl font-bold">✅ Your clues are in!</div>
      ) : (
        <div className="text-xl font-bold">👋 You joined mid-setup</div>
      )}
      <p className="text-sm text-slate-400">
        {a.participating
          ? `${a.doneCount}/${a.totalAuthors} players ready`
          : "You'll jump in as a guesser once the clues are written."}
        {a.waitingFor.length > 0 && ` — waiting for ${a.waitingFor.join(', ')}`}
      </p>
    </div>
  );
}

function GuessingPanel({ view, actions }: PV) {
  const [val, setVal] = useState(90);
  const p = view.party;
  if (!p) return null;
  const isAuthor = p.authorId === view.you.id;
  const locked = p.yourGuess !== null;
  const shown = locked ? p.yourGuess! : val;
  const author = view.players.find((pl) => pl.id === p.authorId);

  const move = (v: number) => {
    setVal(v);
    actions.partyMovePointer(v);
  };

  const nameOf = (pid: string) => view.players.find((pl) => pl.id === pid)?.name ?? '?';
  const liveMarkers = Object.entries(p.liveGuesses ?? {}).map(([pid, v]) => ({
    value: v,
    label: `${nameOf(pid).slice(0, 8)}${p.lockedIds?.includes(pid) ? ' 🔒' : ''}`,
    color: colorOf(view, pid),
  }));

  return (
    <div className="card-panel space-y-3">
      <div className="text-center">
        <div className="clue-text">&ldquo;{view.clue}&rdquo;</div>
        <div className="clue-sub mt-1">clue by {author?.name ?? '?'}</div>
      </div>

      {isAuthor ? (
        <>
          <Tip id="party-author-watch">
            Only you can see this: every needle is a player&apos;s live guess, updating as they
            drag. A 🔒 means they&apos;ve locked in. No peeking rules needed — they can&apos;t see
            each other!
          </Tip>
          <Dial
            value={90}
            showPointer={false}
            target={view.target}
            markers={liveMarkers}
            interactive={false}
          />
          <SpectrumLabels card={view.card} />
          <div className="flex flex-wrap items-center justify-center gap-2 text-slate-300">
            <span>🤐 Your dial — watch everyone home in live.</span>
            <LockDots locked={p.lockedCount} needed={p.neededCount} />
            <span className="text-sm text-slate-400">
              {p.lockedCount}/{p.neededCount} locked
            </span>
          </div>
        </>
      ) : (
        <>
          <Tip id="party-guess">
            Drag the dial to where the clue sits on this spectrum. Everyone guesses on their own
            dial — nobody can see yours. The closer you land to the hidden bullseye, the more points
            you score (4 / 3 / 2 / 0).
          </Tip>
          <Dial
            value={shown}
            target={null}
            interactive={!locked}
            locked={locked}
            onChange={move}
            onCommit={move}
          />
          <SpectrumLabels card={view.card} />
          {locked ? (
            <div className="flex flex-wrap items-center justify-center gap-2 text-slate-300">
              <span>🔒 Locked at {p.yourGuess}° — waiting for the rest</span>
              <LockDots locked={p.lockedCount} needed={p.neededCount} />
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <div className="flex items-center justify-center gap-2">
                {[-5, -1, +1, +5].map((n) => (
                  <button
                    key={n}
                    className="btn btn-ghost h-11 w-11 rounded-full p-0 text-base font-bold"
                    onClick={() => move(clampDial(shown + n))}
                  >
                    {n > 0 ? `+${n}` : n}
                  </button>
                ))}
                <span className="w-14 font-mono text-sm font-bold text-amber-300">{shown}°</span>
              </div>
              <button
                className="btn btn-primary px-10 py-3 text-lg"
                onClick={() => actions.partyLock(shown)}
              >
                🔒 Lock in {shown}°
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RevealPanel({ view, actions }: PV) {
  const res = view.partyLastResult;
  if (!res) return null;
  const markers = res.guesses.map((g) => ({
    value: g.value,
    label: g.name.slice(0, 8),
    color: colorOf(view, g.playerId),
  }));
  const canAdvance = view.you.isHost || view.you.id === res.authorId;
  const isLast = res.dialNumber >= res.totalDials;

  return (
    <div className="card-panel space-y-3">
      <div className="text-center">
        <div className="clue-text">&ldquo;{res.clue}&rdquo;</div>
        <div className="clue-sub mt-1">
          by {res.authorName} — the target was at {res.target}°
        </div>
      </div>
      <Dial value={90} showPointer={false} target={res.target} markers={markers} interactive={false} />
      <SpectrumLabels card={res.card} />

      <ul className="mx-auto w-full max-w-sm space-y-1 text-sm">
        {res.guesses.map((g) => (
          <li key={g.playerId} className="flex justify-between">
            <span>
              <span style={{ color: colorOf(view, g.playerId) }}>●</span> {g.name} — {g.value}°
            </span>
            <b>
              {g.points === 4 ? '🎯 ' : ''}+{g.points}
            </b>
          </li>
        ))}
        {res.guesses.length === 0 && (
          <li className="text-center text-slate-400">Nobody locked in a guess this round.</li>
        )}
        <li className="flex justify-between border-t border-slate-700 pt-1 text-slate-300">
          <span>✍️ {res.authorName} (clue writer)</span>
          <b>+{res.authorPoints}</b>
        </li>
      </ul>

      <Tip id="party-scoring">
        Guessers score by wedge: 4 in the bullseye, then 3, 2, and 0 outside the zone. The clue
        writer earns the average of everyone&apos;s points.
      </Tip>

      {view.phase === 'reveal' && (
        <div className="text-center">
          {canAdvance ? (
            <button className="btn btn-primary px-8" onClick={actions.nextRound}>
              {isLast ? '🏆 Final results' : 'Next dial ▶'}
            </button>
          ) : (
            <p className="text-sm text-slate-400">Waiting for {res.authorName} or the host…</p>
          )}
        </div>
      )}
    </div>
  );
}

function GameOverOverlay({ view, actions, onDismiss }: PV & { onDismiss: () => void }) {
  const medals = ['🥇', '🥈', '🥉'];
  const rows = view.players
    .map((p) => ({ p, score: view.partyScores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));
  const top = rows[0]?.score ?? 0;
  const winners = rows.filter((r) => r.score === top && top > 0);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div className="card-panel w-full max-w-md space-y-4 text-center">
        <div className="text-5xl">🏆</div>
        <h2 className="text-3xl font-black text-amber-300">
          {winners.length === 0
            ? 'Game over!'
            : `${winners.map((w) => w.p.name).join(' & ')} win${winners.length === 1 ? 's' : ''}!`}
        </h2>
        <ul className="mx-auto w-full max-w-xs space-y-1 text-left text-sm">
          {rows.map(({ p, score }, i) => (
            <li key={p.id} className="flex justify-between">
              <span>
                {medals[i] ?? '·'} <span style={{ color: colorOf(view, p.id) }}>●</span> {p.name}
                {p.id === view.you.id && ' (you)'}
              </span>
              <b>{score}</b>
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-400">{view.partyHistory.length} dials played</p>
        {view.you.isHost ? (
          <button className="btn btn-primary" onClick={actions.rematch}>
            🔁 Rematch (back to lobby)
          </button>
        ) : (
          <p className="text-sm text-slate-400">Waiting for the host to start a rematch…</p>
        )}
        <button className="btn btn-ghost text-sm" onClick={onDismiss}>
          View the final board
        </button>
      </div>
    </div>
  );
}

export default function PartyGame() {
  const { view, actions } = useGame();
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const phase = view?.phase;
  useEffect(() => {
    setOverlayDismissed(false);
  }, [phase]);

  if (!view) return null;

  return (
    <div className="space-y-4">
      <PartyHeader view={view} />
      {view.phase === 'authoring' && <AuthoringPanel view={view} actions={actions} />}
      {view.phase === 'guessing' && view.party && (
        <GuessingPanel key={view.party.dialNumber} view={view} actions={actions} />
      )}
      {(view.phase === 'reveal' || view.phase === 'gameover') && (
        <RevealPanel view={view} actions={actions} />
      )}
      <HistoryPanel view={view} />
      {view.phase === 'gameover' &&
        (overlayDismissed ? (
          <button
            className="btn btn-primary fixed bottom-4 right-4 z-30"
            onClick={() => setOverlayDismissed(false)}
          >
            🏆 Results
          </button>
        ) : (
          <GameOverOverlay view={view} actions={actions} onDismiss={() => setOverlayDismissed(true)} />
        ))}
    </div>
  );
}
