import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";
import { betterAuthOptions } from "./options";
import { getDb } from "../../db";
import type { DbInstance } from "../../db";
import * as schema from "../../db/schema";

/**
 * Better Auth Instance
 *
 * Accept an optional pre-created DbInstance to avoid creating
 * a separate database connection (shared with other services).
 */
export const auth = (env: Env, existingDb?: DbInstance) => {
  const db = existingDb ?? getDb(env.HYPERDRIVE.connectionString);

  return betterAuth({
    ...betterAuthOptions,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

    // Social providers configuration
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        scope: ["openid", "email", "profile"],
      },
    },

    // OpenAPI plugin for API documentation
    plugins: [
      openAPI({
        disableDefaultReference: true,
      }),
    ],
  });
};
