CREATE TABLE "library_albums" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"spotify_id" text NOT NULL,
	"name" text NOT NULL,
	"artist_name" text DEFAULT '' NOT NULL,
	"release_date" text,
	"image_url" text,
	"total_tracks" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_playlists" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"spotify_id" text NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"track_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_track_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"user_id" text NOT NULL,
	"source_type" text NOT NULL,
	"playlist_id" text,
	"album_id" text,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"spotify_id" text NOT NULL,
	"name" text NOT NULL,
	"artists" jsonb NOT NULL,
	"album_name" text DEFAULT '' NOT NULL,
	"album_id" text,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_library_stats" (
	"user_id" text PRIMARY KEY NOT NULL,
	"total_songs" integer DEFAULT 0 NOT NULL,
	"total_playlists" integer DEFAULT 0 NOT NULL,
	"total_albums" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_albums" ADD CONSTRAINT "library_albums_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_playlists" ADD CONSTRAINT "library_playlists_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_track_sources" ADD CONSTRAINT "library_track_sources_track_id_library_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."library_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_track_sources" ADD CONSTRAINT "library_track_sources_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_tracks" ADD CONSTRAINT "library_tracks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library_stats" ADD CONSTRAINT "user_library_stats_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "library_albums_user_id" ON "library_albums" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "library_playlists_user_id" ON "library_playlists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "library_track_sources_track_id" ON "library_track_sources" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "library_track_sources_user_id" ON "library_track_sources" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "library_track_sources_playlist_id" ON "library_track_sources" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "library_track_sources_album_id" ON "library_track_sources" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "library_track_sources_user_source" ON "library_track_sources" USING btree ("user_id","source_type");--> statement-breakpoint
CREATE INDEX "library_tracks_user_id" ON "library_tracks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "library_tracks_spotify_id" ON "library_tracks" USING btree ("spotify_id");