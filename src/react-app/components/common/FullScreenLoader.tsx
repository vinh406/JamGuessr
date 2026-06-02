import LoadingSpinner from "./LoadingSpinner";

interface FullScreenLoaderProps {
  text?: string;
  showIcon?: boolean;
  spinnerSize?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export default function FullScreenLoader({
  text = "Loading...",
  showIcon = true,
  spinnerSize = "lg",
  className = "",
}: FullScreenLoaderProps) {
  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center ${className}`}
    >
      <div className="text-center">
        {showIcon && (
          <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
        <LoadingSpinner size={spinnerSize} className="text-green-500 mx-auto" />
        <p className="text-gray-400 text-lg mt-4">{text}</p>
      </div>
    </div>
  );
}
