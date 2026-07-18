import { useState, type FormEvent } from 'react';
import {
  DEFAULT_CLUES_PER_PLAYER,
  DEFAULT_TARGET_SCORE,
  MAX_NAME_LEN,
} from '../../../shared/constants';
import { wedgeRanges } from '../../../shared/game';
import { DECKS } from '../../../shared/topics';
import type { GameSettings } from '../../../shared/types';
import { polar, sectorPath } from '../dialMath';
import { useGame } from '../useGame';
import SettingsForm from './SettingsForm';

const WEDGE_COLORS: Record<number, string> = { 4: '#f59e0b', 3: '#2dd4bf', 2: '#60a5fa' };

function DialArt() {
  const target = 112;
  const needle = 78;
  const CX = 260;
  const CY = 272;
  const R = 228;
  const [nx, ny] = polar(CX, CY, R - 8, needle);
  return (
    <svg viewBox="0 0 520 300" className="w-full max-w-md drop-shadow-2xl" aria-hidden>
      {[252, 278, 304].map((r, i) => (
        <path
          key={r}
          d={`M ${CX - r} ${CY} A ${r} ${r} 0 0 1 ${CX + r} ${CY}`}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={2}
          strokeDasharray="3 12"
          opacity={0.5 - i * 0.14}
        />
      ))}
      <path
        d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY} Z`}
        fill="#1e293b"
        stroke="#334155"
        strokeWidth={3}
      />
      {wedgeRanges(target).map((w, i) => (
        <path
          key={i}
          d={sectorPath(CX, CY, w.from, w.to, 38, R - 6)}
          fill={WEDGE_COLORS[w.points]}
          opacity={0.95}
          stroke="#0f172a"
          strokeWidth={2}
        />
      ))}
      <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="#fbbf24" strokeWidth={6} strokeLinecap="round" />
      <circle cx={CX} cy={CY} r={14} fill="#0f172a" stroke="#fbbf24" strokeWidth={4} />
      <line
        x1={CX - R - 18}
        y1={CY}
        x2={CX + R + 18}
        y2={CY}
        stroke="#475569"
        strokeWidth={4}
        strokeLinecap="round"
      />
    </svg>
  );
}

function Waves() {
  const wavePath =
    'M0 70 Q 75 30 150 70 T 300 70 T 450 70 T 600 70 T 750 70 T 900 70 T 1050 70 T 1200 70 V 120 H 0 Z';
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 overflow-hidden">
      <svg
        className="animate-wave-slow absolute bottom-0 h-32 w-[200%]"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
      >
        <path d={wavePath} fill="#312e81" opacity={0.4} />
      </svg>
      <svg
        className="animate-wave-fast absolute -bottom-3 h-32 w-[200%]"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
      >
        <path d={wavePath} fill="#0ea5e9" opacity={0.15} />
      </svg>
    </div>
  );
}

export default function JoinPage({ onRules }: { onRules: () => void }) {
  const { actions } = useGame();
  const [tab, setTab] = useState<'join' | 'create'>('join');
  const [code, setCode] = useState(
    (new URLSearchParams(location.search).get('room') ?? '').toUpperCase(),
  );
  const [name, setName] = useState(sessionStorage.getItem('wl-name') ?? '');
  const [tutorial, setTutorial] = useState(false);
  const [settings, setSettings] = useState<GameSettings>({
    mode: 'party',
    targetScore: DEFAULT_TARGET_SCORE,
    cluesPerPlayer: DEFAULT_CLUES_PER_PLAYER,
    decks: DECKS.map((d) => d.id),
    topicSource: 'mix',
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    if (tab === 'join') await actions.join(code, name.trim(), tutorial);
    else await actions.create(name.trim(), tutorial, settings);
    setBusy(false);
  };

  const tabCls = (active: boolean) =>
    `cursor-pointer rounded-lg py-2 text-center font-semibold transition-colors ${
      active ? 'bg-amber-500 text-slate-900' : 'text-slate-300 hover:bg-slate-700/60'
    }`;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.14),transparent_55%)]" />
      <Waves />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-8 px-4 py-10 lg:flex-row lg:gap-14">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <DialArt />
          <h1 className="mt-4 text-5xl font-black tracking-tight">Wavelength</h1>
          <p className="mt-2 text-slate-400">
            Read your team&apos;s mind on a spectrum. Give the clue, find the bullseye.
          </p>
          <button className="btn btn-ghost mt-3 text-sm" onClick={onRules}>
            📖 How to play
          </button>
        </div>

        <div className="card-panel w-full max-w-md">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-900/60 p-1">
            <button type="button" className={tabCls(tab === 'join')} onClick={() => setTab('join')}>
              Join Game
            </button>
            <button
              type="button"
              className={tabCls(tab === 'create')}
              onClick={() => setTab('create')}
            >
              Create Game
            </button>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Your name</span>
              <input
                className="input"
                maxLength={MAX_NAME_LEN}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Casey"
                required
              />
            </label>

            {tab === 'join' ? (
              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Room code</span>
                <input
                  className="input font-mono text-lg uppercase tracking-[0.3em]"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABCD"
                  required
                />
              </label>
            ) : (
              <SettingsForm value={settings} onChange={setSettings} />
            )}

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-amber-500"
                checked={tutorial}
                onChange={(e) => setTutorial(e.target.checked)}
              />
              First time playing? Show me tutorial tips
            </label>

            <button
              className="btn btn-primary w-full text-lg"
              disabled={busy || !name.trim() || (tab === 'join' && !code.trim())}
            >
              {busy ? '…' : tab === 'join' ? 'Join room' : 'Create room'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
