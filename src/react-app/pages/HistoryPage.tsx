import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import Header from "../components/Header";

interface GameListItem {
  id: string;
  roomName: string;
  playlist: { name: string; imageUrl?: string } | null;
  settings: { rounds: number };
  playedAt: string;
  playerCount: number;
}

function SkeletonCard() {
  return (
    <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-lg bg-gray-700 shrink-0" />
        <div className="flex-1 space-y-2.5">
          <div className="h-4 bg-gray-700 rounded w-3/5" />
          <div className="h-3 bg-gray-700/50 rounded w-2/5" />
          <div className="h-2.5 bg-gray-700/30 rounded w-1/4" />
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [games, setGames] = useState<GameListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/games")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setGames(data.games);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">
          Game History
        </h1>

        {loading && (
          <div className="space-y-4" role="status" aria-label="Loading game history">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {!loading && games.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-800/50 border border-gray-700/50 flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-gray-300 font-semibold text-lg mb-2">No games yet</p>
            <p className="text-gray-500 max-w-sm mx-auto">
              Your game history will appear here. Join a room from the home page and start guessing songs with friends.
            </p>
          </div>
        )}

        {!loading && games.length > 0 && (
          <div className="space-y-3">
            {games.map((game) => (
              <button
                key={game.id}
                onClick={() => navigate(`/history/${game.id}`)}
                className="w-full text-left bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 hover:bg-gray-700/40 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  {game.playlist?.imageUrl ? (
                    <img
                      src={game.playlist.imageUrl}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-700/50 shrink-0 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">
                      {game.playlist?.name ?? "Unknown Playlist"}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {game.roomName} &middot; {game.playerCount} player
                      {game.playerCount !== 1 ? "s" : ""} &middot; {game.settings.rounds} rounds
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {new Date(game.playedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-500 shrink-0 group-hover:text-gray-300 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
