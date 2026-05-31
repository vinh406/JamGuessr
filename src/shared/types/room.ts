import { GamePhase, GameStateSnapshot, SongChoice } from "./game";
import { ChatBoxMessage } from "./messages";
import { Player, PlayerScore, UserSession } from "./player";

export interface RoomSettings {
  rounds: number;
  timePerRound: number;
  audioTime: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackCount: number;
  imageUrl?: string;
}

export interface UnifiedRoomState {
  room: string;
  settings: RoomSettings;
  playlist: Playlist | null;
  users: UserSession[];
  game: GameStateSnapshot;
}

export type RoomAction =
  | { type: "SYNC_UNIFIED_STATE"; state: UnifiedRoomState; currentUserId: string }
  | { type: "UPDATE_PLAYERS"; users: UserSession[]; currentUserId: string }
  | { type: "CHAT_MESSAGE"; message: ChatBoxMessage }
  | { type: "SETTINGS_UPDATED"; settings: RoomSettings }
  | { type: "PLAYLIST_UPDATED"; playlist: Playlist }
  | { type: "GAME_STARTED"; totalRounds: number; timePerRound: number; audioTime: number }
  | {
      type: "ROUND_STARTED";
      round: number;
      totalRounds: number;
      song: { previewUrl?: string; albumImageUrl?: string };
      choices: SongChoice[];
      startTime: number;
      endTime: number;
      duration: number;
    }
  | {
      type: "ROUND_ENDED";
      round: number;
      correctAnswer: SongChoice;
      scores: PlayerScore[];
      nextRoundAt?: number;
      isFinal?: boolean;
      voteEndsAt?: number;
    }
  | { type: "VOTE_UPDATE"; votes: Record<string, boolean>; voteEndsAt: number }
  | { type: "ANSWER_RESULT"; isCorrect: boolean; points: number; streak: number }
  | { type: "LEADERBOARD_UPDATE"; leaderboard: PlayerScore[] }
  | { type: "SET_CONNECTED"; connected: boolean }
  | { type: "SET_USER"; user: { username: string; userId: string } | null }
  | { type: "SET_SHOW_USERNAME_PROMPT"; show: boolean }
  | { type: "SET_SHOW_SETTINGS_MODAL"; show: boolean }
  | { type: "SET_SHOW_PLAYLIST_MODAL"; show: boolean }
  | { type: "SET_SPOTIFY_LINK"; link: string }
  | { type: "SET_AVAILABLE_PLAYLISTS"; playlists: Playlist[] }
  | { type: "SET_PLAYLISTS_LOADING"; loading: boolean }
  | { type: "SET_PENDING_LIBRARY_IMPORT"; playlist: Playlist | null }
  | { type: "SET_LIBRARY_IMPORTING"; importing: boolean }
  | { type: "LOCAL_ANSWER"; choiceIndex: number }
  | { type: "TOGGLE_READY" }
  | { type: "RESET_TO_LOBBY" };

export interface RoomState {
  metadata: {
    roomName: string;
    players: Player[];
    selectedPlaylist: Playlist | null;
    gameSettings: { rounds: number; timePerRound: number; audioTime: number };
    isHost: boolean;
    isReady: boolean;
  };
  game: {
    gamePhase: GamePhase;
    currentRound: number;
    totalRounds: number;
    currentSong: { previewUrl?: string; albumImageUrl?: string } | null;
    choices: SongChoice[];
    roundStartTime: number;
    roundEndTime: number;
    roundDuration: number;
    scores: PlayerScore[];
    myScore: number;
    myStreak: number;
    hasAnswered: boolean;
    selectedChoice: number | null;
    endStateData: {
      correctAnswer?: SongChoice;
      scores: PlayerScore[];
      voteEndsAt?: number;
      nextRoundAt?: number;
    } | null;
    votes: Record<string, boolean>;
    voteEndsAt: number | null;
  };
  ui: {
    currentUser: { username: string; userId: string } | null;
    showUsernamePrompt: boolean;
    showSettingsModal: boolean;
    showPlaylistModal: boolean;
    spotifyLink: string;
    availablePlaylists: Playlist[];
    playlistsLoading: boolean;
    pendingLibraryImport: { playlist: Playlist } | null;
    libraryImporting: boolean;
    isStartingGame: boolean;
    chatMessages: ChatBoxMessage[];
    isConnected: boolean;
  };
}
