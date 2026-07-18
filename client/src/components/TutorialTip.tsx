import { useState, type ReactNode } from 'react';
import { TUTORIAL_ROUNDS } from '../../../shared/constants';
import { useGame } from '../useGame';

/** Dismissible guided tip shown only to players who opted into tutorial mode,
 *  during the lobby and their first couple of rounds. Purely local — dismissing
 *  never touches shared game state. */
export default function Tip({ id, children }: { id: string; children: ReactNode }) {
  const { view } = useGame();
  const storageKey = `wl-tip-${id}`;
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(storageKey) === '1');

  if (!view || !view.you.tutorial || dismissed) return null;
  if (view.phase !== 'lobby' && view.round > TUTORIAL_ROUNDS) return null;

  return (
    <div className="my-2 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-left text-sm text-amber-100">
      <span aria-hidden>💡</span>
      <div className="flex-1">{children}</div>
      <button
        className="cursor-pointer opacity-60 hover:opacity-100"
        onClick={() => {
          sessionStorage.setItem(storageKey, '1');
          setDismissed(true);
        }}
        aria-label="Dismiss tip"
      >
        ✕
      </button>
    </div>
  );
}
