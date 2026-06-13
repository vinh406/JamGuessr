import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import PageLayout from "../components/common/PageLayout";

import { Button, Input } from "../components/ui";
import { Plus, Library } from "../components/ui/icons";
import { generateRoomCode, ROOM_CODE_LENGTH } from "../../shared/constants";
interface LibraryStats {
  totalSongs: number;
  totalPlaylists: number;
  totalAlbums: number;
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/library/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const handleCreateRoom = () => {
    const code = generateRoomCode();
    sessionStorage.setItem("chat-username", user?.name || "Player");
    navigate(`/room/${code}`);
  };

  const handleJoinRoom = () => {
    if (roomCode.trim()) {
      sessionStorage.setItem("chat-username", user?.name || "Player");
      navigate(`/room/${roomCode.trim()}`);
    }
  };

  const hasStats =
    stats && (stats.totalSongs > 0 || stats.totalPlaylists > 0 || stats.totalAlbums > 0);

  return (
    <PageLayout>
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Hey,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
              {user?.name?.split(" ")[0] || "Player"}
            </span>
          </h1>
          <p className="text-gray-400 text-lg">Your music. Your game. Let's go.</p>
          {statsLoading ? (
            <p className="text-gray-600 text-sm mt-2">
              <span className="inline-block w-8 h-3 bg-gray-700/50 rounded animate-pulse" />
              {" tracks · "}
              <span className="inline-block w-8 h-3 bg-gray-700/50 rounded animate-pulse" />
              {" playlists · "}
              <span className="inline-block w-8 h-3 bg-gray-700/50 rounded animate-pulse" />
              {" albums in your library"}
            </p>
          ) : (
            <p className="text-gray-500 text-sm mt-2">
              {hasStats ? (
                <>
                  {stats!.totalSongs} track{stats!.totalSongs !== 1 ? "s" : ""}
                  {stats!.totalPlaylists > 0 &&
                    ` · ${stats!.totalPlaylists} playlist${stats!.totalPlaylists !== 1 ? "s" : ""}`}
                  {stats!.totalAlbums > 0 &&
                    ` · ${stats!.totalAlbums} album${stats!.totalAlbums !== 1 ? "s" : ""}`}
                  {" in your library"}
                </>
              ) : (
                "Add tracks in your library to get started"
              )}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCreateRoom}
              className="bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 rounded-2xl p-6 text-left transition-all hover:shadow-lg hover:shadow-green-500/20 group"
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div className="text-white font-semibold">Create Room</div>
              <div className="text-white/70 text-sm">Start a new game</div>
            </button>

            <button
              onClick={() => navigate("/library")}
              className="bg-gray-800/60 hover:bg-gray-800/80 rounded-2xl p-6 text-left border border-gray-700/30 hover:border-gray-600/50 transition-all group"
            >
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Library className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-white font-semibold">Library</div>
              <div className="text-gray-400 text-sm">Manage your music</div>
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700/30" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gray-900 px-3 text-xs text-gray-500">or join a room</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              variant="blue"
              type="text"
              placeholder="Enter room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={ROOM_CODE_LENGTH}
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
            />
            <Button variant="blue" size="md" onClick={handleJoinRoom} disabled={!roomCode.trim()}>
              Join
            </Button>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
