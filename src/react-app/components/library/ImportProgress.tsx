import LoadingSpinner from "../common/LoadingSpinner";

interface ImportProgressProps {
  state: "idle" | "connecting" | "importing" | "complete" | "error";
  current?: number;
  total?: number;
  label?: string;
  error?: string;
  onDismiss?: () => void;
}

export default function ImportProgress({
  state,
  current,
  total,
  label,
  error,
  onDismiss,
}: ImportProgressProps) {
  if (state === "idle") return null;

  const isIndeterminate = state === "connecting" || (state === "importing" && (!total || total === 0));
  const percent = total && total > 0 && current != null
    ? Math.min(100, Math.round((current / total) * 100))
    : 0;

  const barColor = state === "error" ? "bg-red-500" : state === "complete" ? "bg-green-500" : "bg-amber-500";
  const bgColor = state === "error" ? "bg-red-500/10" : "bg-gray-700/50";

  return (
    <div
      className={`mt-3 rounded-xl border p-4 ${
        state === "error"
          ? "border-red-500/30 bg-red-500/5"
          : state === "complete"
            ? "border-green-500/30 bg-green-500/5"
            : "border-gray-700/50 bg-gray-800/40"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {state === "connecting" || state === "importing" ? (
            <LoadingSpinner size="sm" className="text-amber-400" />
          ) : state === "complete" ? (
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span
            className={`text-sm font-medium ${
              state === "error" ? "text-red-400" : state === "complete" ? "text-green-400" : "text-amber-400"
            }`}
          >
            {state === "connecting"
              ? "Connecting..."
              : state === "complete"
                ? "Complete!"
                : state === "error"
                  ? "Operation failed"
                  : label || "Working..."}
          </span>
        </div>
        {current != null && total != null && total > 0 && (
          <span className="text-xs text-gray-400 tabular-nums">
            {current} / {total}
          </span>
        )}
      </div>

      {!isIndeterminate && (
        <div className={`h-2 rounded-full ${bgColor} overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {state === "error" && error && (
        <p className="text-xs text-red-400/80 mt-2">{error}</p>
      )}

      {(state === "complete" || state === "error") && onDismiss && (
        <button onClick={onDismiss} className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors">
          Dismiss
        </button>
      )}
    </div>
  );
}
