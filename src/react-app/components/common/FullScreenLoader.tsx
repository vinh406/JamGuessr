import { AppIcon } from "../ui";
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
        {showIcon && <AppIcon className="w-16 h-16 mx-auto mb-4 animate-pulse" />}
        <LoadingSpinner size={spinnerSize} className="text-green-500 mx-auto" />
        <p className="text-gray-400 text-lg mt-4">{text}</p>
      </div>
    </div>
  );
}
