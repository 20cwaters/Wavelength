import { useEffect, useState } from 'react';
import { MAX_CLUE_LEN } from '../../../shared/constants';
import { clampDial } from '../../../shared/game';
import type { RoomView, Team } from '../../../shared/types';
import { teamBg, teamName, teamText } from '../ui';
import { useGame, type GameActions } from '../useGame';
import Dial from './Dial';
import HistoryPanel from './HistoryPanel';
import Tip from './TutorialTip';

interface PV {
  view: RoomView;
  actions: GameActions;
}

function TeamScore({ team, view }: { team: Team; view: RoomView }) {
  const active = view.psychicTeam === team && view.phase !== 'gameover';
  return (
    <div
      className={`flex-1 rounded-2xl border px-4 py-2 text-center ${teamBg(team)} ${
        active ? 'ring-2 ring-amber-400/70' : ''
      }`}
    >
      <div className={`text-sm font-semibold ${teamText(team)}`}>Team {teamName(team)}</div>
      <div className="text-3xl font-black">{view.scores[team]}</div>
    </div>
  );
}

function ScoreBar({ view }: { view: RoomView }) {
  const psychic = view.players.find((p) => p.id === view.psychicId);
  return (
    <div className="flex items-stretch gap-3">
      <TeamScore team="red" view={view} />
      <div className="flex flex-1 flex-col items-center justify-center text-center text-sm">
        <div className="text-slate-400">
          Round {view.round} · First to {view.settings.targetScore}
        </div>
        {psychic && (
          <div className="font-semibold">
            ⭐ Psychic: <span className={psychic.team ? teamText(psychic.team) : ''}>{psychic.name}</span>
          </div>
        )}
      </div>
      <TeamScore team="blue" view={view} />
    </div>
  );
}

function Roster({ view, actions }: PV) {
  const spectators = view.players.filter((p) => p.team === null);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
      {(['red', 'blue'] as Team[]).map((t) => (
        <div
          key={t}
          className={`flex flex-wrap items-center gap-1 rounded-xl border px-2 py-1 ${teamBg(t)}`}
        >
          <span className={`font-bold ${teamText(t)}`}>{teamName(t)}:</span>
          {view.players
            .filter((p) => p.team === t)
            .map((p) => (
              <span
                key={p.id}
                className={`rounded-lg bg-slate-900/40 px-2 py-0.5 ${p.connected ? '' : 'opacity-40'}`}
                title={p.connected ? undefined : 'disconnected'}
              >
                {p.isPsychic && '⭐'}
                {p.isHost && '👑'}
                {p.name}
                {p.id === view.you.id && ' (you)'}
              </span>
            ))}
        </div>
      ))}
      {spectators.length > 0 && (
        <span className="text-slate-500">Watching: {spectators.map((p) => p.name).join(', ')}</span>
      )}
      {view.you.team === null && (
        <span className="flex items-center gap-1">
          Join:
          <button className="btn btn-ghost px-2 py-0.5 text-rose-300" onClick={() => actions.setTeam('red')}>
            Red
          </button>
          <button className="btn btn-ghost px-2 py-0.5 text-sky-300" onClick={() => actions.setTeam('blue')}>
            Blue
          </button>
        </span>
      )}
    </div>
  );
}

export function ClueForm({ onSubmit }: { onSubmit: (clue: string) => void }) {
  const [clue, setClue] = useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (clue.trim()) onSubmit(clue.trim());
      }}
    >
      <input
        className="input flex-1"
        maxLength={MAX_CLUE_LEN}
        value={clue}
        onChange={(e) => setClue(e.target.value)}
        placeholder="Your one clue… a word or short phrase"
        autoFocus
      />
      <button type="submit" className="btn btn-primary" disabled={!clue.trim()}>
        Give clue
      </button>
    </form>
  );
}

function GuessControls({ view, actions }: PV) {
  return (
    <div className="space-y-3 text-center">
      <Tip id="guess">
        Drag the dial (or tap the arc) to where the clue points on the spectrum. Everyone on your
        team can move it and it syncs live — talk it out! Use the +/− buttons for fine-tuning, and
        lock in when you all agree.
      </Tip>
      <div className="flex items-center justify-center gap-2">
        {[-5, -1, +1, +5].map((n) => (
          <button
            key={n}
            className="btn btn-ghost px-3"
            onClick={() => actions.commitPointer(clampDial(view.pointer + n))}
          >
            {n > 0 ? `+${n}` : n}
          </button>
        ))}
        <span className="w-16 text-sm text-slate-400">{view.pointer}°</span>
      </div>
      <button className="btn btn-primary px-8 text-lg" onClick={actions.lockGuess}>
        🔒 Lock in guess
      </button>
    </div>
  );
}

