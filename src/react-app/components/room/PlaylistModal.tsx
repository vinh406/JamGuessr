import type { Playlist } from "../../../shared/types";
import { Modal } from "../common/Modal";
import { Input, Button } from "../ui";

interface PlaylistModalProps {
  selectedPlaylist: Playlist | null;
  availablePlaylists: Playlist[];
  isLoading: boolean;
  error: string | null;
  spotifyLink: string;
  onSpotifyLinkChange: (link: string) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onSubmitSpotifyLink: () => void;
  onCreateBlend: () => void;
  onClose: () => void;
}

export function PlaylistModal({
  selectedPlaylist,
  availablePlaylists,
  isLoading,
  error,
  spotifyLink,
  onSpotifyLinkChange,
  onSelectPlaylist,
  onSubmitSpotifyLink,
  onCreateBlend,
  onClose,
}: PlaylistModalProps) {
  return (
    <Modal
      title="Select Playlist"
      onClose={onClose}
      maxWidth="lg"
      scrollable
      footer={
        <Button variant="secondary" onClick={onClose} className="w-full" size="lg">
          Cancel
        </Button>
      }
    >
      {/* Spotify Link Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">Import from Spotify</label>
        <div className="flex gap-3">
          <Input
            type="text"
            value={spotifyLink}
            onChange={(e) => onSpotifyLinkChange(e.target.value)}
            placeholder="Paste Spotify playlist link..."
            className="flex-1"
          />
          <Button onClick={onSubmitSpotifyLink} disabled={!spotifyLink.trim()}>
            Import
          </Button>
        </div>
      </div>

      {/* Create Blend Button */}
      <Button
        onClick={onCreateBlend}
        className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all mb-6"
        size="lg"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        Create Blend from Players
      </Button>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-gray-700/50"></div>
        <span className="text-gray-400 text-sm">or choose from list</span>
        <div className="flex-1 h-px bg-gray-700/50"></div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3" role="status" aria-label="Loading playlists">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 rounded-xl bg-gray-700/30 border-2 border-transparent animate-pulse"
            >
              <div className="w-14 h-14 rounded-lg bg-gray-600 shrink-0" />
              <div className="flex-1 min-w-0 space-y-2.5">
                <div className="h-4 bg-gray-600 rounded w-3/4" />
                <div className="h-3 bg-gray-600/50 rounded w-1/2" />
                <div className="h-2.5 bg-gray-600/30 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && <div className="text-center py-8 text-red-400">{error}</div>}

      {/* Playlists List */}
      {!isLoading && !error && (
        <div className="space-y-3">
          {availablePlaylists.length === 0 ? (
            <p className="text-center text-gray-400 py-8">
              No playlists in your library yet. Import a public Spotify playlist to get started!
            </p>
          ) : (
            availablePlaylists.map((playlist) => (
              <Button
                variant="secondary"
                key={playlist.id}
                onClick={() => onSelectPlaylist(playlist)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left ${
                  selectedPlaylist?.id === playlist.id
                    ? "bg-green-500/20 border-2 border-green-500"
                    : "bg-gray-700/30 border-2 border-transparent hover:border-gray-600"
                }`}
              >
                {playlist.imageUrl ? (
                  <img
                    src={playlist.imageUrl}
                    alt={playlist.name}
                    className="w-14 h-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-600 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-gray-400"
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
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{playlist.name}</p>
                  <p className="text-sm text-gray-400 truncate">
                    {playlist.description || "No description"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{playlist.trackCount} tracks</p>
                </div>
                {selectedPlaylist?.id === playlist.id && (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </Button>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}
