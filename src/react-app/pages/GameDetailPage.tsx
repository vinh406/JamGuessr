import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import Header from "../components/Header";

interface PlayerResult {
  userId: string | null;
  score: number;
  streak: number;
  rank: number;
  displayName: string;
  image: string | null;
}

interface GameDetail {
  id: string;
  roomName: string;
  playlist: { name: string; imageUrl?: string } | null;
  settings: { rounds: number; timePerRound: number; audioTime: number };
  songs: Array<{ id: string; title: string; artist: string; album: string; albumImageUrl?: string }>;
  players: PlayerResult[];
  playedAt: string;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-gray-800/50 rounded-xl border border-gray-700/50 animate-pulse ${className}`}>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-gray-700 shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-5 bg-gray-700 rounded w-2/3" />
            <div className="h-3 bg-gray-700/50 rounded w-1/3" />
            <div className="h-2.5 bg-gray-700/30 rounded w-1/4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 animate-pulse overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-4 px-6 py-4 ${i < rows - 1 ? "border-b border-gray-700/50" : ""}`}
        >
          <div className="w-8 h-4 bg-gray-700 rounded shrink-0" />
          {i === 0 ? (
            <div className="w-10 h-10 rounded-full bg-gray-700 shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-700/50 shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-700 rounded w-2/5" />
            <div className="h-3 bg-gray-700/50 rounded w-1/4" />
          </div>
          <div className="h-5 w-16 bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  );
}

const rankMedal: Record<number, { color: string; label: string }> = {
  1: { color: "text-yellow-400", label: "1st" },
  2: { color: "text-gray-300", label: "2nd" },
  3: { color: "text-amber-600", label: "3rd" },
};

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/games/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setGame(data);
        else navigate("/history");
      })
      .catch(() => navigate("/history"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
        <Header />
        <main className="max-w-3xl mx-auto px-6 py-8">
          <div className="mb-6 w-32 h-4 bg-gray-700/50 rounded animate-pulse" />
          <div className="space-y-6">
            <SkeletonBlock />
            <div>
              <div className="mb-4 w-32 h-5 bg-gray-700/50 rounded animate-pulse" />
              <SkeletonList rows={5} />
            </div>
            <div>
              <div className="mb-4 w-24 h-5 bg-gray-700/50 rounded animate-pulse" />
              <SkeletonList rows={4} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!game) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate("/history")}
          className="text-gray-400 hover:text-white transition-colors mb-6 flex items-center gap-2 cursor-pointer group"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to history
        </button>

        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-4">
            {game.playlist?.imageUrl ? (
              <img src={game.playlist.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gray-700/50 shrink-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">
                {game.playlist?.name ?? "Unknown Playlist"}
              </h1>
              <p className="text-gray-400 text-sm">
                {game.roomName} &middot; {game.settings.rounds} rounds
                {game.settings.timePerRound > 0 && (
                  <> &middot; {Math.round(game.settings.timePerRound / 1000)}s per round</>
                )}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {new Date(game.playedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>

        <h2 className="text-lg font-bold text-white mb-4">Leaderboard</h2>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden mb-8">
          {game.players.length === 0 ? (
            <p className="text-gray-400 text-sm px-6 py-6 text-center">No players recorded for this game.</p>
          ) : (
            game.players.map((player, i) => {
              const medal = rankMedal[player.rank];
              return (
                <div
                  key={player.userId ?? `player-${i}`}
                  className={`flex items-center gap-4 px-6 py-4 ${
                    i < game.players.length - 1 ? "border-b border-gray-700/50" : ""
                  }`}
                >
                  <span
                    className={`text-lg font-bold w-8 text-center shrink-0 ${
                      medal?.color ?? "text-gray-500"
                    }`}
                  >
                    {player.rank}
                  </span>
                  <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden shrink-0">
                    {player.image ? (
                      <img src={player.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">
                        {player.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{player.displayName}</p>
                    <p className="text-gray-500 text-xs">Best streak: {player.streak}</p>
                  </div>
                  <span className="text-lg font-bold text-green-400 shrink-0">{player.score.toLocaleString()}</span>
                </div>
              );
            })
          )}
        </div>

        <h2 className="text-lg font-bold text-white mb-4">
          Songs <span className="text-gray-500 font-normal">({game.songs.length})</span>
        </h2>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
          {game.songs.length === 0 ? (
            <p className="text-gray-400 text-sm px-6 py-6 text-center">No songs recorded for this game.</p>
          ) : (
            game.songs.map((song, i) => (
              <div
                key={song.id}
                className={`flex items-center gap-4 px-6 py-3 ${
                  i < game.songs.length - 1 ? "border-b border-gray-700/50" : ""
                }`}
              >
                <span className="text-gray-500 text-sm w-6 text-right shrink-0">{i + 1}</span>
                {song.albumImageUrl ? (
                  <img src={song.albumImageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-700/50 shrink-0 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
                      />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{song.title}</p>
                  <p className="text-gray-400 text-xs truncate">{song.artist}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
