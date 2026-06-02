import { RoomAction, RoomState } from "../../../shared/types/room";

export const DEFAULT_GAME_STATE: RoomState["game"] = {
  gamePhase: "lobby",
  currentRound: 0,
  totalRounds: 0,
  currentSong: null,
  choices: [],
  roundStartTime: 0,
  roundEndTime: 0,
  roundDuration: 0,
  scores: [],
  myScore: 0,
  myStreak: 0,
  hasAnswered: false,
  selectedChoice: null,
  endStateData: null,
  votes: {},
  voteEndsAt: null,
};

export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case "SYNC_UNIFIED_STATE": {
      const { state: unified, currentUserId } = action;
      const myPlayer = unified.users.find((u) => u.userId === currentUserId);
      const myScoreObj = unified.game.scores.find((s) => s.userId === currentUserId);
      const myAnswer = unified.game.answers[currentUserId];

      return {
        ...state,
        ui: { ...state.ui, isStartingGame: false },
        metadata: {
          ...state.metadata,
          roomName: unified.room,
          players: unified.users.map((u) => ({
            userId: u.userId,
            username: u.username,
            userImage: u.userImage,
            isReady: u.isReady,
            isHost: u.isHost,
          })),
          selectedPlaylist: unified.playlist,
          gameSettings: {
            rounds: unified.settings.rounds,
            timePerRound: unified.settings.timePerRound / 1000,
            audioTime: unified.settings.audioTime / 1000,
          },
          isHost: myPlayer?.isHost ?? false,
          isReady: myPlayer?.isReady ?? false,
        },
        game: {
          ...state.game,
          gamePhase: unified.game.phase,
          currentRound: unified.game.currentRound,
          totalRounds: unified.game.totalRounds,
          currentSong:
            unified.game.choices.length > 0
              ? {
                  previewUrl: unified.game.songs[unified.game.currentSongIndex]?.previewUrl,
                  albumImageUrl: unified.game.songs[unified.game.currentSongIndex]?.albumImageUrl,
                }
              : null,
          choices: unified.game.choices,
          roundStartTime: unified.game.roundStartTime,
          roundEndTime: unified.game.roundEndTime,
          roundDuration: unified.game.roundDuration,
                  scores: [...unified.game.scores].sort((a, b) => b.score - a.score),
          myScore: myScoreObj?.score ?? 0,
          myStreak: myScoreObj?.streak ?? 0,
          hasAnswered: !!myAnswer,
          selectedChoice: myAnswer?.choiceIndex ?? null,
          endStateData:
            unified.game.phase === "roundEnd"
              ? {
                  correctAnswer: unified.game.choices.find((c) => c.isCorrect),
          scores: [...unified.game.scores].sort((a, b) => b.score - a.score),
                  voteEndsAt: unified.game.voteEndsAt ?? undefined,
                }
              : null,
          votes: unified.game.votes || {},
          voteEndsAt: unified.game.voteEndsAt,
        },
      };
    }

    case "UPDATE_PLAYERS": {
      const myPlayer = action.users.find((u) => u.userId === action.currentUserId);
      return {
        ...state,
        metadata: {
          ...state.metadata,
          players: action.users.map((u) => ({
            userId: u.userId,
            username: u.username,
            userImage: u.userImage,
            isReady: u.isReady,
            isHost: u.isHost,
          })),
          isHost: myPlayer?.isHost ?? state.metadata.isHost,
          isReady: myPlayer?.isReady ?? state.metadata.isReady,
        },
      };
    }

    case "CHAT_MESSAGE":
      return {
        ...state,
        ui: {
          ...state.ui,
          chatMessages: [...state.ui.chatMessages, action.message].slice(-200),
        },
      };

    case "SETTINGS_UPDATED":
      return {
        ...state,
        metadata: {
          ...state.metadata,
          gameSettings: {
            rounds: action.settings.rounds,
            timePerRound: action.settings.timePerRound / 1000,
            audioTime: action.settings.audioTime / 1000,
          },
        },
      };

    case "PLAYLIST_UPDATED":
      return {
        ...state,
        metadata: {
          ...state.metadata,
          selectedPlaylist: action.playlist,
        },
      };

    case "GAME_STARTED":
      return {
        ...state,
        ui: { ...state.ui, isStartingGame: true },
        metadata: {
          ...state.metadata,
          gameSettings: {
            rounds: action.totalRounds,
            timePerRound: action.timePerRound / 1000,
            audioTime: action.audioTime / 1000,
          },
        },
        game: {
          ...state.game,
          currentRound: 0,
          totalRounds: action.totalRounds,
          scores: [],
          myScore: 0,
          myStreak: 0,
          endStateData: null,
          votes: {},
          voteEndsAt: null,
        },
      };

    case "ROUND_STARTED":
      return {
        ...state,
        ui: { ...state.ui, isStartingGame: false },
        game: {
          ...state.game,
          gamePhase: "playing",
          currentRound: action.round,
          totalRounds: action.totalRounds,
          currentSong: action.song,
          choices: action.choices,
          roundStartTime: action.startTime,
          roundEndTime: action.endTime,
          roundDuration: action.duration,
          hasAnswered: false,
          selectedChoice: null,
          endStateData: null,
        },
      };

    case "ROUND_ENDED":
      return {
        ...state,
        game: {
          ...state.game,
          gamePhase: "roundEnd",
          endStateData: {
            correctAnswer: action.correctAnswer,
            scores: action.scores,
            nextRoundAt: action.nextRoundAt,
            voteEndsAt: action.voteEndsAt,
          },
          scores: action.scores,
          voteEndsAt: action.voteEndsAt ?? state.game.voteEndsAt,
          votes: action.isFinal ? {} : state.game.votes,
        },
      };

    case "VOTE_UPDATE":
      return {
        ...state,
        game: {
          ...state.game,
          votes: action.votes,
          voteEndsAt: action.voteEndsAt,
        },
      };

    case "ANSWER_RESULT":
      return {
        ...state,
        game: {
          ...state.game,
          myScore: action.isCorrect ? state.game.myScore + action.points : state.game.myScore,
          myStreak: action.streak,
        },
      };

    case "LEADERBOARD_UPDATE":
      return {
        ...state,
        game: { ...state.game, scores: action.leaderboard },
      };

    case "SET_CONNECTED":
      return { ...state, ui: { ...state.ui, isConnected: action.connected } };

    case "SET_USER":
      return { ...state, ui: { ...state.ui, currentUser: action.user } };

    case "SET_SHOW_USERNAME_PROMPT":
      return { ...state, ui: { ...state.ui, showUsernamePrompt: action.show } };

    case "SET_SHOW_SETTINGS_MODAL":
      return { ...state, ui: { ...state.ui, showSettingsModal: action.show } };

    case "SET_SHOW_PLAYLIST_MODAL":
      return { ...state, ui: { ...state.ui, showPlaylistModal: action.show } };

    case "SET_SPOTIFY_LINK":
      return { ...state, ui: { ...state.ui, spotifyLink: action.link } };

    case "SET_AVAILABLE_PLAYLISTS":
      return { ...state, ui: { ...state.ui, availablePlaylists: action.playlists } };

    case "SET_PLAYLISTS_LOADING":
      return { ...state, ui: { ...state.ui, playlistsLoading: action.loading } };

    case "SET_PENDING_LIBRARY_IMPORT":
      return {
        ...state,
        ui: {
          ...state.ui,
          pendingLibraryImport: action.playlist ? { playlist: action.playlist } : null,
        },
      };

    case "SET_LIBRARY_IMPORTING":
      return { ...state, ui: { ...state.ui, libraryImporting: action.importing } };

    case "LOCAL_ANSWER":
      return {
        ...state,
        game: {
          ...state.game,
          hasAnswered: true,
          selectedChoice: action.choiceIndex,
        },
      };

    case "TOGGLE_READY":
      return {
        ...state,
        metadata: { ...state.metadata, isReady: !state.metadata.isReady },
      };

    case "RESET_TO_LOBBY":
      return {
        ...state,
        ui: { ...state.ui, isStartingGame: false },
        game: { ...DEFAULT_GAME_STATE },
      };

    default:
      return state;
  }
}
