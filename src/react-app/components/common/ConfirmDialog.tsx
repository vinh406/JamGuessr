import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "../ui";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    setOpen(false);
    setTimeout(onCancel, 150);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 rounded-2xl w-full max-w-sm border border-gray-700/50 shadow-xl transition-transform duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 z-50 p-6">
          <Dialog.Title className="text-lg font-bold text-white m-0 mb-3">{title}</Dialog.Title>
          <p className="text-gray-300 text-sm mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            <Dialog.Close className="bg-transparent border-none p-0">
              <Button variant="secondary" size="sm" onClick={handleClose}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setOpen(false);
                setTimeout(onConfirm, 150);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
