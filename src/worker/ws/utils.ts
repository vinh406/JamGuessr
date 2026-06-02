import { MessageBuilders, sendToSocket } from ".";
import type { RoomManager } from ".";
import type { UserSession } from "../../shared/types";

export function getSessionOrError(
  roomManager: RoomManager,
  ws: WebSocket,
): UserSession | null {
  const session = roomManager.getUserSession(ws);
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
