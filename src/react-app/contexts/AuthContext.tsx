import { useState, useEffect, ReactNode } from "react";
import { createAuthClient } from "better-auth/client";
import { AuthContext, User } from "../hooks/useAuth";

const authClient = createAuthClient();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = async () => {
    try {
      const session = await authClient.getSession();
      if (session?.data?.user) {
        setUser(session.data.user as User);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to check session:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (options?: { provider?: "google"; callbackURL?: string }) => {
    try {
      await authClient.signIn.social({
        provider: options?.provider ?? "google",
        ...(options?.callbackURL ? { callbackURL: options.callbackURL } : {}),
      });
    } catch (error) {
      console.error("Failed to login:", error);
    }
  };

  const logout = async () => {
    try {
      await authClient.signOut();
      setUser(null);
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  };

  useEffect(() => {
    checkSession();
  }, []);

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    checkSession,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
