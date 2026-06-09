CREATE TABLE "game_players" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"user_id" text,
	"username" text,
	"score" integer NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"rank" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_results" (
	"id" text PRIMARY KEY NOT NULL,
	"room_name" text NOT NULL,
	"host_user_id" text NOT NULL,
	"playlist" jsonb,
	"settings" jsonb NOT NULL,
	"songs" jsonb NOT NULL,
	"played_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_game_results_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_host_user_id_user_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_players_game_id_idx" ON "game_players" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_players_user_id_idx" ON "game_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "game_results_host_user_id_idx" ON "game_results" USING btree ("host_user_id");