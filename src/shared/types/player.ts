export interface Player {
  userId: string;
  username: string;
  userImage: string | null;
  isReady: boolean;
  isHost: boolean;
}

export interface UserSession {
  username: string;
  room: string;
  userId: string;
  userImage: string | null;
  isHost: boolean;
  isReady: boolean;
  joinedAt: number;
}

export interface PlayerScore {
  userId: string;
  username: string;
  userImage?: string;
  score: number;
  streak: number; // current consecutive correct answers
  bestStreak: number; // max consecutive correct answers in the game
}
