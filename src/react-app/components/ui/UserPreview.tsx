import { Popover } from "@base-ui/react/popover";
import { useUserProfileCard } from "./useUserProfileCard";
import { DefaultAvatar } from "./DefaultAvatar";
import { PopupTrigger } from "./PopupTrigger";
import type { ReactNode } from "react";

interface UserPreviewProps {
  userId?: string | null;
  displayName: string;
  image?: string | null;
  isMe?: boolean;
  description?: ReactNode;
}

export function UserPreview({ userId, displayName, image, isMe, description }: UserPreviewProps) {
  const { handle, onOpenChange, ProfilePopup } = useUserProfileCard(
    userId ?? "",
    displayName,
    image,
  );

  if (!userId) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <DefaultAvatar name={displayName} src={image} size={40} />
        <span className="text-sm font-semibold text-white truncate">{displayName}</span>
      </span>
    );
  }

  return (
    <Popover.Root handle={handle} onOpenChange={onOpenChange}>
      <span className="inline-flex items-stretch gap-1.5">
        <PopupTrigger
          handle={handle}
          className="shrink-0 cursor-pointer bg-transparent border-0 p-0 leading-none"
        >
          <DefaultAvatar name={displayName} src={image} size={40} />
        </PopupTrigger>
        <span
          className={`flex flex-col min-w-0 ${description ? "justify-between" : "justify-center"}`}
        >
          <span className="inline-flex items-baseline gap-1 flex-wrap">
            <PopupTrigger
              handle={handle}
              className="cursor-pointer bg-transparent border-0 p-0 leading-none text-sm font-semibold text-white hover:underline decoration-gray-400/50 underline-offset-2"
            >
              {displayName}
            </PopupTrigger>
            {isMe && <span className="text-sm text-green-400">(You)</span>}
          </span>
          {description && <span className="text-sm text-gray-400">{description}</span>}
        </span>
      </span>
      <ProfilePopup />
    </Popover.Root>
  );
}
