import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";

/**
 * Create a drizzle DB instance for a single request.
 *
 * Cloudflare Workers requires each request to use its own I/O objects;
 * creating the postgres client at module scope causes
 * "Cannot perform I/O on behalf of a different request" errors.
 */
export type DbInstance = ReturnType<typeof getDb>;

export function getDb(connectionString: string) {
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}
