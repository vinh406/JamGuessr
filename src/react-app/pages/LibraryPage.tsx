import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import Header from "../components/Header";
import { Button, Input } from "../components/ui";
import { Modal } from "../components/common/Modal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import LoadingSpinner from "../components/common/LoadingSpinner";

interface TrackSource {
  type: "direct" | "playlist" | "album";
  playlistId?: string;
  albumId?: string;
}

interface Track {
  id: string;
  spotifyId: string;
  name: string;
  artists: { name: string; id?: string }[];
  albumName?: string;
  albumId?: string;
  durationMs?: number;
  addedAt: string;
  sources: TrackSource[];
}

interface Playlist {
  id: string;
  spotifyId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  trackCount: number;
  addedAt: string;
}

interface Album {
  id: string;
  spotifyId: string;
  name: string;
  artists: { name: string }[];
  imageUrl?: string;
  releaseDate?: string;
  trackCount: number;
  addedAt: string;
}

interface LibraryData {
  tracks: Track[];
  playlists: Playlist[];
  albums: Album[];
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function parseSpotifyLinkType(link: string): "track" | "playlist" | "album" | null {
  const clean = link.trim();
  const trackMatch = clean.match(/(?:track|spotify:track)[:/]([a-zA-Z0-9]{22})/);
  if (trackMatch) return "track";
  const playlistMatch = clean.match(/(?:playlist|spotify:playlist)[:/]([a-zA-Z0-9]{22})/);
  if (playlistMatch) return "playlist";
  const albumMatch = clean.match(/(?:album|spotify:album)[:/]([a-zA-Z0-9]{22})/);
  if (albumMatch) return "album";
  if (/^[a-zA-Z0-9]{22}$/.test(clean)) return "track";
  return null;
}

export default function LibraryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "track" | "playlist" | "album";
    id: string;
    name: string;
    cascadeCount?: number;
  } | null>(null);
  const [trackListModal, setTrackListModal] = useState<{
    type: "playlist" | "album";
    data: Playlist | Album;
    tracks: Track[];
  } | null>(null);
  const [removingTrackId, setRemovingTrackId] = useState<string | null>(null);

  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/library/user");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // handled by empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const detectedType = link.trim() ? parseSpotifyLinkType(link) : null;

  const handleImport = async () => {
    if (!link.trim() || importing) return;
    setImporting(true);
    setImportError("");
    setImportSuccess("");
    try {
      const res = await fetch("/api/library/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: link.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const label = json.type === "track" ? "Track added" : `${json.type === "playlist" ? "Playlist" : "Album"} imported (${json.trackCount ?? "?"} tracks)`;
        setImportSuccess(label);
        setLink("");
        fetchLibrary();
        setTimeout(() => setImportSuccess(""), 4000);
      } else {
        setImportError(json.error || "Failed to import");
        setTimeout(() => setImportError(""), 5000);
      }
    } catch {
      setImportError("Network error — try again");
      setTimeout(() => setImportError(""), 5000);
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    try {
      const endpoint = type === "track"
        ? `/api/library/track/${id}`
        : type === "playlist"
          ? `/api/library/playlist/${id}`
          : `/api/library/album/${id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) {
        setDeleteTarget(null);
        fetchLibrary();
      }
    } catch {
      // ignore
    }
  };

  const handleTrackFromSourceRemove = async (trackId: string) => {
    setRemovingTrackId(trackId);
    try {
      const res = await fetch(`/api/library/track/${trackId}`, { method: "DELETE" });
      if (res.ok) {
        fetchLibrary();
      }
    } finally {
      setRemovingTrackId(null);
    }
  };

  const getPlaylistTracks = (playlistId: string): Track[] => {
    if (!data) return [];
    return data.tracks.filter((t) =>
      t.sources.some((s) => s.type === "playlist" && s.playlistId === playlistId),
    );
  };

  const getAlbumTracks = (albumId: string): Track[] => {
    if (!data) return [];
    return data.tracks.filter((t) =>
      t.sources.some((s) => s.type === "album" && s.albumId === albumId),
    );
  };

  const directTracks = data
    ? data.tracks.filter((t) =>
        t.sources.every((s) => s.type !== "playlist" && s.type !== "album") ||
        t.sources.length === 0,
      )
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header>
        <div className="flex items-center gap-3">
          {user?.image && (
            <img src={user.image} alt={user.name} className="w-8 h-8 rounded-full" />
          )}
          <Button variant="ghost" onClick={() => navigate("/")}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </Button>
        </div>
      </Header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">My Library</h1>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="xl" className="text-amber-500" />
          </div>
        )}

        {!loading && data && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-800/30 rounded-2xl p-5 text-center border border-gray-700/30">
                <div className="text-3xl font-bold text-white mb-1">{data.tracks.length}</div>
                <div className="text-gray-400 text-sm">Tracks</div>
              </div>
              <div className="bg-gray-800/30 rounded-2xl p-5 text-center border border-gray-700/30">
                <div className="text-3xl font-bold text-white mb-1">{data.playlists.length}</div>
                <div className="text-gray-400 text-sm">Playlists</div>
              </div>
              <div className="bg-gray-800/30 rounded-2xl p-5 text-center border border-gray-700/30">
                <div className="text-3xl font-bold text-white mb-1">{data.albums.length}</div>
                <div className="text-gray-400 text-sm">Albums</div>
              </div>
            </div>

            <div className="bg-gray-800/40 backdrop-blur-sm rounded-3xl border border-gray-700/50 p-6 mb-8">
              <h2 className="text-lg font-bold text-white mb-4">Add from Spotify</h2>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Paste any Spotify link (song, playlist, or album)"
                    value={link}
                    onChange={(e) => {
                      setLink(e.target.value);
                      setImportError("");
                      setImportSuccess("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && detectedType) handleImport();
                    }}
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  disabled={!detectedType || importing}
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Importing
                    </span>
                  ) : detectedType === "track" ? "Add Track" : detectedType === "playlist" ? "Import Playlist" : detectedType === "album" ? "Import Album" : "Import"}
                </Button>
              </div>

              {detectedType && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Detected as <span className="font-medium text-amber-400 capitalize">{detectedType}</span>
                </div>
              )}

              {importError && (
                <div className="mt-3 flex items-center gap-2 text-sm text-red-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {importError}
                </div>
              )}

              {importSuccess && (
                <div className="mt-3 flex items-center gap-2 text-sm text-green-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {importSuccess}
                </div>
              )}
            </div>

            {directTracks.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  Tracks
                  <span className="text-gray-500 font-normal text-sm">({directTracks.length})</span>
                </h2>
                <div className="space-y-2">
                  {directTracks.map((track) => (
                    <div key={track.id} className="bg-gray-800/40 rounded-xl px-4 py-3 border border-gray-700/30 flex items-center gap-4 group hover:border-gray-600/50 transition-colors">
                      <div className="w-10 h-10 bg-gray-700/50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">{track.name}</div>
                        <div className="text-gray-400 text-sm truncate">
                          {track.artists.map((a) => a.name).join(", ")}
                          {track.albumName ? ` · ${track.albumName}` : ""}
                        </div>
                      </div>
                      {track.durationMs ? (
                        <div className="text-gray-500 text-sm tabular-nums flex-shrink-0">{formatDuration(track.durationMs)}</div>
                      ) : null}
                      <button
                        onClick={() => setDeleteTarget({ type: "track", id: track.id, name: track.name })}
                        className="text-gray-600 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.playlists.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Playlists
                  <span className="text-gray-500 font-normal text-sm">({data.playlists.length})</span>
                </h2>
                <div className="space-y-3">
                  {data.playlists.map((playlist) => {
                    const tracks = getPlaylistTracks(playlist.id);
                    return (
                      <button
                        key={playlist.id}
                        onClick={() => setTrackListModal({ type: "playlist", data: playlist, tracks })}
                        className="w-full bg-gray-800/40 rounded-2xl p-4 border border-gray-700/30 flex items-center gap-4 hover:border-gray-600/50 transition-colors text-left group"
                      >
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {playlist.imageUrl ? (
                            <img src={playlist.imageUrl} alt={playlist.name} className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="text-white font-semibold truncate">{playlist.name}</div>
                          <div className="text-gray-400 text-sm">{playlist.trackCount} tracks · {tracks.length} in library</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-gray-500 text-sm">View tracks</span>
                          <svg className="w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {data.albums.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  Albums
                  <span className="text-gray-500 font-normal text-sm">({data.albums.length})</span>
                </h2>
                <div className="space-y-3">
                  {data.albums.map((album) => {
                    const tracks = getAlbumTracks(album.id);
                    return (
                      <button
                        key={album.id}
                        onClick={() => setTrackListModal({ type: "album", data: album, tracks })}
                        className="w-full bg-gray-800/40 rounded-2xl p-4 border border-gray-700/30 flex items-center gap-4 hover:border-gray-600/50 transition-colors text-left group"
                      >
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {album.imageUrl ? (
                            <img src={album.imageUrl} alt={album.name} className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="text-white font-semibold truncate">{album.name}</div>
                          <div className="text-gray-400 text-sm">
                            {album.artists.map((a) => a.name).join(", ")} · {album.trackCount} tracks · {tracks.length} in library
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-gray-500 text-sm">View tracks</span>
                          <svg className="w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {data.tracks.length === 0 && data.playlists.length === 0 && data.albums.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Your library is empty</h3>
                <p className="text-gray-400">Paste a Spotify link above to add your first track, playlist, or album.</p>
              </div>
            )}
          </>
        )}
      </main>

      {trackListModal && (
        <Modal
          title={trackListModal.data.name}
          onClose={() => setTrackListModal(null)}
          maxWidth="lg"
          scrollable
          footer={
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">{trackListModal.tracks.length} tracks in library</span>
              <Button variant="secondary" size="sm" onClick={() => {
                const target = trackListModal.data;
                const name = "name" in target ? target.name : "";
                setTrackListModal(null);
                setDeleteTarget({
                  type: trackListModal.type,
                  id: target.id,
                  name,
                  cascadeCount: trackListModal.tracks.length,
                });
              }}>
                Remove {trackListModal.type === "playlist" ? "Playlist" : "Album"}
              </Button>
            </div>
          }
        >
          {trackListModal.tracks.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No tracks from this source in your library.</p>
          ) : (
            <div className="space-y-2">
              {trackListModal.tracks.map((track) => (
                <div key={track.id} className="flex items-center gap-3 py-2 border-b border-gray-700/30 last:border-0 group">
                  <div className="w-8 h-8 bg-gray-700/50 rounded flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{track.name}</div>
                    <div className="text-gray-400 text-xs truncate">
                      {track.artists.map((a) => a.name).join(", ")}
                    </div>
                  </div>
                  {track.durationMs ? (
                    <div className="text-gray-500 text-xs tabular-nums flex-shrink-0">{formatDuration(track.durationMs)}</div>
                  ) : null}
                  <button
                    onClick={() => handleTrackFromSourceRemove(track.id)}
                    disabled={removingTrackId === track.id}
                    className="text-gray-600 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  >
                    {removingTrackId === track.id ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={deleteTarget.type === "track" ? "Remove Track" : deleteTarget.type === "playlist" ? "Remove Playlist" : "Remove Album"}
          message={
            deleteTarget.type === "track"
              ? `Remove "${deleteTarget.name}" from your library?`
              : deleteTarget.cascadeCount
                ? `Remove "${deleteTarget.name}" and all ${deleteTarget.cascadeCount} track(s) from your library?`
                : `Remove "${deleteTarget.name}" from your library?`
          }
          confirmLabel={deleteTarget.type === "track" ? "Remove" : "Remove All"}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
