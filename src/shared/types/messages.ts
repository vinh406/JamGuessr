import { UserSession, PlayerScore } from "./player";
import { RoomSettings, Playlist, UnifiedRoomState } from "./room";
import { Song, SongChoice } from "./game";

interface BaseMessage {
  type: string;
  timestamp: number;
}

export interface JoinMessage extends BaseMessage {
  type: "join";
  username: string;
  room: string;
  userId: string;
  userImage?: string;
}

export interface LeaveMessage extends BaseMessage {
  type: "leave";
  username: string;
  room: string;
  userId: string;
}

export interface ChatMessage extends BaseMessage {
  type: "message";
  content: string;
  username?: string;
  userId?: string;
  room?: string;
}

export interface ReadyMessage extends BaseMessage {
  type: "ready";
}

export interface UpdateSettingsMessage extends BaseMessage {
  type: "update_settings";
  payload: {
    rounds?: number;
    timePerRound?: number;
    audioTime?: number;
  };
}

export interface UpdatePlaylistMessage extends BaseMessage {
  type: "update_playlist";
  payload: {
    playlist: Playlist;
  };
}

export interface StartGameMessage extends BaseMessage {
  type: "start_game";
}

export interface AnswerMessage extends BaseMessage {
  type: "answer";
  choiceIndex: number;
}

export interface VotePlayAgainMessage extends BaseMessage {
  type: "vote_play_again";
  vote: boolean;
}

export type IncomingMessage =
  | JoinMessage
  | LeaveMessage
  | ChatMessage
  | ReadyMessage
  | UpdateSettingsMessage
  | UpdatePlaylistMessage
  | StartGameMessage
  | AnswerMessage
  | VotePlayAgainMessage;

export interface ErrorMessage extends BaseMessage {
  type: "error";
  content: string;
}

export interface UserJoinedMessage extends BaseMessage {
  type: "user_joined";
  username: string;
  userId: string;
  room: string;
  users: UserSession[];
  isHost: boolean;
}

export interface UserLeftMessage extends BaseMessage {
  type: "user_left";
  username: string;
  userId: string;
  room: string;
  users: UserSession[];
}

export interface UsersUpdatedMessage extends BaseMessage {
  type: "users_updated";
  users: UserSession[];
}

export interface UnifiedRoomStateMessage extends BaseMessage {
  type: "unified_room_state";
  state: UnifiedRoomState;
}

export interface SettingsUpdatedMessage extends BaseMessage {
  type: "settings_updated";
  settings: RoomSettings;
}

export interface PlaylistUpdatedMessage extends BaseMessage {
  type: "playlist_updated";
  playlist: Playlist;
}

export interface GameEventMessage extends BaseMessage {
  type: "game_event";
  payload: {
    eventType: string;
    category: "system" | "game";
    icon: string;
    content: string;
    data: Record<string, unknown>;
  };
}

export interface GameStartedMessage extends BaseMessage {
  type: "game_started";
  totalRounds: number;
  timePerRound: number;
  audioTime: number;
}

export interface RoundStartedMessage extends BaseMessage {
  type: "round_started";
  round: number;
  totalRounds: number;
  song: Song;
  choices: SongChoice[];
  startTime: number;
  endTime: number;
  duration: number;
}

export interface RoundEndedMessage extends BaseMessage {
  type: "round_ended";
  round: number;
  correctAnswer: SongChoice;
  scores: PlayerScore[];
  nextRoundAt?: number;
  isFinal?: boolean;
  voteEndsAt?: number;
}

export interface AnswerResultMessage extends BaseMessage {
  type: "answer_result";
  isCorrect: boolean;
  points: number;
  streak: number;
}

export interface LeaderboardUpdateMessage extends BaseMessage {
  type: "leaderboard_update";
  leaderboard: PlayerScore[];
}

export interface VoteUpdateMessage extends BaseMessage {
  type: "vote_update";
  votes: Record<string, boolean>;
  voteEndsAt: number;
}

export type OutgoingMessage =
  | ErrorMessage
  | UserJoinedMessage
  | UserLeftMessage
  | UsersUpdatedMessage
  | UnifiedRoomStateMessage
  | SettingsUpdatedMessage
  | PlaylistUpdatedMessage
  | GameEventMessage
  | ChatMessage
  | GameStartedMessage
  | RoundStartedMessage
  | RoundEndedMessage
  | AnswerResultMessage
  | LeaderboardUpdateMessage
  | VoteUpdateMessage;

export type BroadcastMessage = OutgoingMessage & {
  connections: number;
  totalConnections: number;
};

export type ChatBoxMessage = ChatMessage | UserJoinedMessage | UserLeftMessage | ErrorMessage;
