import { RoomHandler } from "./roomHandler";
import { GameHandler } from "./gameHandler";
import { ChatHandler } from "./chatHandler";
import type {
  IncomingMessage,
  JoinMessage,
  ChatMessage,
  UpdateSettingsMessage,
  UpdatePlaylistMessage,
  AnswerMessage,
  VotePlayAgainMessage,
} from "../../shared/types";
import { RoomManager } from ".";

export class MessageRouter {
  private roomHandler: RoomHandler;
  private gameHandler: GameHandler;
  private chatHandler: ChatHandler;

  constructor(roomManager: RoomManager) {
    this.roomHandler = new RoomHandler(roomManager);
    this.gameHandler = new GameHandler(roomManager);
    this.chatHandler = new ChatHandler(roomManager);
  }

  async handleMessage(ws: WebSocket, message: IncomingMessage): Promise<void> {
    switch (message.type) {
      case "join":
        await this.roomHandler.handleJoinRoom(ws, message as JoinMessage);
        break;
      case "leave":
        await this.roomHandler.handleLeave(ws);
        break;
      case "message":
        await this.chatHandler.handleChatMessage(ws, message as ChatMessage);
        break;
      case "ready":
        await this.roomHandler.handleReady(ws);
        break;
      case "update_settings":
        await this.roomHandler.handleUpdateSettings(ws, message as UpdateSettingsMessage);
        break;
      case "update_playlist":
        await this.roomHandler.handleUpdatePlaylist(ws, message as UpdatePlaylistMessage);
        break;
      case "start_game":
        await this.gameHandler.handleStartGame(ws);
        break;
      case "answer":
        await this.gameHandler.handleAnswer(ws, message as AnswerMessage);
        break;
      case "vote_play_again":
        await this.gameHandler.handleVote(ws, message as VotePlayAgainMessage);
        break;
      default:
        await this.chatHandler.handleChatMessage(ws, message as ChatMessage);
    }
  }

  async handleClose(ws: WebSocket): Promise<void> {
    await this.roomHandler.handleLeave(ws);
  }
}
