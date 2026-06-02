import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and } from "drizzle-orm";
import { account, user } from "../../db/schema";

interface SpotifyTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

async function getSpotifyTokens(userId: string, env: Env): Promise<SpotifyTokens | null> {
  const sql = postgres(env.DATABASE_URL);
  const db = drizzle(sql);

  const accountRecord = await db
    .select()
    .from(account)
    .leftJoin(user, eq(account.userId, user.id))
    .where(and(eq(account.providerId, "spotify"), eq(account.userId, userId)))
    .limit(1);

  if (!accountRecord.length) {
    return null;
  }

  const firstRecord = accountRecord[0];
  if (!firstRecord?.account) {
    return null;
  }

  const acc = firstRecord.account;
  return {
    accessToken: acc.accessToken ?? "",
    refreshToken: acc.refreshToken ?? null,
    expiresAt: acc.accessTokenExpiresAt?.getTime() ?? null,
  };
}

async function refreshSpotifyToken(refreshToken: string, env: Env): Promise<SpotifyTokens | null> {
  const clientId = env.SPOTIFY_CLIENT_ID;
  const clientSecret = env.SPOTIFY_CLIENT_SECRET;

  const credentials = btoa(`${clientId}:${clientSecret}`);

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to refresh Spotify token:", error);
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  } catch (error) {
    console.error("Error refreshing Spotify token:", error);
    return null;
  }
}

async function updateSpotifyTokens(
  userId: string,
  tokens: SpotifyTokens,
  env: Env,
): Promise<boolean> {
  const sql = postgres(env.DATABASE_URL);
  const db = drizzle(sql);

  try {
    await db
      .update(account)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
      })
      .where(and(eq(account.providerId, "spotify"), eq(account.userId, userId)));
    return true;
  } catch (error) {
    console.error("Failed to update Spotify tokens:", error);
    return false;
  }
}

export async function getSpotifyClientForUser(
  userId: string,
  env: Env,
): Promise<SpotifyApi | null> {
  const tokens = await getSpotifyTokens(userId, env);

  if (!tokens || !tokens.accessToken) {
    return null;
  }

  const isExpired = tokens.expiresAt ? Date.now() >= tokens.expiresAt - 60000 : false;

  let validTokens = tokens;

  if (isExpired && tokens.refreshToken) {
    const newTokens = await refreshSpotifyToken(tokens.refreshToken, env);
    if (newTokens) {
      await updateSpotifyTokens(userId, newTokens, env);
      validTokens = newTokens;
    } else {
      return null;
    }
  }

  return SpotifyApi.withAccessToken(env.SPOTIFY_CLIENT_ID, {
    access_token: validTokens.accessToken,
    token_type: "Bearer",
    expires_in: validTokens.expiresAt
      ? Math.floor((validTokens.expiresAt - Date.now()) / 1000)
      : 3600,
    refresh_token: validTokens.refreshToken ?? "",
    expires: validTokens.expiresAt ?? Date.now() + 3600 * 1000,
  });
}
