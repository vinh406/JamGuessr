import { ReactNode, useState, type RefObject } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Close } from "../ui/icons";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "sm" | "md" | "lg";
  scrollable?: boolean;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export function Modal({
  title,
  onClose,
  children,
  footer,
  maxWidth = "md",
  scrollable = false,
  scrollContainerRef,
  onScroll,
}: ModalProps) {
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 150);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 rounded-2xl w-full ${maxWidthClasses[maxWidth]} border border-gray-700/50 shadow-xl transition-transform duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 z-50 ${scrollable ? "max-h-[90vh] flex flex-col" : ""}`}
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
            <Dialog.Title className="text-xl font-bold text-white m-0">{title}</Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0">
              <Close className="w-6 h-6" />
            </Dialog.Close>
          </div>

          <div
            ref={scrollContainerRef}
            onScroll={onScroll}
            className={scrollable ? "flex-1 overflow-y-auto p-6" : "p-6"}
          >
            {children}
          </div>

          {footer && <div className="p-6 border-t border-gray-700/50">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
