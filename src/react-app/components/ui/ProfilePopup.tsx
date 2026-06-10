import { Popover } from "@base-ui/react/popover";
import { DefaultAvatar } from "./DefaultAvatar";

export interface UserProfile {
  id: string;
  name: string;
  image: string | null;
  bio: string | null;
}

export function ProfilePopup({
  profile,
  status,
  username,
  userImage,
}: {
  profile: UserProfile | null;
  status: "idle" | "loading" | "loaded" | "error";
  username: string;
  userImage?: string | null;
}) {
  return (
    <Popover.Portal>
      <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
        <Popover.Popup className="bg-gray-800 border border-gray-700/50 rounded-xl min-w-56 max-w-64 p-4 outline-none">
          <Popover.Arrow className="fill-gray-800 stroke-gray-700/50">
            <path d="M 0 0 L 8 8 L 16 0" />
          </Popover.Arrow>
          <div className="flex items-center gap-3">
            <DefaultAvatar
              name={profile?.name ?? username}
              src={profile?.image ?? userImage}
              size={48}
            />
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">
                {profile?.name ?? username}
              </p>
              {status === "loading" ? (
                <p className="text-gray-500 text-xs mt-0.5 animate-pulse">Loading...</p>
              ) : profile?.bio ? (
                <p className="text-gray-400 text-xs mt-0.5 line-clamp-3 whitespace-pre-wrap">
                  {profile.bio}
                </p>
              ) : null}
            </div>
          </div>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  );
}
