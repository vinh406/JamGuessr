import { useState, useEffect } from "react";
import type { SongChoice, PlayerScore } from "../../../shared/types";
import { Button } from "../ui";
import { Leaderboard } from "../common/Leaderboard";
import type { LeaderboardEntry } from "../common/Leaderboard";

interface RoundEndViewProps {
  round: number;
  totalRounds: number;
  correctAnswer: SongChoice;
  scores: PlayerScore[];
  myUserId: string;
  onPlayAgain?: (vote: boolean) => void;
  votes?: Record<string, boolean>;
  voteEndsAt?: number | null;
  nextRoundAt?: number;
}

export function RoundEndView({
  round,
  totalRounds,
  correctAnswer,
  scores,
  myUserId,
  onPlayAgain,
  votes = {},
  voteEndsAt,
  nextRoundAt,
}: RoundEndViewProps) {
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);
  const myRank = sortedScores.findIndex((s) => s.userId === myUserId) + 1;
  const myScore = scores.find((s) => s.userId === myUserId);
  const winner = sortedScores[0];
  const isWinner = myUserId === winner?.userId;
  const myVote = votes[myUserId];
  const totalPlayers = scores.length;
  const votesCount = Object.keys(votes).length;

  const [voteTimeLeft, setVoteTimeLeft] = useState<number>(0);
  const [nextRoundTimeLeft, setNextRoundTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!voteEndsAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((voteEndsAt - Date.now()) / 1000));
      setVoteTimeLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [voteEndsAt]);

  useEffect(() => {
    if (!nextRoundAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((nextRoundAt - Date.now()) / 1000));
      setNextRoundTimeLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [nextRoundAt]);

  const isGameEnd = !!voteEndsAt;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-3 sm:px-4 py-3 border-b border-gray-700/50 text-center">
        {isGameEnd ? (
          <>
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-2xl">🏆</span>
              <h2 className="text-lg sm:text-xl font-bold text-white">Game Over!</h2>
            </div>
            {isWinner ? (
              <p className="text-xs sm:text-sm text-yellow-400 font-semibold">
                You won! Congratulations!
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-gray-400">
                {winner?.username} won with {winner?.score} points
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-white">{round}</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white">Round Complete!</h2>
            </div>
            <p className="text-xs text-gray-400">
              Round {round} of {totalRounds}
              {nextRoundAt && nextRoundTimeLeft > 0 && (
                <span className="ml-2 text-blue-400 font-semibold">
                  - Next round in {nextRoundTimeLeft}s
                </span>
              )}
            </p>
          </>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Correct Answer */}
        <div className="px-3 sm:px-4 py-3 border-b border-gray-700/50">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 text-center">
            {isGameEnd ? "Last Round's Answer" : "Correct Answer"}
          </p>
          <div className="flex items-center justify-center gap-3">
            {correctAnswer.albumImageUrl && (
              <img
                src={correctAnswer.albumImageUrl}
                alt={correctAnswer.title}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-semibold text-white truncate max-w-[200px]">
                {correctAnswer.title}
              </p>
              <p className="text-xs sm:text-sm text-gray-400 truncate max-w-[200px]">
                {correctAnswer.artist}
              </p>
            </div>
            {correctAnswer.submittedBy && (
              <div className="flex items-center gap-2 shrink-0">
                {correctAnswer.submittedBy.userImage ? (
                  <img
                    src={correctAnswer.submittedBy.userImage}
                    alt={correctAnswer.submittedBy.username}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-600 flex items-center justify-center">
                    <span className="text-sm sm:text-base text-gray-300 font-semibold">
                      {correctAnswer.submittedBy.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">submitted by</p>
                  <p className="text-xs sm:text-sm font-semibold text-white">
                    {correctAnswer.submittedBy.username}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* My Score Summary */}
        {myScore && (
          <div className="px-3 sm:px-4 py-2.5 border-b border-gray-700/50">
            <div className="flex items-center justify-around">
              <div className="text-center">
                <p className="text-xs text-gray-400">{isGameEnd ? "Final Rank" : "Rank"}</p>
                <p className="text-lg sm:text-xl font-bold text-white">#{myRank}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400">{isGameEnd ? "Total Score" : "Score"}</p>
                <p className="text-lg sm:text-xl font-bold text-green-400">{myScore.score}</p>
              </div>
              {(isGameEnd ? (myScore.bestStreak ?? myScore.streak) : myScore.streak) >
                (isGameEnd ? 0 : 1) && (
                <div className="text-center">
                  <p className="text-xs text-gray-400">{isGameEnd ? "Best Streak" : "Streak"}</p>
                  <p className="text-lg sm:text-xl font-bold text-yellow-400">
                    🔥 {isGameEnd ? (myScore.bestStreak ?? myScore.streak) : myScore.streak}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="px-3 sm:px-4 py-3">
          <Leaderboard
            entries={sortedScores.map<LeaderboardEntry>((s) => ({
              userId: s.userId,
              displayName: s.username,
              image: s.userImage,
              score: s.score,
              streak: s.streak,
              bestStreak: s.bestStreak,
            }))}
            currentUserId={myUserId}
            title={isGameEnd ? "Final Standings" : "Leaderboard"}
            highlightWinner={isGameEnd}
            streakLabel="Streak"
            bestStreakLabel={isGameEnd ? "Best streak" : undefined}
          />
        </div>
      </div>

      {/* Voting UI */}
      {isGameEnd && onPlayAgain && (
        <div className="shrink-0 px-3 sm:px-4 py-3 border-t border-gray-700/50 space-y-2">
          {myVote === undefined ? (
            <>
              <p className="text-center text-sm text-gray-400 mb-2">
                Continue playing? ({votesCount}/{totalPlayers} voted) - {voteTimeLeft}s left
              </p>
              <div className="flex gap-2">
                <Button onClick={() => onPlayAgain(true)} className="flex-1" size="md">
                  Yes
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onPlayAgain(false)}
                  className="flex-1"
                  size="md"
                >
                  No
                </Button>
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-gray-400 py-2">
              Waiting for others... {myVote ? "✅ Voted Yes" : "❌ Voted No"} ({votesCount}/
              {totalPlayers})
            </p>
          )}
        </div>
      )}
    </div>
  );
}
