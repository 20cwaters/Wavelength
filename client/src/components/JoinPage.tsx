import { useState, type FormEvent } from 'react';
import {
  DEFAULT_CLUES_PER_PLAYER,
  DEFAULT_TARGET_SCORE,
  MAX_NAME_LEN,
} from '../../../shared/constants';
import { wedgeRanges } from '../../../shared/game';
import { DECKS } from '../../../shared/topics';
import type { GameSettings } from '../../../shared/types';
import { sectorPath } from '../dialMath';
import { useGame } from '../useGame';
import SettingsForm from './SettingsForm';

/** Box-art palette, in band order. */
const BAND_COLORS = ['#e8613c', '#f0a184', '#e9dcb8', '#8faf3e', '#3d7a3f', '#45b5e0', '#2a2019'];
const WEDGE_COLORS: Record<number, string> = { 4: '#e8613c', 3: '#e5a62e', 2: '#45b5e0' };

/** Radiating concentric bands rising from the bottom — the box's signature
 *  motif. The viewBox is tall enough to contain every ring (no hard clipping)
 *  and the rings fade as they radiate outward. */
function RetroBands() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center overflow-hidden"
      aria-hidden
    >
      <svg viewBox="0 0 1400 620" className="w-[1400px] max-w-none" preserveAspectRatio="xMidYMax meet">
        {Array.from({ length: 13 }, (_, i) => {
          const r = 140 + i * 36;
          return (
            <path
              key={i}
              d={`M ${700 - r} 620 A ${r} ${r} 0 0 1 ${700 + r} 620`}
              fill="none"
              stroke={BAND_COLORS[i % BAND_COLORS.length]}
              strokeWidth={30}
              strokeOpacity={0.38 - i * 0.022}
            />
          );
        })}
      </svg>
    </div>
  );
}

function DialArt() {
  const target = 112;
  const needle = 78;
  const CX = 260;
  const CY = 272;
  const R = 228;
  const rad = ((180 - needle) * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = -Math.sin(rad);
  const px = -uy;
  const py = ux;
  const tipX = CX + (R - 8) * ux;
  const tipY = CY + (R - 8) * uy;
  const needlePoints = `${CX + 6 * px},${CY + 6 * py} ${tipX + 1.5 * px},${tipY + 1.5 * py} ${
    tipX - 1.5 * px
  },${tipY - 1.5 * py} ${CX - 6 * px},${CY - 6 * py}`;

  return (
    <svg viewBox="0 0 520 300" className="w-full max-w-md drop-shadow-2xl" aria-hidden>
      {[252, 278, 304].map((r, i) => (
        <path
          key={r}
          d={`M ${CX - r} ${CY} A ${r} ${r} 0 0 1 ${CX + r} ${CY}`}
          fill="none"
          stroke={['#e8613c', '#e5a62e', '#45b5e0'][i]}
          strokeWidth={2.5}
          strokeDasharray="3 12"
          opacity={0.55 - i * 0.12}
        />
      ))}
      <path
        d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY} Z`}
        fill="#efe2bd"
        stroke="#241a10"
        strokeWidth={4}
      />
      {wedgeRanges(target).map((w, i) => (
        <path
          key={i}
          d={sectorPath(CX, CY, w.from, w.to, 38, R - 6)}
          fill={WEDGE_COLORS[w.points]}
          stroke="#241a10"
          strokeWidth={2}
        />
      ))}
      <polygon points={needlePoints} fill="#241a10" />
      <circle cx={CX} cy={CY} r={13} fill="#241a10" />
      <circle cx={CX} cy={CY} r={6} fill="#e5a62e" />
      <line
        x1={CX - R - 18}
        y1={CY}
        x2={CX + R + 18}
        y2={CY}
        stroke="#241a10"
        strokeWidth={5}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Stacked shrinking color bars — a classic 70s title underline. */
function RetroLines() {
  const bars = [
    { w: 220, c: '#e8613c' },
    { w: 176, c: '#e5a62e' },
    { w: 132, c: '#8faf3e' },
    { w: 88, c: '#45b5e0' },
    { w: 44, c: '#f0a184' },
  ];
  return (
    <div className="mt-3 flex flex-col items-center gap-1" aria-hidden>
      {bars.map((b) => (
        <span key={b.c} className="h-1 rounded-full" style={{ width: b.w, background: b.c }} />
      ))}
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
    `cursor-pointer rounded-lg py-2 text-center font-semibold uppercase tracking-wider text-sm transition-colors ${
      active ? 'bg-amber-500 text-slate-900' : 'text-slate-300 hover:bg-slate-700/60'
    }`;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(232,97,60,0.1),transparent_55%)]" />
      <RetroBands />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-8 px-4 py-10 lg:flex-row lg:gap-14">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <DialArt />
          <h1 className="brand-gradient mt-5 pl-[0.28em] text-3xl font-bold uppercase tracking-[0.28em] sm:text-4xl">
            Wavelength
          </h1>
          <RetroLines />
          <p className="mt-3 text-slate-400">
            Read your friends&apos; minds on a spectrum. Give the clue, find the bullseye.
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
