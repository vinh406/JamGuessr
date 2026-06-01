import { useRef, useCallback } from "react";
import { useSSE } from "./useSSE";
import { toast } from "sonner";

export function useLibraryImport() {
  const importToastId = useRef<string | number | null>(null);

  const { start, state } = useSSE({
    onEvent: (event) => {
      if (event.event === "phase") {
        const d = event.data as { phase: string; label: string };
        if (importToastId.current) {
          toast.loading(d.label, { id: importToastId.current });
        }
      } else if (event.event === "progress") {
        const d = event.data as { current: number; total: number; label: string };
        if (importToastId.current) {
          toast.loading(`${d.label} (${d.current}/${d.total})`, { id: importToastId.current });
        }
      }
    },
    onComplete: () => {
      if (importToastId.current) {
        toast.success("Import complete!", { id: importToastId.current });
        importToastId.current = null;
      }
    },
    onError: (msg) => {
      if (importToastId.current) {
        toast.error(msg, { id: importToastId.current });
        importToastId.current = null;
      }
    },
  });

  const startImport = useCallback(
    (link: string) => {
      importToastId.current = toast.loading("Connecting...");
      start("/api/library/add", { link });
    },
    [start],
  );

  return { startImport, state };
}
