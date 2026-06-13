import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import PageLayout from "../components/common/PageLayout";
import { Button } from "../components/ui";
import { ChevronLeft, MusicNote, MusicNoteFilled, Close } from "../components/ui/icons";
import ConfirmDialog from "../components/common/ConfirmDialog";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { useSSE } from "../hooks/useSSE";
import { toast } from "sonner";

interface TrackItem {
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

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function LibraryItemPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const item = (location.state as { item?: LibraryItem } | null)?.item;

  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeletingTrack, setIsDeletingTrack] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<{
    type: string;
    id: string;
    name: string;
  } | null>(null);
  const [removeState, setRemoveState] = useState<
    "idle" | "connecting" | "streaming" | "complete" | "error"
  >("idle");
  const removeToastId = useRef<string | number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  const buildTracksUrl = useCallback(
    (cursorParam?: string) => {
      const base =
        type === "tracks" ? "/api/library/items/tracks" : `/api/library/items/${type}/${id}/tracks`;
      const params = new URLSearchParams({ limit: "50" });
      if (cursorParam) params.set("cursor", cursorParam);
      return `${base}?${params}`;
    },
    [type, id],
  );

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    abortRef.current = false;
    try {
      const res = await fetch(buildTracksUrl());
      if (!res.ok) {
        toast.error("Failed to load tracks.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!abortRef.current) {
        const fetched: TrackItem[] = data.tracks ?? [];
        const deduped = fetched.filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i);
        setTracks(deduped);
        setCursor(data.nextCursor ?? null);
        setLoading(false);
      }
    } catch {
      if (!abortRef.current) {
        toast.error("Failed to load tracks. Please try again.");
        setLoading(false);
      }
    }
  }, [buildTracksUrl]);

  const loadMoreTracks = useCallback(async () => {
    if (loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildTracksUrl(cursor));
      if (!res.ok) {
        setLoadingMore(false);
        return;
      }
      const data = await res.json();
      setTracks((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newTracks: TrackItem[] = (data.tracks ?? []).filter(
          (t: TrackItem) => !existingIds.has(t.id),
        );
        return [...prev, ...newTracks];
      });
      setCursor(data.nextCursor ?? null);
    } catch {
      toast.error("Failed to load more tracks.");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, cursor, buildTracksUrl]);

  useEffect(() => {
    fetchTracks();
    return () => {
      abortRef.current = true;
    };
  }, [fetchTracks]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
        loadMoreTracks();
      }
    };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, [loadMoreTracks]);

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
      navigate("/library");
    },
    onError: (msg) => {
      setRemoveState("error");
      if (removeToastId.current) {
        toast.error(msg, { id: removeToastId.current });
        removeToastId.current = null;
      }
    },
  });

  const handleDeleteTrack = async () => {
    if (!deleteTarget) return;
    setIsDeletingTrack(true);
    try {
      const res = await fetch(`/api/library/track/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTracks((prev) => prev.filter((t) => t.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        toast.error("Failed to remove track.");
      }
    } catch {
      toast.error("Failed to remove track. Please try again.");
    } finally {
      setIsDeletingTrack(false);
    }
  };

  const handleRemoveItem = () => {
    if (!item || !type) return;
    setRemoveState("connecting");
    removeToastId.current = toast.loading("Removing...");
    removeSSE.start("/api/library/remove", { type, id: item.id });
  };

  const gradientForIcon =
    type === "playlist"
      ? "from-amber-500 to-amber-700"
      : type === "album"
        ? "from-amber-600 to-amber-800"
        : "from-amber-400 to-amber-600";

  const itemIcon = <MusicNote className="w-6 h-6 text-white" />;

  return (
    <PageLayout>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate("/library")}
          className="text-gray-400 hover:text-white transition-colors mb-6 flex items-center gap-2 cursor-pointer group"
        >
          <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Back to library
        </button>

        {type && (item || type === "tracks") && (
          <div className="flex items-center gap-4 mb-8">
            <div
              className={`w-16 h-16 rounded-xl bg-gradient-to-br ${gradientForIcon} flex items-center justify-center flex-shrink-0 overflow-hidden`}
            >
              {item?.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                itemIcon
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white truncate">{item?.name ?? "Tracks"}</h1>
              <p className="text-gray-400 text-sm">
                {type === "album" && item?.artists
                  ? `${item.artists.map((a) => a.name).join(", ")} · `
                  : ""}
                {item?.trackCount ?? tracks.length} track
                {(item?.trackCount ?? tracks.length) !== 1 ? "s" : ""}
              </p>
            </div>
            {type !== "tracks" && item && removeState === "idle" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRemoveTarget({ type, id: item.id, name: item.name })}
              >
                Remove
              </Button>
            )}
            {removeState === "connecting" || removeState === "streaming" ? (
              <LoadingSpinner size="sm" className="text-amber-500" />
            ) : null}
          </div>
        )}

        <div
          ref={scrollRef}
          className="bg-gray-800/40 rounded-2xl border border-gray-700/30 max-h-[70vh] overflow-y-auto"
        >
          {loading ? (
            <div className="space-y-2 p-6" role="status" aria-label="Loading tracks">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3 animate-pulse">
                  <div className="w-8 h-8 rounded bg-gray-700 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-3.5 bg-gray-700 rounded w-3/5" />
                    <div className="h-3 bg-gray-700/50 rounded w-2/5" />
                  </div>
                  <div className="w-10 h-3 bg-gray-700/30 rounded shrink-0" />
                </div>
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <p className="text-gray-400 text-center py-12">No tracks found.</p>
          ) : (
            <div className="space-y-2 p-6">
              {tracks.map((track) => (
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
                        <MusicNoteFilled className="w-4 h-4 text-gray-400" />
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
                    onClick={() => setDeleteTarget({ id: track.id, name: track.name })}
                    disabled={isDeletingTrack}
                    className="text-gray-600 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    aria-label={`Remove ${track.name}`}
                  >
                    {isDeletingTrack && deleteTarget?.id === track.id ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Close className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
              {loadingMore && (
                <div className="flex justify-center py-2">
                  <LoadingSpinner size="sm" className="text-amber-500" />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {deleteTarget && (
        <ConfirmDialog
          title="Remove Track"
          message={`Remove "${deleteTarget.name}" from your library?`}
          confirmLabel="Remove"
          onConfirm={handleDeleteTrack}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {removeTarget && (
        <ConfirmDialog
          title="Remove from Library"
          message={`Remove "${removeTarget.name}" and all its tracks from your library? This cannot be undone.`}
          confirmLabel="Remove"
          onConfirm={() => {
            setRemoveTarget(null);
            handleRemoveItem();
          }}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </PageLayout>
  );
}
