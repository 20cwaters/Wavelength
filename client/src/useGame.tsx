import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AckRes, GameSettings, RoomView, Side, Team } from '../../shared/types';
import { socket } from './socket';

interface Session {
  code: string;
  name: string;
}

/** Per-tab identity: lets each browser tab act as a separate player while
 *  still surviving a page refresh (reconnect reclaims the same seat). */
function playerKey(): string {
  let k = sessionStorage.getItem('wl-key');
  if (!k) {
    k = crypto.randomUUID();
    sessionStorage.setItem('wl-key', k);
  }
  return k;
}

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem('wl-session');
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

const saveSession = (s: Session) => sessionStorage.setItem('wl-session', JSON.stringify(s));
const clearSession = () => sessionStorage.removeItem('wl-session');

function setRoomInUrl(code: string | null): void {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  history.replaceState(null, '', url);
}

export interface GameActions {
  create(name: string, tutorial: boolean, settings: Partial<GameSettings>): Promise<boolean>;
  join(code: string, name: string, tutorial: boolean): Promise<boolean>;
  leave(): void;
  setTeam(team: Team): void;
  setSettings(s: Partial<GameSettings>): void;
  setTutorial(on: boolean): void;
  start(): void;
  addTopic(left: string, right: string): Promise<boolean>;
  submitClue(clue: string): void;
  authorClue(clue: string): void;
  partyLock(value: number): void;
  movePointer(v: number): void;
  commitPointer(v: number): void;
  lockGuess(): void;
  voteBonus(side: Side): void;
  nextRound(): void;
  skipRound(): void;
  rematch(): void;
}

interface GameContextValue {
  view: RoomView | null;
  connected: boolean;
  toast: string | null;
  actions: GameActions;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const ackToast = useCallback(
    (r: AckRes) => {
      if (!r.ok) notify(r.error);
    },
    [notify],
  );

  useEffect(() => {
    const onState = (v: RoomView) => setView(v);
    const onPointer = (value: number) =>
      setView((prev) => (prev && !prev.locked ? { ...prev, pointer: value } : prev));
    const onConnect = () => {
      setConnected(true);
      const s = loadSession();
      if (s) {
        socket.emit(
          'room:join',
          { code: s.code, name: s.name, playerKey: playerKey(), tutorial: false },
          (r) => {
            if (!r.ok) {
              clearSession();
              setView(null);
            }
          },
        );
      }
    };
    const onDisconnect = () => setConnected(false);

    socket.on('state', onState);
    socket.on('pointer', onPointer);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) onConnect();
    return () => {
      socket.off('state', onState);
      socket.off('pointer', onPointer);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const create = useCallback(
    (name: string, tutorial: boolean, settings: Partial<GameSettings>) =>
      new Promise<boolean>((resolve) => {
        socket.emit('room:create', { name, playerKey: playerKey(), tutorial, settings }, (r) => {
          if (r.ok) {
            saveSession({ code: r.code, name });
            sessionStorage.setItem('wl-name', name);
            setRoomInUrl(r.code);
            resolve(true);
          } else {
            notify(r.error);
            resolve(false);
          }
        });
      }),
    [notify],
  );

  const join = useCallback(
    (code: string, name: string, tutorial: boolean) =>
      new Promise<boolean>((resolve) => {
        socket.emit(
          'room:join',
          { code: code.toUpperCase().trim(), name, playerKey: playerKey(), tutorial },
          (r) => {
            if (r.ok) {
              saveSession({ code: r.code, name });
              sessionStorage.setItem('wl-name', name);
              setRoomInUrl(r.code);
              resolve(true);
            } else {
              notify(r.error);
              resolve(false);
            }
          },
        );
      }),
    [notify],
  );

  const leave = useCallback(() => {
    socket.emit('room:leave');
    clearSession();
    setRoomInUrl(null);
    setView(null);
  }, []);

  // Live dial movement: optimistic local update plus a trailing 50ms throttle
  // so dragging doesn't flood the socket.
  const pendingPointer = useRef<number | null>(null);
  const pointerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPointer = useCallback(() => {
    if (pointerTimer.current) {
      clearTimeout(pointerTimer.current);
      pointerTimer.current = null;
    }
    if (pendingPointer.current !== null) {
      socket.emit('pointer:set', { value: pendingPointer.current });
      pendingPointer.current = null;
    }
  }, []);

  const movePointer = useCallback((v: number) => {
    setView((prev) => (prev ? { ...prev, pointer: v } : prev));
    pendingPointer.current = v;
    if (!pointerTimer.current) {
      pointerTimer.current = setTimeout(() => {
        pointerTimer.current = null;
        if (pendingPointer.current !== null) {
          socket.emit('pointer:set', { value: pendingPointer.current });
          pendingPointer.current = null;
        }
      }, 50);
    }
  }, []);

  const commitPointer = useCallback(
    (v: number) => {
      setView((prev) => (prev ? { ...prev, pointer: v } : prev));
      pendingPointer.current = v;
      flushPointer();
    },
    [flushPointer],
  );

  const addTopic = useCallback(
    (left: string, right: string) =>
      new Promise<boolean>((resolve) => {
        socket.emit('topic:add', { left, right }, (r) => {
          if (!r.ok) notify(r.error);
          resolve(r.ok);
        });
      }),
    [notify],
  );

  const actions: GameActions = {
    create,
    join,
    leave,
    addTopic,
    movePointer,
    commitPointer,
    setTeam: useCallback((team: Team) => socket.emit('team:set', { team }, ackToast), [ackToast]),
    setSettings: useCallback((s: Partial<GameSettings>) => socket.emit('settings:set', s, ackToast), [ackToast]),
    setTutorial: useCallback((on: boolean) => socket.emit('tutorial:set', { tutorial: on }, ackToast), [ackToast]),
    start: useCallback(() => socket.emit('game:start', ackToast), [ackToast]),
    submitClue: useCallback((clue: string) => socket.emit('clue:set', { clue }, ackToast), [ackToast]),
    authorClue: useCallback((clue: string) => socket.emit('author:clue', { clue }, ackToast), [ackToast]),
    partyLock: useCallback((value: number) => socket.emit('party:lock', { value }, ackToast), [ackToast]),
    lockGuess: useCallback(() => {
      flushPointer();
      socket.emit('guess:lock', ackToast);
    }, [flushPointer, ackToast]),
    voteBonus: useCallback((side: Side) => socket.emit('bonus:vote', { side }, ackToast), [ackToast]),
    nextRound: useCallback(() => socket.emit('round:next', ackToast), [ackToast]),
    skipRound: useCallback(() => socket.emit('round:skip', ackToast), [ackToast]),
    rematch: useCallback(() => socket.emit('game:rematch', ackToast), [ackToast]),
  };

  return (
    <GameContext.Provider value={{ view, connected, toast, actions }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
