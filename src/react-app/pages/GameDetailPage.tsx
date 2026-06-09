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
      <div className="min-h-screen bg-gray-900">
        <Header />
        <main className="max-w-3xl mx-auto px-6 py-8">
          <p className="text-gray-400">Loading...</p>
        </main>
      </div>
    );
  }

  if (!game) return null;

  const rankColors: Record<number, string> = {
    1: "text-yellow-400",
    2: "text-gray-300",
    3: "text-amber-600",
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate("/history")}
          className="text-gray-400 hover:text-white transition-colors mb-6 flex items-center gap-2 cursor-pointer"
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

        <div className="bg-gray-800 border border-gray-700/50 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-4 mb-4">
            {game.playlist?.imageUrl && (
              <img src={game.playlist.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">
                {game.playlist?.name ?? "Unknown Playlist"}
              </h1>
              <p className="text-gray-400 text-sm">
                Room {game.roomName} · {game.settings.rounds} rounds ·{" "}
                {Math.round(game.settings.timePerRound / 1000)}s per round
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

        {/* Leaderboard */}
        <h2 className="text-xl font-semibold text-white mb-4">Leaderboard</h2>
        <div className="bg-gray-800 border border-gray-700/50 rounded-xl overflow-hidden mb-8">
          {game.players.map((player, i) => (
            <div
              key={player.userId ?? `player-${i}`}
              className={`flex items-center gap-4 px-6 py-4 ${
                i < game.players.length - 1 ? "border-b border-gray-700/50" : ""
              }`}
            >
              <span
                className={`text-2xl font-bold w-8 text-center ${rankColors[player.rank] ?? "text-gray-500"}`}
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
              <span className="text-lg font-bold text-green-400">{player.score.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* Song list */}
        <h2 className="text-xl font-semibold text-white mb-4">Songs ({game.songs.length})</h2>
        <div className="bg-gray-800 border border-gray-700/50 rounded-xl overflow-hidden">
          {game.songs.map((song, i) => (
            <div
              key={song.id}
              className={`flex items-center gap-4 px-6 py-3 ${
                i < game.songs.length - 1 ? "border-b border-gray-700/50" : ""
              }`}
            >
              <span className="text-gray-500 text-sm w-6 text-right shrink-0">{i + 1}</span>
              {song.albumImageUrl && (
                <img src={song.albumImageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{song.title}</p>
                <p className="text-gray-400 text-xs truncate">{song.artist}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
