import { forwardRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  error?: boolean;
  variant?: "primary" | "blue";
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2",
  lg: "px-4 py-3",
};

const variantClasses = {
  primary: {
    base: "border-gray-600",
    focus: "focus:border-green-500 focus:ring-green-500/20",
  },
  blue: {
    base: "border-gray-600",
    focus: "focus:border-blue-500 focus:ring-blue-500/20",
  },
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error = false, variant = "primary", size = "md", className = "", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full bg-gray-700/50 border rounded-xl text-white placeholder-gray-400 focus:outline-none transition-all resize-y min-h-[100px] ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            : `${variantClasses[variant].base} ${variantClasses[variant].focus}`
        } ${sizeClasses[size]} ${className}`}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
