import { useState } from 'react';
import Game from './components/Game';
import JoinPage from './components/JoinPage';
import Lobby from './components/Lobby';
import PartyGame from './components/PartyGame';
import { RulesModal, TopicModal } from './components/Modals';
import RoomHeader from './components/RoomHeader';
import { useGame } from './useGame';

export default function App() {
  const { view, connected, toast } = useGame();
  const [showRules, setShowRules] = useState(false);
  const [showTopic, setShowTopic] = useState(false);

  return (
    <div className="app-bg min-h-screen text-slate-100">
      {view === null ? (
        <JoinPage onRules={() => setShowRules(true)} />
      ) : (
        <div className="mx-auto max-w-5xl px-3 pb-12">
          <RoomHeader onRules={() => setShowRules(true)} onTopic={() => setShowTopic(true)} />
          {view.phase === 'lobby' ? <Lobby /> : view.mode === 'party' ? <PartyGame /> : <Game />}
        </div>
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showTopic && view && <TopicModal onClose={() => setShowTopic(false)} />}

      {view && !connected && (
        <div className="fixed inset-x-0 top-0 z-50 bg-rose-600 py-1 text-center text-sm font-semibold">
          Reconnecting…
        </div>
      )}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
