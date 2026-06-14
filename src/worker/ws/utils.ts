import type { UserSession, RoomSettings, Playlist, UnifiedRoomState } from "../../shared/types";
import { sendToSocket } from "./broadcast";
import { MessageBuilders } from "./messageBuilders";
import type { GameEngine } from "./game/GameEngine";

export interface WsContext {
  sessions: Map<WebSocket, UserSession>;
  roomSettings: RoomSettings;
  roomPlaylist: Playlist | null;
  roundTimer: ReturnType<typeof setTimeout> | null;
  voteTimer: ReturnType<typeof setTimeout> | null;
  gameEngine: GameEngine;
  env: Env;
}

export function getSessionOrError(
  sessions: Map<WebSocket, UserSession>,
  ws: WebSocket,
): UserSession | null {
  const session = sessions.get(ws);
  if (!session) {
    sendToSocket(ws, MessageBuilders.error("You must join a room first"));
    return null;
  }
  return session;
}

export function validateHost(ws: WebSocket, session: UserSession): boolean {
  if (!session.isHost) {
    sendToSocket(ws, MessageBuilders.error("Only the host can perform this action"));
    return false;
  }
  return true;
}

export function getAllUsers(sessions: Map<WebSocket, UserSession>): UserSession[] {
  return Array.from(sessions.values()).map((s) => ({ ...s }));
}

export function findSessionByUserId(
  sessions: Map<WebSocket, UserSession>,
  userId: string,
): WebSocket | undefined {
  for (const [ws, session] of sessions) {
    if (session.userId === userId) return ws;
  }
  return undefined;
}

export function resetReadyStates(sessions: Map<WebSocket, UserSession>): void {
  for (const [ws, session] of sessions) {
    session.isReady = false;
    ws.serializeAttachment({ ...session });
  }
}

export function getHostUserId(sessions: Map<WebSocket, UserSession>): string | undefined {
  for (const session of sessions.values()) {
    if (session.isHost) return session.userId;
  }
  return undefined;
}

export function getUnifiedRoomState(ctx: WsContext, room: string): UnifiedRoomState {
  return {
    room,
    settings: ctx.roomSettings,
    playlist: ctx.roomPlaylist,
    users: getAllUsers(ctx.sessions),
    game: ctx.gameEngine.getGameState(),
  };
}
