export interface LibraryStats {
  totalSongs: number;
  totalPlaylists: number;
  totalAlbums: number;
  lastUpdated: string;
}

let cachedStats: LibraryStats | null | undefined;

export function getStats(): LibraryStats | null | undefined {
  return cachedStats;
}

export function setStats(stats: LibraryStats | null | undefined): void {
  cachedStats = stats;
}
