import { SCORING } from "../../../../shared/constants";
import { shuffleArray } from "../../../../shared/utils";
import type { Song, SongChoice } from "../../../../shared/types";
import type { LastFMSimilarTrack } from "../../lastfm/client";

export function calculateScore(
  isCorrect: boolean,
  timeTakenMs: number,
  timePerRoundMs: number,
  streak: number,
): number {
  if (!isCorrect) return 0;
  const speedRatio = 1 - timeTakenMs / timePerRoundMs;
  const speedBonus = Math.round(SCORING.MAX_SPEED_BONUS * Math.max(0, speedRatio));
  const streakBonus = streak * SCORING.STREAK_BONUS;
  return SCORING.BASE_POINTS + speedBonus + streakBonus;
}

function assembleChoices(
  correctSong: Song,
  decoys: Array<{ title: string; artist: string; albumImageUrl?: string }>,
): SongChoice[] {
  const choices: SongChoice[] = [
    {
      index: 0,
      title: correctSong.title,
      artist: correctSong.artist,
      albumImageUrl: correctSong.albumImageUrl,
      isCorrect: true,
    },
    ...decoys.map((d) => ({
      index: 0,
      title: d.title,
      artist: d.artist,
      albumImageUrl: d.albumImageUrl,
      isCorrect: false,
    })),
  ];

  return shuffleArray(choices).map((choice, i) => ({
    ...choice,
    index: i,
  }));
}

export function generateChoices(correctSong: Song, allSongs: Song[]): SongChoice[] {
  const wrongSongs = allSongs.filter((s) => s.id !== correctSong.id);
  const shuffled = shuffleArray(wrongSongs);
  const decoys = shuffled.slice(0, 3);

  return assembleChoices(correctSong, decoys);
}

export function generateChoicesWithLastFM(
  correctSong: Song,
  allSongs: Song[],
  similarTracksCache: Map<string, LastFMSimilarTrack[]>,
  lastFmApiKey: string | null,
): SongChoice[] {
  if (!lastFmApiKey) {
    return generateChoices(correctSong, allSongs);
  }

  const similarTracks = similarTracksCache.get(correctSong.id) ?? [];
  const shuffledSimilar = shuffleArray(similarTracks);

  const similarDecoys: Array<{ title: string; artist: string; albumImageUrl?: string }> =
    shuffledSimilar.slice(0, 3).map((track) => ({
      title: track.name,
      artist: track.artist,
      albumImageUrl: track.imageUrl ?? undefined,
    }));

  const needed = 3 - similarDecoys.length;
  const wrongSongs = allSongs.filter((s) => s.id !== correctSong.id);
  const shuffled = shuffleArray(wrongSongs);
  const fallbackDecoys = shuffled.slice(0, needed);

  return assembleChoices(correctSong, [...similarDecoys, ...fallbackDecoys]);
}
