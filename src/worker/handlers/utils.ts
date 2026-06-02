import { MessageBuilders, sendToSocket } from "../lib/websocket";
import type { UserSession } from "../../shared/types";

export function validateHost(ws: WebSocket, session: UserSession): boolean {
  if (!session.isHost) {
    sendToSocket(ws, MessageBuilders.error("Only the host can perform this action"));
    return false;
  }
  return true;
}
