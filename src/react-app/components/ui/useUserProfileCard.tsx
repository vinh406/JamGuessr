import { useState, useCallback, useMemo, useRef } from "react";
import { Popover } from "@base-ui/react/popover";
import { ProfilePopup } from "./ProfilePopup";
import type { UserProfile } from "./ProfilePopup";

interface CacheEntry {
  data: UserProfile;
  timestamp: number;
}

const profileCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000;

async function fetchProfile(userId: string): Promise<UserProfile> {
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
  const res = await fetch(`/api/user/profile/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch profile");
  const data = (await res.json()) as UserProfile;
  profileCache.set(userId, { data, timestamp: Date.now() });
  return data;
}

export function useUserProfileCard(userId: string, username: string, userImage?: string | null) {
  const handle = useMemo(() => Popover.createHandle(), []);

  type Status = "idle" | "loading" | "loaded" | "error";
  const [status, setStatus] = useState<Status>("idle");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const fetchedRef = useRef(false);

  const onOpenChange = useCallback(
    async (open: boolean) => {
      if (open && !fetchedRef.current) {
        fetchedRef.current = true;
        setStatus("loading");
        try {
          const data = await fetchProfile(userId);
          setProfile(data);
          setStatus("loaded");
        } catch {
          setStatus("error");
        }
      }
    },
    [userId],
  );

  const popup = useMemo(
    () => (
      <ProfilePopup profile={profile} status={status} username={username} userImage={userImage} />
    ),
    [profile, status, username, userImage],
  );

  return { handle, onOpenChange, ProfilePopup: () => popup };
}
