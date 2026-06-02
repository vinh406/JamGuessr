import { DurableObject } from "cloudflare:workers";
import { MessageRouter } from "../handlers";
import { RoomManager } from "../lib/websocket";
import { IncomingMessage, UserSession } from "../../shared/types";

export class WebSocketHibernationServer extends DurableObject {
  private roomManager: RoomManager;
  private messageRouter: MessageRouter;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.roomManager = new RoomManager(env);
    this.messageRouter = new MessageRouter(this.roomManager);

    const existingSessions = new Map<WebSocket, UserSession>();
    ctx.getWebSockets().forEach((webSocket) => {
      const meta = webSocket.deserializeAttachment() as UserSession | null;
      if (meta) {
        existingSessions.set(webSocket, { ...meta });
      }
    });
    this.roomManager.setSessions(existingSessions);
  }

  async fetch(): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const client = webSocketPair[0] as WebSocket;
    const server = webSocketPair[1] as WebSocket;

    if (!client || !server) {
      return new Response("WebSocket creation failed", { status: 500 });
    }

    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const messageString = typeof message === "string" ? message : new TextDecoder().decode(message);

    let parsedMessage: IncomingMessage;
    try {
      parsedMessage = JSON.parse(messageString);
    } catch {
      parsedMessage = {
        type: "message",
        content: messageString,
        timestamp: Date.now(),
      };
    }

    await this.handleMessage(ws, parsedMessage);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.messageRouter.handleClose(ws);
  }

  private async handleMessage(ws: WebSocket, message: IncomingMessage): Promise<void> {
    await this.messageRouter.handleMessage(ws, message);
  }
}
