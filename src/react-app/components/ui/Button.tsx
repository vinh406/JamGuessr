import { Button as BaseButton } from "@base-ui/react/button";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "blue" | "white";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const variantClasses = {
  primary: "bg-green-500 text-white hover:bg-green-600",
  secondary: "bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-gray-600",
  ghost: "bg-transparent text-gray-300 hover:text-white hover:bg-gray-700/30",
  blue: "bg-gradient-to-r from-blue-400 to-blue-600 text-white hover:from-blue-500 hover:to-blue-700",
  white: "bg-white text-gray-700 hover:bg-gray-300",
};

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-base",
  lg: "px-6 py-3 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, ...props }, ref) => {
    return (
      <BaseButton
        ref={ref}
        className={`rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
      </BaseButton>
    );
  },
);

Button.displayName = "Button";
