import type {
  GamePhase,
  Song,
  SongChoice,
  PlayerScore,
  GameStateSnapshot,
} from "../../../shared/types";
import {
  getSimilarTracks,
  getArtistTopTracks,
  type LastFMSimilarTrack,
} from "../../services/lastfm/client";
import { calculateScore, generateChoices, generateChoicesWithLastFM } from "./GameUtils";

export class GameEngine {
  private phase: GamePhase = "lobby";
  private currentRound: number = 0;
  private totalRounds: number = 0;
  private songs: Song[] = [];
  private currentSongIndex: number = 0;
  private choices: SongChoice[] = [];
  private scores: Map<string, PlayerScore> = new Map();
  private answers: Map<string, { choiceIndex: number; answeredAt: number }> = new Map();
  private roundStartTime: number = 0;
  private roundEndTime: number = 0;
  private roundDuration: number = 0;

  private votes: Map<string, boolean> = new Map();
  private voteEndsAt: number | null = null;

  private similarTracksCache: Map<string, LastFMSimilarTrack[]> = new Map();
  private lastFmApiKey: string | null = null;

  constructor() {}

  setLastFmApiKey(apiKey: string): void {
    this.lastFmApiKey = apiKey;
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  setPhase(phase: GamePhase): void {
    this.phase = phase;
  }

  initGame(
    songs: Song[],
    rounds: number,
    initialPlayers: { userId: string; username: string; userImage?: string }[],
    isContinuing: boolean = false,
  ): void {
    this.phase = "playing";

    this.songs = songs;

    if (!isContinuing) {
      this.currentSongIndex = 0;
    }
    // For continuing: keep currentSongIndex (caller already prepared the array)

    this.totalRounds = rounds;
    this.currentRound = 1;
    this.answers = new Map();
    this.similarTracksCache = new Map();
    this.votes = new Map();
    this.voteEndsAt = null;

    // Reset scores for everyone for the new game
    for (const userId of this.scores.keys()) {
      const p = this.scores.get(userId)!;
      p.score = 0;
      p.streak = 0;
    }

    // Add new players or ensure existing players have scores reset
    for (const player of initialPlayers) {
      if (!this.scores.has(player.userId)) {
        this.addPlayer(player.userId, player.username, player.userImage);
      } else {
        const p = this.scores.get(player.userId)!;
        p.score = 0;
        p.streak = 0;
      }
    }
  }

  addPlayer(userId: string, username: string, userImage?: string): void {
    if (!this.scores.has(userId)) {
      this.scores.set(userId, {
        userId,
        username,
        userImage,
        score: 0,
        streak: 0,
      });
    }
  }

  async startRound(timePerRound: number): Promise<{
    song: Song;
    choices: SongChoice[];
    round: number;
    totalRounds: number;
    startTime: number;
    endTime: number;
    duration: number;
  }> {
    this.phase = "playing";
    const song = this.songs[this.currentSongIndex]!;

    let choices: SongChoice[];
    if (this.lastFmApiKey) {
      const cachedSimilarTracks = this.similarTracksCache.get(song.id);
      if (cachedSimilarTracks) {
        choices = generateChoicesWithLastFM(
          song,
          this.songs,
          this.similarTracksCache,
          this.lastFmApiKey,
        );
      } else {
        let similarTracks = await getSimilarTracks(song.artist, song.title, this.lastFmApiKey, 10);
        if (!similarTracks.length) {
          similarTracks = await getArtistTopTracks(song.artist, this.lastFmApiKey, 10);
        }
        this.similarTracksCache.set(song.id, similarTracks);
        choices = generateChoicesWithLastFM(
          song,
          this.songs,
          this.similarTracksCache,
          this.lastFmApiKey,
        );
      }
    } else {
      choices = generateChoices(song, this.songs);
    }

    this.choices = choices;
    this.roundDuration = timePerRound;
    this.roundStartTime = Date.now();
    this.roundEndTime = this.roundStartTime + this.roundDuration;
    this.answers = new Map();

    return {
      song,
      choices,
      round: this.currentRound,
      totalRounds: this.totalRounds,
      startTime: this.roundStartTime,
      endTime: this.roundEndTime,
      duration: this.roundDuration,
    };
  }

  recordAnswer(
    userId: string,
    choiceIndex: number,
    timePerRound: number,
  ): { isCorrect: boolean; points: number; streak: number } {
    if (this.answers.has(userId)) {
      const existing = this.answers.get(userId)!;
      const playerScore = this.scores.get(userId);
      return {
        isCorrect: this.choices[existing.choiceIndex]?.isCorrect ?? false,
        points: playerScore?.score ?? 0,
        streak: playerScore?.streak ?? 0,
      };
    }

    const timeTaken = Date.now() - this.roundStartTime;
    const isCorrect = this.choices[choiceIndex]?.isCorrect ?? false;
    this.answers.set(userId, { choiceIndex, answeredAt: Date.now() });

    const playerScore = this.scores.get(userId);
    if (!playerScore) {
      return { isCorrect, points: 0, streak: 0 };
    }

    const newStreak = isCorrect ? playerScore.streak + 1 : 0;
    const points = calculateScore(isCorrect, timeTaken, timePerRound, newStreak);

    playerScore.score += points;
    playerScore.streak = newStreak;
    this.scores.set(userId, playerScore);

    return { isCorrect, points, streak: newStreak };
  }

  endRound(): { correctAnswer: SongChoice; scores: PlayerScore[] } {
    this.phase = "roundEnd";

    for (const playerScore of this.scores.values()) {
      if (!this.answers.has(playerScore.userId)) {
        playerScore.streak = 0;
      }
    }

    const correctAnswer = this.choices.find((c) => c.isCorrect)!;
    const scores = Array.from(this.scores.values()).sort((a, b) => b.score - a.score);

    this.currentSongIndex++;
    this.currentRound++;

    return { correctAnswer, scores };
  }

  endGame(voteDurationMs: number): { finalScores: PlayerScore[]; voteEndsAt: number } {
    this.votes.clear();
    this.voteEndsAt = Date.now() + voteDurationMs;
    const finalScores = Array.from(this.scores.values()).sort((a, b) => b.score - a.score);
    return { finalScores, voteEndsAt: this.voteEndsAt };
  }

  recordVote(userId: string, vote: boolean): void {
    if (this.voteEndsAt && Date.now() > this.voteEndsAt) {
      return;
    }
    this.votes.set(userId, vote);
  }

  getVotes(): Record<string, boolean> {
    return Object.fromEntries(this.votes);
  }

  getVoteEndsAt(): number | null {
    return this.voteEndsAt;
  }

  allPlayersVoted(playersInRoom: string[]): boolean {
    return playersInRoom.every((userId) => this.votes.has(userId));
  }

  didAllPlayersVoteYes(): boolean {
    if (this.votes.size === 0) return false;
    return Array.from(this.votes.values()).every((v) => v === true);
  }

  reset(): void {
    this.phase = "lobby";
    this.currentRound = 0;
    this.totalRounds = 0;
    this.songs = [];
    this.currentSongIndex = 0;
    this.choices = [];
    this.scores = new Map();
    this.answers = new Map();
    this.roundStartTime = 0;
    this.roundEndTime = 0;
    this.roundDuration = 0;
    this.votes.clear();
    this.voteEndsAt = null;
  }

  getScores(): PlayerScore[] {
    return Array.from(this.scores.values()).sort((a, b) => b.score - a.score);
  }

  getGameState(): GameStateSnapshot {
    return {
      phase: this.phase,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      songs: this.songs,
      currentSongIndex: this.currentSongIndex,
      choices: this.choices,
      scores: Array.from(this.scores.values()),
      answers: Object.fromEntries(this.answers),
      roundStartTime: this.roundStartTime,
      roundEndTime: this.roundEndTime,
      roundDuration: this.roundDuration,
      votes: Object.fromEntries(this.votes),
      voteEndsAt: this.voteEndsAt,
    };
  }

  allPlayersAnswered(playersInRoom: string[]): boolean {
    return playersInRoom.every((userId) => this.answers.has(userId));
  }
}
