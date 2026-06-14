import type { ChatMessage } from "../../shared/types";
import { MAX_CHAT_MESSAGE_LENGTH } from "../../shared/constants";
import type { WsContext } from "./utils";
import { getSessionOrError } from "./utils";
import { MessageBuilders } from "./messageBuilders";
import { broadcastToRoom, sendToSocket } from "./broadcast";

export function handleChatMessage(ctx: WsContext, ws: WebSocket, data: ChatMessage): void {
  const session = getSessionOrError(ctx.sessions, ws);
  if (!session) return;

  const trimmedContent = data.content?.trim() || "";
  if (!trimmedContent) return;
  if (trimmedContent.length > MAX_CHAT_MESSAGE_LENGTH) {
    sendToSocket(
      ws,
      MessageBuilders.error(`Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or less`),
    );
    return;
  }

  const message = MessageBuilders.chatMessage(
    trimmedContent,
    session.username,
    session.userId,
    session.room,
  );

  broadcastToRoom(ctx.sessions, message);
}
