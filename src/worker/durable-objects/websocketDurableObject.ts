import { DurableObject } from "cloudflare:workers";
import type { IncomingMessage, UserSession, ChatMessage } from "../../shared/types";
import { DEFAULT_ROOM_SETTINGS } from "../../shared/constants";
import { GameEngine } from "../ws/game/GameEngine";
import type { WsContext } from "../ws/utils";
import {
  handleJoinRoom,
  handleLeave,
  handleReady,
  handleUpdateSettings,
  handleUpdatePlaylist,
} from "../ws/roomHandler";
import { handleStartGame, handleAnswer, handleVote } from "../ws/gameHandler";
import { handleChatMessage } from "../ws/chatHandler";

export class WebSocketHibernationServer extends DurableObject {
  private room: WsContext;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);

    const gameEngine = new GameEngine();
    gameEngine.setLastFmApiKey(env.LAST_FM_API_KEY);

    const sessions = new Map<WebSocket, UserSession>();
    state.getWebSockets().forEach((webSocket) => {
      const meta = webSocket.deserializeAttachment() as UserSession | null;
      if (meta) {
        sessions.set(webSocket, { ...meta });
      }
    });

    this.room = {
      sessions,
      roomSettings: { ...DEFAULT_ROOM_SETTINGS },
      roomPlaylist: null,
      roundTimer: null,
      voteTimer: null,
      gameEngine,
      env,
    };
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
        type: "message" as const,
        content: messageString,
        timestamp: Date.now(),
      };
    }

    switch (parsedMessage.type) {
      case "join":
        await handleJoinRoom(this.room, ws, parsedMessage);
        break;
      case "leave":
        await handleLeave(this.room, ws);
        break;
      case "message":
        handleChatMessage(this.room, ws, parsedMessage);
        break;
      case "ready":
        await handleReady(this.room, ws);
        break;
      case "update_settings":
        await handleUpdateSettings(this.room, ws, parsedMessage);
        break;
      case "update_playlist":
        await handleUpdatePlaylist(this.room, ws, parsedMessage);
        break;
      case "start_game":
        await handleStartGame(this.room, ws);
        break;
      case "answer":
        await handleAnswer(this.room, ws, parsedMessage);
        break;
      case "vote_play_again":
        await handleVote(this.room, ws, parsedMessage);
        break;
      default:
        handleChatMessage(this.room, ws, parsedMessage as ChatMessage);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await handleLeave(this.room, ws);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("WebSocket error:", error);
    await handleLeave(this.room, ws);
  }
}
