import { BetterAuthOptions } from "better-auth";

/**
 * Custom options for Better Auth
 *
 * Docs: https://www.better-auth.com/docs/reference/options
 */
export const betterAuthOptions: BetterAuthOptions = {
  /**
   * The name of the application.
   */
  appName: "SpotiGuess",
  /**
   * Base path for Better Auth.
   * @default "/api/auth"
   */
  basePath: "/api/auth",

  /**
   * Social providers configuration
   * Note: clientId and clientSecret are passed when creating the auth instance
   */
  socialProviders: {},

  /**
   * Session configuration
   */
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },

  /**
   * Account linking
   */
  account: {
    accountLinking: {
      enabled: true,
    },
  },

  /**
   * Advanced options
   */
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
  },
};
