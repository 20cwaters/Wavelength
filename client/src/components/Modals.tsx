import { useState, type FormEvent, type ReactNode } from 'react';
import { MAX_TOPIC_LEN, WEDGE_WIDTH } from '../../../shared/constants';
import { useGame } from '../useGame';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="card-panel max-h-[85vh] w-full max-w-lg overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn btn-ghost px-2 py-1" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function RulesModal({ onClose }: { onClose: () => void }) {
  const half = WEDGE_WIDTH / 2;
  return (
    <Modal title="📖 How to play" onClose={onClose}>
      <div className="space-y-4 text-sm text-slate-300">
        <section>
          <h3 className="mb-1 font-bold text-slate-100">Scoring (both modes)</h3>
          <ul className="space-y-1 pl-1">
            <li>
              🎯 Bullseye wedge (within {half}°): <b>4 points</b>
            </li>
            <li>
              Next wedge out (within {half + WEDGE_WIDTH}°): <b>3 points</b>
            </li>
            <li>
              Outer wedge (within {half + WEDGE_WIDTH * 2}°): <b>2 points</b>
            </li>
            <li>
              Outside the zone: <b>0 points</b>
            </li>
          </ul>
        </section>
        <section>
          <h3 className="mb-1 font-bold text-slate-100">🎉 Party mode (default)</h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              No teams! At the start, every player secretly writes a clue for a few dials — each
              with its own spectrum and hidden target that only they can see.
            </li>
            <li>
              The dials are shuffled, then come up one at a time. Everyone except the clue writer
              drags their <b>own private dial</b> to where they think the clue points and locks in.
            </li>
            <li>
              Reveal! Each guesser scores by how close they landed (4 / 3 / 2 / 0), and the clue
              writer earns the <b>average</b> of the guessers&apos; points — so clear clues pay off.
            </li>
            <li>Highest total after all dials wins.</li>
          </ol>
        </section>
        <section>
          <h3 className="mb-1 font-bold text-slate-100">⚔️ Teams mode (classic)</h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              One player is the <b>Psychic</b>. They secretly see a target zone on the dial, plus
              the round&apos;s spectrum, and give <b>one clue</b> — no numbers, no &ldquo;left /
              right&rdquo; hints.
            </li>
            <li>
              Their teammates move a shared dial (it syncs live for the whole team) and lock in.
            </li>
            <li>
              Before the reveal, the <b>opposing team</b> votes: is the true target <b>left</b> or{' '}
              <b>right</b> of the locked pointer? A correct majority call earns <b>+1</b> — unless
              the guessing team hit the bullseye. A tied vote counts as no guess.
            </li>
            <li>
              The Psychic role alternates between teams. First team to the winning score takes it;
              ties at the top go to sudden death. In 2-player games the other team moves the dial
              and the bonus guess is skipped.
            </li>
          </ol>
        </section>
      </div>
    </Modal>
  );
}

export function TopicModal({ onClose }: { onClose: () => void }) {
  const { view, actions } = useGame();
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await actions.addTopic(left, right);
    if (ok) {
      setLeft('');
      setRight('');
      setMsg('Added to the pool! Add another?');
    }
  };

  return (
    <Modal title="✏️ Custom topics" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-400">
        Add your own spectrum pair. It joins this room&apos;s shared pool (
        {view?.customTopicCount ?? 0} so far) and can come up in future rounds whenever the topic
        source includes custom topics.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            className="input"
            maxLength={MAX_TOPIC_LEN}
            placeholder="Left end (e.g. Overrated)"
            value={left}
            onChange={(e) => setLeft(e.target.value)}
          />
          <span className="text-slate-500">↔</span>
          <input
            className="input"
            maxLength={MAX_TOPIC_LEN}
            placeholder="Right end (e.g. Underrated)"
            value={right}
            onChange={(e) => setRight(e.target.value)}
          />
        </div>
        {msg && <p className="text-sm text-emerald-400">{msg}</p>}
        <button className="btn btn-primary w-full" type="submit">
          Add to pool
        </button>
      </form>
    </Modal>
  );
}
