import { useState, useEffect, useCallback, useRef } from "react";
import Header from "../components/Header";
import { Button, Input } from "../components/ui";
import { Modal } from "../components/common/Modal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { useLibraryImport } from "../hooks/useLibraryImport";
import { useSSE, type SSEState } from "../hooks/useSSE";
import { toast } from "sonner";

interface LibraryItem {
  type: "playlist" | "album" | "tracks";
  id: string;
  spotifyId?: string;
  name: string;
  artists?: { name: string }[];
  imageUrl?: string;
  trackCount: number;
  addedAt: string;
}

interface DrawerTrack {
  id: string;
  spotifyId: string;
  name: string;
  artists: { name: string; id?: string }[];
  albumName?: string;
  albumId?: string;
  albumImageUrl?: string;
  durationMs?: number;
  addedAt: string;
}

interface DrawerState {
  type: "playlist" | "album" | "tracks";
  spotifyId?: string;
  id: string;
  name: string;
  trackCount: number;
}

interface LibraryStats {
  totalSongs: number;
  totalPlaylists: number;
  totalAlbums: number;
  lastUpdated: string;
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
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState<LibraryStats | null>(null);

  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [drawerTracks, setDrawerTracks] = useState<DrawerTrack[]>([]);
  const [drawerCursor, setDrawerCursor] = useState<string | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [link, setLink] = useState("");
  const [removeState, setRemoveState] = useState<SSEState>("idle");
  const removeToastId = useRef<string | number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "track" | "playlist" | "album";
    id: string;
    name: string;
    cascadeCount?: number;
  } | null>(null);
  const [removingTrackId, setRemovingTrackId] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const drawerSentinelRef = useRef<HTMLDivElement>(null);
  const drawerScrollRef = useRef<HTMLDivElement | null>(null);
  const drawerCacheRef = useRef<Map<string, { tracks: DrawerTrack[]; cursor: string | null }>>(
    new Map(),
  );

  const fetchItems = useCallback(
    async (
      cursor?: string,
    ): Promise<{ items: LibraryItem[]; nextCursor: string | null } | null> => {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) params.set("cursor", cursor);
      try {
        const res = await fetch(`/api/library/items?${params}`);
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
    [],
  );

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/library/stats");
      if (res.ok) setStats(await res.json());
    } catch {
      // ignore
    }
  }, []);

  const loadMoreRef = useRef(async () => {});
  loadMoreRef.current = async () => {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    const data = await fetchItems(nextCursor);
    if (data) {
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    }
    setLoadingMore(false);
  };

  const loadDrawerMoreRef = useRef(async () => {});
  loadDrawerMoreRef.current = async () => {
    if (drawerLoading || !drawerCursor || !drawer) return;
    setDrawerLoading(true);
    try {
      let url: string;
      if (drawer.type === "tracks") {
        url = `/api/library/items/tracks?cursor=${encodeURIComponent(drawerCursor)}&limit=50`;
      } else {
        url = `/api/library/items/${drawer.type}/${drawer.spotifyId}/tracks?cursor=${encodeURIComponent(drawerCursor)}&limit=50`;
      }
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setDrawerTracks((prev) => {
        const updated = [...prev, ...data.tracks];
        if (drawer)
          drawerCacheRef.current.set(`${drawer.type}-${drawer.id}`, {
            tracks: updated,
            cursor: data.nextCursor,
          });
        return updated;
      });
      setDrawerCursor(data.nextCursor);
    } catch {
      // ignore
    } finally {
      setDrawerLoading(false);
    }
  };

  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreRef.current();
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleDrawerScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      loadDrawerMoreRef.current();
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [data] = await Promise.all([fetchItems(), fetchStats()]);
      if (data) {
        setItems(data.items);
        setNextCursor(data.nextCursor);
      }
      setLoading(false);
    })();
  }, [fetchItems, fetchStats]);

  const refetchItems = useCallback(async () => {
    const data = await fetchItems();
    if (data) {
      setItems(data.items);
      setNextCursor(data.nextCursor);
    }
    fetchStats();
  }, [fetchItems, fetchStats]);

  const { startImport, state: importState } = useLibraryImport();

  useEffect(() => {
    if (importState === "complete") {
      setLink("");
      refetchItems();
    }
  }, [importState, refetchItems]);

  const removeSSE = useSSE({
    onEvent: (event) => {
      if (event.event === "phase") {
        const d = event.data as { label: string };
        if (removeToastId.current) {
          toast.loading(d.label, { id: removeToastId.current });
        }
      }
    },
    onComplete: () => {
      setRemoveState("complete");
      if (removeToastId.current) {
        toast.success("Removed!", { id: removeToastId.current });
        removeToastId.current = null;
      }
      setDrawer(null);
      refetchItems();
      setTimeout(() => {
        setRemoveState("idle");
        setDeleteTarget(null);
      }, 2000);
    },
    onError: (msg) => {
      setRemoveState("error");
      if (removeToastId.current) {
        toast.error(msg, { id: removeToastId.current });
        removeToastId.current = null;
      }
    },
  });

  const detectedType = link.trim() ? parseSpotifyLinkType(link) : null;

  const handleImport = () => {
    if (!link.trim() || importState === "connecting" || importState === "streaming") return;
    startImport(link.trim());
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;

    if (type === "track") {
      try {
        const res = await fetch(`/api/library/track/${id}`, { method: "DELETE" });
        if (res.ok) {
          setDeleteTarget(null);
          if (drawer) {
            setDrawerTracks((prev) => {
              const updated = prev.filter((t) => t.id !== id);
              drawerCacheRef.current.set(`${drawer.type}-${drawer.id}`, {
                tracks: updated,
                cursor: drawerCursor,
              });
              return updated;
            });
          }
          refetchItems();
        }
      } catch {
        // ignore
      }
    } else {
      setRemoveState("connecting");
      removeToastId.current = toast.loading("Removing...");
      removeSSE.start("/api/library/remove", { type, id });
    }
  };

  const handleTrackRemove = async (trackId: string) => {
    setRemovingTrackId(trackId);
    try {
      const res = await fetch(`/api/library/track/${trackId}`, { method: "DELETE" });
      if (res.ok) {
        setDrawerTracks((prev) => {
          const updated = prev.filter((t) => t.id !== trackId);
          if (drawer)
            drawerCacheRef.current.set(`${drawer.type}-${drawer.id}`, {
              tracks: updated,
              cursor: drawerCursor,
            });
          return updated;
        });
        refetchItems();
      }
    } catch {
      // ignore
    } finally {
      setRemovingTrackId(null);
    }
  };

  const openDrawer = async (item: LibraryItem) => {
    const itemKey = `${item.type}-${item.id}`;
    const cached = drawerCacheRef.current.get(itemKey);
    if (cached) {
      setDrawer({
        type: item.type,
        spotifyId: item.spotifyId,
        id: item.id,
        name: item.name,
        trackCount: item.trackCount,
      });
      setDrawerTracks(cached.tracks);
      setDrawerCursor(cached.cursor);
      setDrawerLoading(false);
      return;
    }
    setDrawer({
      type: item.type,
      spotifyId: item.spotifyId,
      id: item.id,
      name: item.name,
      trackCount: item.trackCount,
    });
    setDrawerTracks([]);
    setDrawerCursor(null);
    setDrawerLoading(true);

    try {
      let url: string;
      if (item.type === "tracks") {
        url = "/api/library/items/tracks?limit=50";
      } else {
        url = `/api/library/items/${item.type}/${item.spotifyId}/tracks?limit=50`;
      }
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const tracks = data.tracks;
      const cursor = data.nextCursor;
      drawerCacheRef.current.set(itemKey, { tracks, cursor });
      setDrawerTracks(tracks);
      setDrawerCursor(cursor);
    } catch {
      // ignore
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawer(null);
  };

  const hasItems = items.length > 0;
  const itemIcon = (type: string) => {
    switch (type) {
      case "playlist":
        return (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 10h16M4 14h16M4 18h16"
            />
          </svg>
        );
      case "album":
        return (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        );
    }
  };

  const gradientForType = (type: string) => {
    switch (type) {
      case "playlist":
        return "from-emerald-500 to-emerald-700";
      case "album":
        return "from-amber-500 to-orange-600";
      default:
        return "from-purple-500 to-pink-600";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">My Library</h1>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="xl" className="text-amber-500" />
          </div>
        )}

        {!loading && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-800/30 rounded-2xl p-5 text-center border border-gray-700/30">
                <div className="text-3xl font-bold text-white mb-1">{stats?.totalSongs ?? 0}</div>
                <div className="text-gray-400 text-sm">Tracks</div>
              </div>
              <div className="bg-gray-800/30 rounded-2xl p-5 text-center border border-gray-700/30">
                <div className="text-3xl font-bold text-white mb-1">
                  {stats?.totalPlaylists ?? 0}
                </div>
                <div className="text-gray-400 text-sm">Playlists</div>
              </div>
              <div className="bg-gray-800/30 rounded-2xl p-5 text-center border border-gray-700/30">
                <div className="text-3xl font-bold text-white mb-1">{stats?.totalAlbums ?? 0}</div>
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
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && detectedType) handleImport();
                    }}
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  disabled={
                    !detectedType || importState === "connecting" || importState === "streaming"
                  }
                >
                  {importState === "idle" ? (
                    detectedType === "track" ? (
                      "Add Track"
                    ) : detectedType === "playlist" ? (
                      "Import Playlist"
                    ) : detectedType === "album" ? (
                      "Import Album"
                    ) : (
                      "Import"
                    )
                  ) : importState === "connecting" ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Connecting
                    </span>
                  ) : importState === "streaming" ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Importing
                    </span>
                  ) : importState === "complete" ? (
                    "Done"
                  ) : (
                    "Failed"
                  )}
                </Button>
              </div>

              {detectedType && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                  <svg
                    className="w-4 h-4 text-amber-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Detected as{" "}
                  <span className="font-medium text-amber-400 capitalize">{detectedType}</span>
                </div>
              )}
            </div>

            {hasItems ? (
              <div className="space-y-3">
                {items.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => openDrawer(item)}
                    className="w-full bg-gray-800/40 rounded-2xl p-4 border border-gray-700/30 flex items-center gap-4 hover:border-gray-600/50 transition-colors text-left group"
                  >
                    <div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradientForType(item.type)} flex items-center justify-center flex-shrink-0 overflow-hidden`}
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        itemIcon(item.type)
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-white font-semibold truncate">{item.name}</div>
                      <div className="text-gray-400 text-sm">
                        {item.type === "album" && item.artists
                          ? `${item.artists.map((a) => a.name).join(", ")} · `
                          : ""}
                        {item.trackCount} track{item.trackCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-gray-500 text-sm">View tracks</span>
                      <svg
                        className="w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-colors"
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

                <div ref={sentinelRef} className="h-4" />
                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <LoadingSpinner size="md" className="text-amber-500" />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-10 h-10 text-gray-600"
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
                <h3 className="text-xl font-bold text-white mb-2">Your library is empty</h3>
                <p className="text-gray-400">
                  Paste a Spotify link above to add your first track, playlist, or album.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {drawer && (
        <Modal
          title={drawer.name}
          onClose={closeDrawer}
          maxWidth="lg"
          scrollable
          scrollContainerRef={drawerScrollRef}
          onScroll={handleDrawerScroll}
          footer={
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">{drawerTracks.length} tracks loaded</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const name = drawer.name;
                  closeDrawer();
                  setDeleteTarget({
                    type: drawer.type === "tracks" ? "track" : drawer.type,
                    id: drawer.id,
                    name,
                    cascadeCount: drawerTracks.length,
                  });
                }}
              >
                Remove
              </Button>
            </div>
          }
        >
          {drawerLoading && drawerTracks.length === 0 ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="md" className="text-amber-500" />
            </div>
          ) : drawerTracks.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No tracks found.</p>
          ) : (
            <div className="space-y-2">
              {drawerTracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 py-2 border-b border-gray-700/30 last:border-0 group"
                >
                  <div className="w-8 h-8 rounded flex-shrink-0 overflow-hidden">
                    {track.albumImageUrl ? (
                      <img
                        src={track.albumImageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-700/50 flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{track.name}</div>
                    <div className="text-gray-400 text-xs truncate">
                      {track.artists.map((a) => a.name).join(", ")}
                      {track.albumName ? ` · ${track.albumName}` : ""}
                    </div>
                  </div>
                  {track.durationMs ? (
                    <div className="text-gray-500 text-xs tabular-nums flex-shrink-0">
                      {formatDuration(track.durationMs)}
                    </div>
                  ) : null}
                  <button
                    onClick={() => handleTrackRemove(track.id)}
                    disabled={removingTrackId === track.id}
                    className="text-gray-600 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  >
                    {removingTrackId === track.id ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
              {drawerLoading && (
                <div className="flex justify-center py-2">
                  <LoadingSpinner size="sm" className="text-amber-500" />
                </div>
              )}
            </div>
          )}
          <div ref={drawerSentinelRef} className="h-4" />
        </Modal>
      )}

      {deleteTarget && removeState === "idle" && (
        <ConfirmDialog
          title={
            deleteTarget.type === "track"
              ? "Remove Track"
              : deleteTarget.type === "playlist"
                ? "Remove Playlist"
                : "Remove Album"
          }
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
