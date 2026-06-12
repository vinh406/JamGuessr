import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import PageLayout from "../components/common/PageLayout";
import { Button, Input } from "../components/ui";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { useLibraryImport } from "../hooks/useLibraryImport";
import { toast } from "sonner";

interface LibraryStats {
  totalSongs: number;
  totalPlaylists: number;
  totalAlbums: number;
  lastUpdated: string;
}

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
  const navigate = useNavigate();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState<LibraryStats | null>(null);

  const [link, setLink] = useState("");

  const sentinelRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [data] = await Promise.all([fetchItems(), fetchStats()]);
      if (cancelled) return;
      if (data) {
        setItems(data.items);
        setNextCursor(data.nextCursor);
      } else {
        toast.error("Failed to load your library.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
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

  const detectedType = link.trim() ? parseSpotifyLinkType(link) : null;

  const handleImport = () => {
    if (!link.trim() || importState === "connecting" || importState === "streaming") return;
    startImport(link.trim());
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
        return "from-amber-500 to-amber-700";
      case "album":
        return "from-amber-600 to-amber-800";
      default:
        return "from-amber-400 to-amber-600";
    }
  };

  return (
    <PageLayout>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shrink-0">
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
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            <div className="bg-gray-800/50 rounded-xl px-4 py-2 border border-gray-700/30 flex items-center gap-2">
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
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
              <span className="text-white font-semibold text-sm">{stats?.totalSongs ?? 0}</span>
              <span className="text-amber-400/80 text-xs">tracks</span>
            </div>
            <div className="bg-gray-800/50 rounded-xl px-4 py-2 border border-gray-700/30 flex items-center gap-2">
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
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
              <span className="text-white font-semibold text-sm">{stats?.totalPlaylists ?? 0}</span>
              <span className="text-amber-400/80 text-xs">playlists</span>
            </div>
            <div className="bg-gray-800/50 rounded-xl px-4 py-2 border border-gray-700/30 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
              </svg>
              <span className="text-white font-semibold text-sm">{stats?.totalAlbums ?? 0}</span>
              <span className="text-amber-400/80 text-xs">albums</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 rounded-2xl border border-gray-700/50 p-6 mb-8">
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
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={
                  !detectedType || importState === "connecting" || importState === "streaming"
                }
              >
                {importState === "connecting"
                  ? "Connecting"
                  : importState === "streaming"
                    ? "Importing"
                    : detectedType === "track"
                      ? "Add Track"
                      : detectedType === "playlist"
                        ? "Import Playlist"
                        : detectedType === "album"
                          ? "Import Album"
                          : "Import"}
              </Button>
            </div>
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Detected as{" "}
              <span className="font-medium text-amber-400 capitalize">{detectedType}</span>
            </div>
          )}
        </div>

        {loading && (
          <div className="space-y-3" role="status" aria-label="Loading library">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="w-full bg-gray-800/40 rounded-2xl p-6 border border-gray-700/30 flex items-center gap-4 animate-pulse"
              >
                <div className="w-14 h-14 rounded-xl bg-gray-700 shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 bg-gray-700 rounded w-3/5" />
                  <div className="h-3 bg-gray-700/50 rounded w-2/5" />
                </div>
                <div className="w-5 h-5 bg-gray-700/50 rounded shrink-0" />
              </div>
            ))}
          </div>
        )}

        {!loading && hasItems && (
          <>
            <div className="space-y-3">
              {items.map((item) => {
                const itemValue = `${item.type}-${item.id}`;
                return (
                  <button
                    key={itemValue}
                    onClick={() =>
                      navigate(`/library/${item.type}/${item.spotifyId ?? item.id}`, {
                        state: { item },
                      })
                    }
                    className="w-full flex items-center gap-4 p-6 text-left bg-gray-800/40 rounded-2xl border border-gray-700/30 transition-colors hover:bg-gray-800/60 focus-visible:outline-2 focus-visible:outline-amber-500/50 focus-visible:-outline-offset-2 cursor-pointer"
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
                    <svg
                      className="w-5 h-5 text-gray-500 flex-shrink-0"
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
                  </button>
                );
              })}
            </div>
            <div ref={sentinelRef} className="h-4" />
            {loadingMore && (
              <div className="flex justify-center py-4">
                <LoadingSpinner size="md" className="text-amber-500" />
              </div>
            )}
          </>
        )}

        {!loading && !hasItems && (
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
      </main>
    </PageLayout>
  );
}
