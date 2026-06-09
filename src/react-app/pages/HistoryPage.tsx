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
    <div className="min-h-screen bg-gray-900">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Game History</h1>

        {loading && <p className="text-gray-400">Loading...</p>}

        {!loading && games.length === 0 && (
          <p className="text-gray-400">No games played yet. Join a room and start playing!</p>
        )}

        <div className="space-y-4">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => navigate(`/history/${game.id}`)}
              className="w-full text-left bg-gray-800 border border-gray-700/50 rounded-xl p-5 hover:bg-gray-700/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                {game.playlist?.imageUrl && (
                  <img
                    src={game.playlist.imageUrl}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">
                    {game.playlist?.name ?? "Unknown Playlist"}
                  </p>
                  <p className="text-gray-400 text-sm">
                    Room {game.roomName} · {game.playerCount} player
                    {game.playerCount !== 1 ? "s" : ""} · {game.settings.rounds} rounds
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
                  className="w-5 h-5 text-gray-500 shrink-0"
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
      </main>
    </div>
  );
}
