import { Popover } from "@base-ui/react/popover";
import type { ReactNode } from "react";

export function PopupTrigger({
  handle,
  className,
  children,
}: {
  handle: ReturnType<typeof Popover.createHandle>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Popover.Trigger handle={handle} className={className}>
      {children}
    </Popover.Trigger>
  );
}
