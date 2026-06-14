-- Clean up orphan sources before adding FK constraints
DELETE FROM "library_track_sources"
WHERE "playlist_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "library_playlists" WHERE "id" = "library_track_sources"."playlist_id");

DELETE FROM "library_track_sources"
WHERE "album_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "library_albums" WHERE "id" = "library_track_sources"."album_id");

-- Clean up orphan tracks with no remaining source entries
DELETE FROM "library_tracks"
WHERE NOT EXISTS (
  SELECT 1 FROM "library_track_sources" WHERE "track_id" = "library_tracks"."id"
);--> statement-breakpoint
ALTER TABLE "library_track_sources" ADD CONSTRAINT "library_track_sources_playlist_id_library_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."library_playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_track_sources" ADD CONSTRAINT "library_track_sources_album_id_library_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."library_albums"("id") ON DELETE cascade ON UPDATE no action;
