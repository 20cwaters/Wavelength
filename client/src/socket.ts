import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Same-origin connection: proxied by Vite in dev, served by Express in prod.
export const socket: GameSocket = io({ autoConnect: true });
