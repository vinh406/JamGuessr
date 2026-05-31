import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, jsonb, integer } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// Library tracks table - stores track metadata once per user
export const libraryTracks = pgTable(
  "library_tracks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    spotifyId: text("spotify_id").notNull(),
    name: text("name").notNull(),
    artists: jsonb("artists").notNull().$type<{ name: string; id?: string }[]>(),
    albumName: text("album_name").notNull().default(""),
    albumId: text("album_id"),
    albumImageUrl: text("album_image_url"),
    previewUrl: text("preview_url"),
    durationMs: integer("duration_ms").notNull().default(0),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [
    index("library_tracks_user_id").on(table.userId),
    index("library_tracks_spotify_id").on(table.spotifyId),
    { name: "library_tracks_unique", columns: [table.userId, table.spotifyId], isUnique: true },
  ],
);

// Track sources join table - tracks which sources contributed each track
export const libraryTrackSources = pgTable(
  "library_track_sources",
  {
    id: text("id").primaryKey(),
    trackId: text("track_id")
      .notNull()
      .references(() => libraryTracks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(), // 'direct' | 'playlist' | 'album'
    playlistId: text("playlist_id"),
    albumId: text("album_id"),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [
    index("library_track_sources_track_id").on(table.trackId),
    index("library_track_sources_user_id").on(table.userId),
    index("library_track_sources_playlist_id").on(table.playlistId),
    index("library_track_sources_album_id").on(table.albumId),
    index("library_track_sources_user_source").on(table.userId, table.sourceType),
  ],
);

// Playlists table - user-submitted playlists (static snapshot)
export const libraryPlaylists = pgTable(
  "library_playlists",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    spotifyId: text("spotify_id").notNull(),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    addedAt: timestamp("added_at").defaultNow().notNull(),
    trackCount: integer("track_count").notNull().default(0),
  },
  (table) => [index("library_playlists_user_id").on(table.userId)],
);

// Albums table - user-submitted albums (static snapshot)
export const libraryAlbums = pgTable(
  "library_albums",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    spotifyId: text("spotify_id").notNull(),
    name: text("name").notNull(),
    artistName: text("artist_name").notNull().default(""),
    releaseDate: text("release_date"),
    imageUrl: text("image_url"),
    totalTracks: integer("total_tracks").notNull().default(0),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [index("library_albums_user_id").on(table.userId)],
);

// User library summary (cached) - updated in app code
export const userLibraryStats = pgTable("user_library_stats", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  totalSongs: integer("total_songs").notNull().default(0),
  totalPlaylists: integer("total_playlists").notNull().default(0),
  totalAlbums: integer("total_albums").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

// Library relations
export const libraryTracksRelations = relations(libraryTracks, ({ one, many }) => ({
  user: one(user, {
    fields: [libraryTracks.userId],
    references: [user.id],
  }),
  sources: many(libraryTrackSources),
}));

export const libraryTrackSourcesRelations = relations(libraryTrackSources, ({ one }) => ({
  track: one(libraryTracks, {
    fields: [libraryTrackSources.trackId],
    references: [libraryTracks.id],
  }),
  user: one(user, {
    fields: [libraryTrackSources.userId],
    references: [user.id],
  }),
  playlist: one(libraryPlaylists, {
    fields: [libraryTrackSources.playlistId],
    references: [libraryPlaylists.id],
  }),
  album: one(libraryAlbums, {
    fields: [libraryTrackSources.albumId],
    references: [libraryAlbums.id],
  }),
}));

export const libraryPlaylistsRelations = relations(libraryPlaylists, ({ one, many }) => ({
  user: one(user, {
    fields: [libraryPlaylists.userId],
    references: [user.id],
  }),
  sources: many(libraryTrackSources),
}));

export const libraryAlbumsRelations = relations(libraryAlbums, ({ one, many }) => ({
  user: one(user, {
    fields: [libraryAlbums.userId],
    references: [user.id],
  }),
  sources: many(libraryTrackSources),
}));

export const userLibraryStatsRelations = relations(userLibraryStats, ({ one }) => ({
  user: one(user, {
    fields: [userLibraryStats.userId],
    references: [user.id],
  }),
}));
