export interface Player {
  userId: string;
  username: string;
  userImage: string | null;
  isReady: boolean;
  isHost: boolean;
}

export interface UserSession extends Player {
  room: string;
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
