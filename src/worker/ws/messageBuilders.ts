import type {
  UserSession,
  RoomSettings,
  Playlist,
  ErrorMessage,
  UserJoinedMessage,
  UserLeftMessage,
  UsersUpdatedMessage,
  SettingsUpdatedMessage,
  PlaylistUpdatedMessage,
  GameEventMessage,
  ChatMessage,
  GameStartedMessage,
  RoundStartedMessage,
  RoundEndedMessage,
  AnswerResultMessage,
  LeaderboardUpdateMessage,
  SongChoice,
  PlayerScore,
  UnifiedRoomState,
  UnifiedRoomStateMessage,
  GameStateSnapshot,
  VoteUpdateMessage,
} from "../../shared/types";

export const MessageBuilders = {
  error(content: string): ErrorMessage {
    return {
      type: "error",
      content,
      timestamp: Date.now(),
    };
  },

  unifiedRoomState(state: UnifiedRoomState): UnifiedRoomStateMessage {
    // Convert Map to Record for JSON serialization if they are Maps in the engine but Records in the type
    const serializedGame = {
      ...state.game,
      answers: Object.fromEntries(
        state.game.answers instanceof Map ? state.game.answers : Object.entries(state.game.answers),
      ),
      votes: Object.fromEntries(
        state.game.votes instanceof Map ? state.game.votes : Object.entries(state.game.votes),
      ),
    };

    return {
      type: "unified_room_state",
      state: {
        ...state,
        game: serializedGame as unknown as GameStateSnapshot,
      },
      timestamp: Date.now(),
    };
  },

  userJoined(
    username: string,
    userId: string,
    room: string,
    isHost: boolean,
    users: UserSession[],
  ): UserJoinedMessage {
    return {
      type: "user_joined",
      username,
      userId,
      room,
      isHost,
      users,
      timestamp: Date.now(),
    };
  },

  userLeft(username: string, userId: string, room: string, users: UserSession[]): UserLeftMessage {
    return {
      type: "user_left",
      username,
      userId,
      room,
      users,
      timestamp: Date.now(),
    };
  },

  usersUpdated(users: UserSession[]): UsersUpdatedMessage {
    return {
      type: "users_updated",
      users,
      timestamp: Date.now(),
    };
  },

  settingsUpdated(settings: RoomSettings): SettingsUpdatedMessage {
    return {
      type: "settings_updated",
      settings,
      timestamp: Date.now(),
    };
  },

  playlistUpdated(playlist: Playlist): PlaylistUpdatedMessage {
    return {
      type: "playlist_updated",
      playlist,
      timestamp: Date.now(),
    };
  },

  gameEvent(
    eventType: string,
    icon: string,
    content: string,
    data: Record<string, unknown> = {},
  ): GameEventMessage {
    const systemCategories = ["ready", "settings", "host", "playlist"];
    const category = systemCategories.some((c) => eventType.includes(c)) ? "system" : "game";

    return {
      type: "game_event",
      payload: {
        eventType,
        category,
        icon,
        content,
        data,
      },
      timestamp: Date.now(),
    };
  },

  chatMessage(content: string, username: string, userId: string, room: string): ChatMessage {
    return {
      type: "message",
      content,
      username,
      userId,
      room,
      timestamp: Date.now(),
    };
  },

  gameStarted(totalRounds: number, timePerRound: number, audioTime: number): GameStartedMessage {
    return {
      type: "game_started",
      totalRounds,
      timePerRound,
      audioTime,
      timestamp: Date.now(),
    };
  },

  roundStarted(
    round: number,
    totalRounds: number,
    song: { previewUrl?: string; albumImageUrl?: string },
    choices: SongChoice[],
    startTime: number,
    endTime: number,
    duration: number,
  ): RoundStartedMessage {
    return {
      type: "round_started",
      round,
      totalRounds,
      song: { previewUrl: song.previewUrl, albumImageUrl: song.albumImageUrl },
      choices,
      startTime,
      endTime,
      duration,
      timestamp: Date.now(),
    };
  },

  roundEnded(
    round: number,
    correctAnswer: SongChoice,
    scores: PlayerScore[],
    nextRoundAt?: number,
    isFinal?: boolean,
    voteEndsAt?: number,
  ): RoundEndedMessage {
    return {
      type: "round_ended",
      round,
      correctAnswer,
      scores,
      nextRoundAt,
      isFinal,
      voteEndsAt,
      timestamp: Date.now(),
    };
  },

  voteUpdate(votes: Record<string, boolean>, voteEndsAt: number): VoteUpdateMessage {
    return {
      type: "vote_update",
      votes,
      voteEndsAt,
      timestamp: Date.now(),
    };
  },

  answerResult(isCorrect: boolean, points: number, streak: number): AnswerResultMessage {
    return {
      type: "answer_result",
      isCorrect,
      points,
      streak,
      timestamp: Date.now(),
    };
  },

  leaderboardUpdate(leaderboard: PlayerScore[]): LeaderboardUpdateMessage {
    return {
      type: "leaderboard_update",
      leaderboard,
      timestamp: Date.now(),
    };
  },
};
