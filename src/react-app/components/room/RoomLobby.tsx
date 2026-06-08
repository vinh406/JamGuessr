import type { Player, Playlist } from "../../../shared/types";
import { Button, DefaultAvatar } from "../ui";

interface RoomLobbyProps {
  roomName: string;
  players: Player[];
  selectedPlaylist: Playlist | null;
  gameSettings: { rounds: number; timePerRound: number; audioTime: number };
  isHost: boolean;
  isReady: boolean;
  canStartGame: boolean;
  isStartingGame: boolean;
  currentWarning: string | null;
  currentUser: { username: string; userId: string } | null;
  isImporting?: boolean;
  onToggleReady: () => void;
  onStartGame: () => void;
  onOpenSettings: () => void;
  onOpenPlaylist: () => void;
}

export function RoomLobby({
  roomName,
  players,
  selectedPlaylist,
  gameSettings,
  isHost,
  isReady,
  canStartGame,
  isStartingGame,
  currentWarning,
  currentUser,
  isImporting,
  onToggleReady,
  onStartGame,
  onOpenSettings,
  onOpenPlaylist,
}: RoomLobbyProps) {
  return (
    <div className="space-y-6">
      {/* Room Info */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
        <div className="flex flex-wrap items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Game Room</h2>
            <p className="text-gray-400">Share this code with friends to invite them</p>
          </div>
          <div className="px-6 py-3 bg-gradient-to-r from-green-400/20 to-green-600/20 rounded-xl border border-green-500/30">
            <span className="text-3xl font-bold text-green-400 tracking-wider">{roomName}</span>
          </div>
        </div>

        {/* Playlist & Settings Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Playlist Selection */}
          <Button
            variant="secondary"
            onClick={onOpenPlaylist}
            disabled={!isHost || isImporting || isStartingGame}
            className={`flex items-center gap-3`}
          >
            <svg
              className="w-5 h-5 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-white font-medium truncate">
                {selectedPlaylist ? selectedPlaylist.name : "Select Playlist"}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {selectedPlaylist
                  ? selectedPlaylist.id === "blend"
                    ? "Blend from players"
                    : `${selectedPlaylist.trackCount} tracks`
                  : "Choose a playlist"}
              </p>
            </div>
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>

          {/* Settings Button */}
          <Button
            variant="secondary"
            onClick={onOpenSettings}
            disabled={!isHost || isStartingGame}
            className="flex items-center gap-3"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-white font-medium">Game Settings</p>
              <p className="text-xs text-gray-400">
                {gameSettings.rounds} rounds · {gameSettings.timePerRound}s · {gameSettings.audioTime}s audio
              </p>
            </div>
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Players List */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          Players ({players.length})
        </h3>
        <div className="space-y-3">
          {players.map((player) => (
            <div
              key={player.userId}
              className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                player.isHost
                  ? "bg-yellow-500/10 border border-yellow-500/30"
                  : player.isReady
                    ? "bg-green-500/10 border border-green-500/30"
                    : "bg-gray-700/30 border border-gray-600/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <DefaultAvatar name={player.username} src={player.userImage} size={40} />
                <div>
                  <p className="text-white font-medium">
                    {player.username}
                    {player.userId === currentUser?.userId && (
                      <span className="ml-2 text-gray-400 text-sm">(You)</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-400">
                    {player.isHost ? "Host" : player.isReady ? "Ready to play!" : "Not ready"}
                  </p>
                </div>
              </div>
              <div
                className={`w-3 h-3 rounded-full ${
                  player.isHost ? "bg-yellow-500" : player.isReady ? "bg-green-500" : "bg-gray-500"
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
        <div className="space-y-4">
          {!isHost && (
            <Button
              onClick={onToggleReady}
              disabled={isStartingGame || isImporting}
              variant={isReady ? "primary" : "secondary"}
              size="lg"
              className={`w-full ${
                isReady ? "bg-green-500 text-white hover:bg-green-600" : "text-gray-300"
              }`}
            >
              {isReady ? "✓ Ready!" : "Mark as Ready"}
            </Button>
          )}

          {isHost && (
            <Button
              onClick={onStartGame}
              disabled={!canStartGame || isStartingGame || isImporting}
              size="lg"
              className={`w-full transition-all ${
                canStartGame && !isStartingGame
                  ? "bg-gradient-to-r from-green-400 to-green-600 text-white hover:from-green-500 hover:to-green-700"
                  : "bg-gray-700/30 text-gray-500 cursor-not-allowed"
              }`}
            >
              {isStartingGame ? "Starting..." : "Start Game"}
            </Button>
          )}

          {!isHost && (
            <p className="text-center text-gray-400 text-sm">
              Waiting for host to start the game...
            </p>
          )}

          {isHost && currentWarning && (
            <p className="text-center text-yellow-400 text-sm">⚠️ {currentWarning}</p>
          )}
        </div>
      </div>
    </div>
  );
}
