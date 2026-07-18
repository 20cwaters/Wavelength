import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { Server, type Socket } from 'socket.io';
import { MAX_NAME_LEN } from '../../shared/constants';
import type {
  AckRes,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../shared/types';
import { cleanStr, GameError, Room, RoomManager } from './rooms';

const app = express();
const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server);
const manager = new RoomManager();

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type AckFn = (r: AckRes) => void;

function broadcast(room: Room): void {
  for (const p of room.players) {
    if (!p.connected || !p.socketId) continue;
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.emit('state', room.viewFor(p.id));
  }
}

function errMsg(err: unknown): string {
  if (err instanceof GameError) return err.message;
  console.error(err);
  return 'Something went wrong';
}

io.on('connection', (socket: GameSocket) => {
  /** Wrap a room-scoped mutation: resolve context, run, ack, broadcast. */
  const handle =
    <P>(fn: (ctx: { room: Room; player: { id: string } }, payload: P) => void) =>
    (payload: P, ack?: AckFn) => {
      try {
        const ctx = manager.ctx(socket.id);
        fn(ctx, payload);
        if (typeof ack === 'function') ack({ ok: true });
        broadcast(ctx.room);
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: errMsg(err) });
      }
    };

  socket.on('room:create', (p, ack) => {
    try {
      const name = cleanStr(p?.name, MAX_NAME_LEN);
      if (!name) throw new GameError('Enter a name first');
      const key = cleanStr(p?.playerKey, 64);
      if (!key) throw new GameError('Missing player key — refresh and try again');
      const { room } = manager.create(key, name, !!p?.tutorial, socket.id, p?.settings);
      socket.join(room.code);
      if (typeof ack === 'function') ack({ ok: true, code: room.code });
      broadcast(room);
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: errMsg(err) });
    }
  });

  socket.on('room:join', (p, ack) => {
    try {
      const name = cleanStr(p?.name, MAX_NAME_LEN);
      const code = cleanStr(p?.code, 8);
      const key = cleanStr(p?.playerKey, 64);
      if (!code) throw new GameError('Enter a room code');
      if (!key) throw new GameError('Missing player key — refresh and try again');
      const { room } = manager.join(code, key, name, !!p?.tutorial, socket.id);
      socket.join(room.code);
      if (typeof ack === 'function') ack({ ok: true, code: room.code });
      broadcast(room);
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: errMsg(err) });
    }
  });

  socket.on('room:leave', () => {
    const room = manager.disconnect(socket.id);
    if (room) {
      socket.leave(room.code);
      broadcast(room);
    }
  });

  socket.on('team:set', handle((c, p: { team: unknown }) => c.room.setTeam(c.player.id, p?.team)));
  socket.on('settings:set', handle((c, p) => c.room.setSettings(c.player.id, p ?? {})));
  socket.on('tutorial:set', handle((c, p: { tutorial: boolean }) => c.room.setTutorial(c.player.id, !!p?.tutorial)));
  socket.on('game:start', handle((c) => c.room.start(c.player.id)));
  socket.on('clue:set', handle((c, p: { clue: unknown }) => c.room.submitClue(c.player.id, p?.clue)));
  socket.on('guess:lock', handle((c) => c.room.lockGuess(c.player.id)));
  socket.on('bonus:vote', handle((c, p: { side: unknown }) => c.room.voteBonus(c.player.id, p?.side)));
  socket.on('author:clue', handle((c, p: { clue: unknown }) => c.room.authorClue(c.player.id, p?.clue)));
  socket.on('party:lock', handle((c, p: { value: unknown }) => c.room.partyLock(c.player.id, Number(p?.value))));
  socket.on('round:next', handle((c) => c.room.nextRound(c.player.id)));
  socket.on('round:skip', handle((c) => c.room.skipRound(c.player.id)));
  socket.on('game:rematch', handle((c) => c.room.rematch(c.player.id)));

  socket.on('topic:add', (p, ack) => {
    try {
      const { room, player } = manager.ctx(socket.id);
      const count = room.addTopic(player.id, p?.left, p?.right);
      if (typeof ack === 'function') ack({ ok: true, count });
      broadcast(room);
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: errMsg(err) });
    }
  });

  // Fast path for live dial movement: light broadcast, no full state rebuild.
  socket.on('pointer:set', (p) => {
    try {
      const { room, player } = manager.ctx(socket.id);
      const v = Number(p?.value);
      if (!Number.isFinite(v)) return;
      room.setPointer(player.id, v);
      socket.to(room.code).emit('pointer', room.round!.pointer);
    } catch {
      // Ignore — pointer spam from stale clients is harmless.
    }
  });

  socket.on('disconnect', () => {
    const room = manager.disconnect(socket.id);
    if (room) broadcast(room);
  });
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, rooms: manager.size });
});

// In production the server serves the built client bundle (single Render service).
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('/', (_req, res) => {
    res
      .status(200)
      .send('Wavelength server is running. In dev, open the Vite client (npm run dev:client).');
  });
}

const port = Number(process.env.PORT) || 3001;
server.listen(port, () => {
  console.log(`Wavelength server listening on :${port}`);
});
