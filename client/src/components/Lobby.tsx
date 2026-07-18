import { TUTORIAL_ROUNDS } from '../../../shared/constants';
import { DECKS } from '../../../shared/topics';
import type { Team } from '../../../shared/types';
import { teamBg, teamName, teamText } from '../ui';
import { useGame } from '../useGame';
import SettingsForm from './SettingsForm';
import Tip from './TutorialTip';

const SOURCE_LABELS = { presets: 'Presets only', mix: 'Presets + custom', custom: 'Custom only' };

export default function Lobby() {
  const { view, actions } = useGame();
  if (!view) return null;
  const you = view.you;
  const party = view.settings.mode === 'party';
  const connectedCount = view.players.filter((p) => p.connected).length;
  const red = view.players.filter((p) => p.team === 'red');
  const blue = view.players.filter((p) => p.team === 'blue');
  const unassigned = view.players.filter((p) => p.team === null);
  const canStart = party
    ? connectedCount >= 2
    : red.some((p) => p.connected) && blue.some((p) => p.connected);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="card-panel text-center">
          <div className="text-sm text-slate-400">Room code</div>
          <div className="font-mono text-4xl font-black tracking-[0.35em]">{view.code}</div>
          <div className="mt-1 text-sm text-slate-400">
            Share the code, or copy the invite link from the top bar 🔗
          </div>
        </div>

        {party ? (
          <Tip id="lobby-party">
            Welcome! In party mode there are no teams. When the game starts, everyone secretly
            writes clues for a few dials. Then the dials come up one at a time and everybody else
            guesses where the clue points — closest guesses score the most. You&apos;ll see tips
            like this during your first {TUTORIAL_ROUNDS} dials.
          </Tip>
        ) : (
          <Tip id="lobby">
            Welcome! Pick a team below. Each round one player is the <b>Psychic</b>: they give a
            clue and their teammates move a dial to find a hidden target on a spectrum. You&apos;ll
            see tips like this during your first {TUTORIAL_ROUNDS} rounds.
          </Tip>
        )}

        {party ? (
          <div className="card-panel">
            <div className="mb-2 font-bold">🎉 Players ({view.players.length})</div>
            <ul className="space-y-1 text-sm">
              {view.players.map((p) => (
                <li key={p.id} className={p.connected ? '' : 'opacity-40'}>
                  {p.isHost && '👑 '}
                  {p.name}
                  {p.id === you.id && ' (you)'}
                  {!p.connected && ' (away)'}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['red', 'blue'] as Team[]).map((t) => {
                const members = t === 'red' ? red : blue;
                return (
                  <div key={t} className={`card-panel border ${teamBg(t)}`}>
                    <div className={`mb-2 font-bold ${teamText(t)}`}>Team {teamName(t)}</div>
                    <ul className="mb-3 min-h-16 space-y-1 text-sm">
                      {members.length === 0 && <li className="text-slate-500">Nobody yet…</li>}
                      {members.map((p) => (
                        <li key={p.id} className={p.connected ? '' : 'opacity-40'}>
                          {p.isHost && '👑 '}
                          {p.name}
                          {p.id === you.id && ' (you)'}
                        </li>
                      ))}
                    </ul>
                    {you.team !== t && (
                      <button
                        className="btn btn-ghost w-full text-sm"
                        onClick={() => actions.setTeam(t)}
                      >
                        Join {teamName(t)}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {unassigned.length > 0 && (
              <p className="text-sm text-slate-400">
                Not on a team yet: {unassigned.map((p) => p.name).join(', ')}
              </p>
            )}
          </>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 accent-amber-500"
            checked={you.tutorial}
            onChange={(e) => actions.setTutorial(e.target.checked)}
          />
          Tutorial mode: show me guided tips during my first rounds
        </label>
      </div>

      <div className="space-y-4">
        <div className="card-panel">
          <h3 className="mb-3 font-bold">
            ⚙️ Game settings{' '}
            {!you.isHost && <span className="text-xs font-normal text-slate-500">(host only)</span>}
          </h3>
          {you.isHost ? (
            <SettingsForm value={view.settings} onChange={(s) => actions.setSettings(s)} />
          ) : (
            <ul className="space-y-1 text-sm text-slate-300">
              <li>Mode: {party ? '🎉 Party (no teams)' : '⚔️ Teams (classic)'}</li>
              {party ? (
                <li>
                  <b>{view.settings.cluesPerPlayer}</b> clue
                  {view.settings.cluesPerPlayer === 1 ? '' : 's'} per player
                </li>
              ) : (
                <li>
                  First to <b>{view.settings.targetScore}</b> points
                </li>
              )}
              <li>
                Decks:{' '}
                {view.settings.decks.length === 0 || view.settings.decks.length === DECKS.length
                  ? 'All'
                  : view.settings.decks
                      .map((d) => DECKS.find((x) => x.id === d)?.name ?? d)
                      .join(', ')}
              </li>
              <li>Topics: {SOURCE_LABELS[view.settings.topicSource]}</li>
            </ul>
          )}
          <p className="mt-3 text-sm text-slate-400">
            ✏️ {view.customTopicCount} custom topic{view.customTopicCount === 1 ? '' : 's'} in the
            pool — anyone can add more from the top bar.
          </p>
        </div>

        <div className="card-panel">
          {you.isHost ? (
            <>
              <button
                className="btn btn-primary w-full text-lg"
                disabled={!canStart}
                onClick={actions.start}
              >
                ▶ Start game
              </button>
              {!canStart && (
                <p className="mt-2 text-center text-sm text-slate-400">
                  {party ? 'Need at least 2 players' : 'Each team needs at least one player'}
                </p>
              )}
            </>
          ) : (
            <p className="text-center text-sm text-slate-400">
              Waiting for the host to start the game…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
