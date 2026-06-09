import { DefaultAvatar } from "../ui/DefaultAvatar";

export interface LeaderboardEntry {
  userId: string | null;
  displayName: string;
  image?: string | null;
  score: number;
  streak?: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string | null;
  title?: string;
  emptyMessage?: string;
  highlightWinner?: boolean;
  streakLabel?: string;
}

export function Leaderboard({
  entries,
  currentUserId,
  title = "Leaderboard",
  emptyMessage = "No entries yet.",
  highlightWinner = false,
  streakLabel,
}: LeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div>
        {title && <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{title}</p>}
        <p className="text-gray-400 text-sm px-6 py-6 text-center">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      {title && <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">{title}</p>}
      <div className="space-y-1">
        {entries.map((entry, index) => {
          const rank = index + 1;
          const isMe = currentUserId != null && entry.userId === currentUserId;
          const isWinner = highlightWinner && rank === 1;

          return (
            <div
              key={entry.userId ?? `entry-${index}`}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                isWinner
                  ? "bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30"
                  : isMe
                    ? "bg-green-500/20 border border-green-500/30"
                    : "bg-gray-700/20"
              }`}
            >
              <span
                className={`text-base font-bold w-7 text-center shrink-0 ${
                  rank === 1
                    ? "text-yellow-400"
                    : rank === 2
                      ? "text-gray-300"
                      : rank === 3
                        ? "text-amber-600"
                        : "text-gray-500"
                }`}
              >
                {rank}
              </span>
              <DefaultAvatar name={entry.displayName} src={entry.image} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {entry.displayName}
                  {isMe && <span className="ml-1.5 text-xs text-green-400">(You)</span>}
                </p>
                {streakLabel && entry.streak != null && entry.streak > 0 && (
                  <p className="text-xs text-gray-500">
                    {streakLabel}: {entry.streak}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {entry.streak != null && entry.streak > 0 && (
                  <span className="text-xs text-yellow-400">🔥 {entry.streak}</span>
                )}
                <span className="text-sm font-bold text-green-400">
                  {entry.score.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
