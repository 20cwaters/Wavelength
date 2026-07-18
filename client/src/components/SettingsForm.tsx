import {
  MAX_CLUES_PER_PLAYER,
  MAX_TARGET_SCORE,
  MIN_CLUES_PER_PLAYER,
  MIN_TARGET_SCORE,
} from '../../../shared/constants';
import { DECKS } from '../../../shared/topics';
import type { GameSettings, TopicSource } from '../../../shared/types';

const SOURCES: { id: TopicSource; label: string }[] = [
  { id: 'presets', label: 'Presets only' },
  { id: 'mix', label: 'Presets + custom' },
  { id: 'custom', label: 'Custom only' },
];

interface Props {
  value: GameSettings;
  onChange: (s: GameSettings) => void;
}

export default function SettingsForm({ value, onChange }: Props) {
  const toggleDeck = (id: string) => {
    const has = value.decks.includes(id);
    onChange({ ...value, decks: has ? value.decks.filter((d) => d !== id) : [...value.decks, id] });
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <span className="mb-1 block text-slate-300">Game mode</span>
        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="gameMode"
              className="mt-0.5 accent-amber-500"
              checked={value.mode === 'party'}
              onChange={() => onChange({ ...value, mode: 'party' })}
            />
            <span>
              🎉 <b>Party</b> — no teams. Everyone writes clues up front, then all guess each dial
              on their own.
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="gameMode"
              className="mt-0.5 accent-amber-500"
              checked={value.mode === 'teams'}
              onChange={() => onChange({ ...value, mode: 'teams' })}
            />
            <span>
              ⚔️ <b>Teams</b> — classic two-team play with one Psychic per round.
            </span>
          </label>
        </div>
      </div>

      {value.mode === 'party' ? (
        <label className="block">
          <span className="mb-1 block text-slate-300">Clues per player</span>
          <input
            type="number"
            className="input w-24"
            min={MIN_CLUES_PER_PLAYER}
            max={MAX_CLUES_PER_PLAYER}
            value={value.cluesPerPlayer}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange({ ...value, cluesPerPlayer: n });
            }}
          />
          <span className="ml-2 text-xs text-slate-500">
            total dials = players × clues per player
          </span>
        </label>
      ) : (
        <label className="block">
          <span className="mb-1 block text-slate-300">Winning score</span>
          <input
            type="number"
            className="input w-24"
            min={MIN_TARGET_SCORE}
            max={MAX_TARGET_SCORE}
            value={value.targetScore}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange({ ...value, targetScore: n });
            }}
          />
        </label>
      )}

      <div>
        <span className="mb-1 block text-slate-300">Topic decks</span>
        <div className="flex flex-wrap gap-2">
          {DECKS.map((d) => {
            const on = value.decks.includes(d.id);
            return (
              <button
                type="button"
                key={d.id}
                title={d.description}
                onClick={() => toggleDeck(d.id)}
                className={`cursor-pointer rounded-xl border px-3 py-1 transition-colors ${
                  on
                    ? 'border-amber-400/70 bg-amber-400/15 text-amber-200'
                    : 'border-slate-600 bg-slate-900/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                {d.name}
              </button>
            );
          })}
        </div>
        {value.decks.length === 0 && (
          <p className="mt-1 text-xs text-slate-500">No decks selected — all decks will be used.</p>
        )}
      </div>

      <div>
        <span className="mb-1 block text-slate-300">Topic source</span>
        <div className="flex flex-wrap gap-3">
          {SOURCES.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="topicSource"
                className="accent-amber-500"
                checked={value.topicSource === s.id}
                onChange={() => onChange({ ...value, topicSource: s.id })}
              />
              {s.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Anyone can submit custom topics before or during the game. “Custom only” falls back to
          presets until someone submits one.
        </p>
      </div>
    </div>
  );
}