function BonusPanel({ view, actions }: PV) {
  const b = view.bonus;
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? '?';
  return (
    <div className="space-y-3 text-center">
      <Tip id="bonus">
        Steal a point! If your team correctly guesses which side of their locked pointer the real
        target is on, you score +1 (unless they hit the bullseye). Majority vote decides — a tie
        means no guess.
      </Tip>
      <div className="font-semibold">Where is the real target?</div>
      <div className="flex justify-center gap-3">
        <button
          className={`btn px-6 text-lg ${b?.yourVote === 'left' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => actions.voteBonus('left')}
        >
          ⬅ Left of pointer
        </button>
        <button
          className={`btn px-6 text-lg ${b?.yourVote === 'right' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => actions.voteBonus('right')}
        >
          Right of pointer ➡
        </button>
      </div>
      {b && (
        <div className="text-sm text-slate-400">
          {b.voted}/{b.needed} votes in
          {b.votes && Object.keys(b.votes).length > 0 && (
            <span>
              {' — '}
              {Object.entries(b.votes)
                .map(([id, s]) => `${nameOf(id)}: ${s}`)
                .join(', ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function RevealPanel({ view, actions }: PV) {
  const res = view.lastResult;
  if (!res) return null;
  const canAdvance = view.you.isHost || view.you.isPsychic;

  let bonusLine: string | null = null;
  if (!res.skipped) {
    if (res.bonusTeam === null) bonusLine = 'Solo round — no bonus guess.';
    else if (res.bonusAwarded)
      bonusLine = `+1 bonus for Team ${teamName(res.bonusTeam)} — the target really was ${res.bonusSide} of the pointer!`;
    else if (res.points === 4 && res.bonusSide !== null && res.bonusSide === res.bonusCorrectSide)
      bonusLine = 'The opposing team called the side right, but bullseyes block the bonus point.';
    else if (res.bonusSide === null) bonusLine = 'The opposing team cast no deciding vote — no bonus.';
    else
      bonusLine = `Bonus guess missed — they said ${res.bonusSide}, but the target was ${
        res.bonusCorrectSide ?? 'dead center'
      }.`;
  }

  return (
    <div className="space-y-3 text-center">
      {res.skipped ? (
        <div className="text-xl font-bold">⏭ Round skipped — no points scored</div>
      ) : (
        <>
          <div className="text-3xl font-black">
            {res.points === 4
              ? '🎯 Bullseye! 4 points!'
              : res.points > 0
                ? `${res.points} points!`
                : '💨 Missed the zone'}
          </div>
          <p className="text-slate-300">
            Team {teamName(res.psychicTeam)} guessed {res.guess}° — the target was at {res.target}°.
          </p>
          {bonusLine && <p className="text-slate-300">{bonusLine}</p>}
        </>
      )}
      {view.winner && (
        <p className={`text-xl font-bold ${teamText(view.winner)}`}>
          🏁 Team {teamName(view.winner)} reached {view.settings.targetScore} points!
        </p>
      )}
      {!view.winner &&
        view.scores.red === view.scores.blue &&
        view.scores.red >= view.settings.targetScore && (
          <p className="font-semibold text-amber-300">
            Tied at {view.scores.red} — sudden death, keep playing!
          </p>
        )}
      <Tip id="scoring">
        Scoring: the bullseye wedge is worth 4 points, the next wedges out 3, then 2, and anything
        outside the zone scores nothing. The colored zone on the dial shows exactly where the target
        was.
      </Tip>
      {view.phase === 'reveal' &&
        (canAdvance ? (
          <button className="btn btn-primary px-8" onClick={actions.nextRound}>
            {view.winner ? '🏆 See final results' : 'Next round ▶'}
          </button>
        ) : (
          <p className="text-sm text-slate-400">Waiting for the host or Psychic to continue…</p>
        ))}
    </div>
  );
}

function PhasePanel({ view, actions }: PV) {
  const role = view.you.role;
  const psychicName = view.players.find((p) => p.id === view.psychicId)?.name ?? 'the Psychic';

  switch (view.phase) {
    case 'clue':
      if (role === 'psychic')
        return (
          <div>
            <Tip id="psychic-clue">
              You&apos;re the Psychic! Only you can see the colored target zone on the dial. Give
              one clue — a word or short phrase — that sits right where the bullseye is on this
              spectrum. No numbers, no &ldquo;left of center&rdquo; hints. After that, your job is
              silence.
            </Tip>
            <ClueForm onSubmit={actions.submitClue} />
          </div>
        );
      return (
        <div className="text-center text-slate-300">
          <Tip id="wait-clue">
            The Psychic secretly sees where the target is. Once they give a clue, the spectrum is
            revealed and their team moves the dial to match it.
          </Tip>
          🧠 Waiting for {psychicName} to give a clue…
        </div>
      );

    case 'guessing':
      if (role === 'guesser') return <GuessControls view={view} actions={actions} />;
      if (role === 'psychic')
        return (
          <div className="text-center text-slate-300">
            <Tip id="psychic-wait">
              Poker face! You can watch the dial move, but you can&apos;t say anything beyond the
              clue you already gave.
            </Tip>
            🤐 Your team is deliberating. Stay mysterious.
          </div>
        );
      return (
        <div className="text-center text-slate-300">
          👀 The {view.psychicTeam ? teamName(view.psychicTeam) : ''} team is guessing…
          {!view.soloRound && ' Your left/right bonus guess comes next.'}
        </div>
      );

    case 'bonus':
      if (role === 'opponent') return <BonusPanel view={view} actions={actions} />;
      return (
        <div className="text-center text-slate-300">
          🎲 The opposing team is guessing which side of the pointer the target is on…
        </div>
      );

    case 'reveal':
    case 'gameover':
      return <RevealPanel view={view} actions={actions} />;

    default:
      return null;
  }
}

function GameOverOverlay({ view, actions, onDismiss }: PV & { onDismiss: () => void }) {
  const winner = view.winner;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div className="card-panel w-full max-w-md space-y-4 text-center">
        <div className="text-5xl">🏆</div>
        <h2 className={`text-3xl font-black ${winner ? teamText(winner) : ''}`}>
          Team {winner ? teamName(winner) : '—'} wins!
        </h2>
        <div className="flex justify-center gap-6 text-xl font-bold">
          <span className="text-rose-400">Red {view.scores.red}</span>
          <span className="text-sky-400">Blue {view.scores.blue}</span>
        </div>
        <p className="text-sm text-slate-400">{view.history.length} rounds played</p>
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

export default function Game() {
  const { view, actions } = useGame();
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const phase = view?.phase;
  useEffect(() => {
    setOverlayDismissed(false);
  }, [phase]);

  if (!view) return null;
  const role = view.you.role;
  const psychicName = view.players.find((p) => p.id === view.psychicId)?.name ?? 'the Psychic';
  const interactive = view.phase === 'guessing' && role === 'guesser' && !view.locked;

  return (
    <div className="space-y-4">
      <ScoreBar view={view} />
      <Roster view={view} actions={actions} />

      <div className="card-panel">
        {view.clue ? (
          <div className="mb-2 text-center">
            <div className="text-2xl font-bold text-amber-300">&ldquo;{view.clue}&rdquo;</div>
            <div className="text-xs text-slate-400">clue from {psychicName}</div>
          </div>
        ) : (
          view.phase === 'clue' && (
            <div className="mb-2 text-center text-sm text-slate-400">
              {role === 'psychic'
                ? '🤫 Only you can see the target zone below'
                : `${psychicName} is studying the spectrum…`}
            </div>
          )
        )}

        <Dial
          value={view.pointer}
          target={view.target}
          interactive={interactive}
          locked={view.locked}
          onChange={actions.movePointer}
          onCommit={actions.commitPointer}
        />

        <div className="mt-1 flex items-start justify-between gap-4 text-sm font-semibold">
          {view.card ? (
            <>
              <span className="max-w-[45%] rounded-lg bg-sky-500/15 px-2 py-1 text-sky-300">
                ⬅ {view.card.left}
              </span>
              {view.card.deck === 'custom' && (
                <span className="self-center text-xs font-normal text-slate-500">
                  custom topic{view.card.submittedBy ? ` by ${view.card.submittedBy}` : ''}
                </span>
              )}
              <span className="max-w-[45%] rounded-lg bg-rose-500/15 px-2 py-1 text-right text-rose-300">
                {view.card.right} ➡
              </span>
            </>
          ) : (
            <span className="mx-auto text-slate-500">
              🔒 Spectrum hidden until the Psychic gives their clue
            </span>
          )}
        </div>

        <div className="mt-4">
          <PhasePanel key={`${view.round}-${view.phase}`} view={view} actions={actions} />
        </div>
      </div>

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
