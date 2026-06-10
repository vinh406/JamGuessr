import { PlayerScore } from "./player";

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumImageUrl?: string;
  previewUrl?: string; // Spotify preview URL
  duration: number; // in milliseconds
  submittedBy?: {
    userId: string;
    username: string;
    userImage?: string;
  };
}

export interface SongChoice {
  index: number;
  title: string;
  artist: string;
  albumImageUrl?: string;
  isCorrect?: boolean;
  submittedBy?: {
    userId: string;
    username: string;
    userImage?: string;
  };
}

export type GamePhase = "lobby" | "starting" | "playing" | "roundEnd";

export interface GameStateSnapshot {
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  songs: Song[];
  currentSongIndex: number;
  choices: SongChoice[];
  scores: PlayerScore[];
  answers: Record<string, { choiceIndex: number; answeredAt: number; isCorrect: boolean }>;
  roundStartTime: number;
  roundEndTime: number;
  roundDuration: number;
  // Voting for next game
  votes: Record<string, boolean>; // userId -> vote
  voteEndsAt: number | null;
}

export interface GamePlayerResult {
  userId: string | null;
  username: string | null;
  score: number;
  streak: number;
  rank: number;
}

export interface GameResult {
  id: string;
  roomName: string;
  hostUserId: string;
  playlist: { name: string; imageUrl?: string; trackCount: number } | null;
  settings: { rounds: number; timePerRound: number; audioTime: number };
  songs: Song[];
  players: GamePlayerResult[];
  playedAt: string; // ISO string
}

// For the API response with resolved user info (auth user's name resolved from user table)
export interface GameResultWithPlayers extends GameResult {
  playerUsers: Array<GamePlayerResult & { displayName: string; image: string | null }>;
}
