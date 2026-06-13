import { Avatar } from "@base-ui/react/avatar";
import { useId } from "react";
import { AvatarFallback } from "./icons";

interface DefaultAvatarProps {
  name?: string;
  src?: string | null;
  size?: number;
  className?: string;
}

export function DefaultAvatar({ name, src, size = 40, className = "" }: DefaultAvatarProps) {
  const gradientId = useId();

  return (
    <Avatar.Root
      className={`inline-flex rounded-full overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {src && <Avatar.Image src={src} alt={name ?? ""} className="w-full h-full object-cover" />}
      <Avatar.Fallback className="flex items-center justify-center w-full h-full">
        <AvatarFallback gradientId={gradientId} name={name} />
      </Avatar.Fallback>
    </Avatar.Root>
  );
}
