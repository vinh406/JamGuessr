import type { ReactNode } from "react";
import Header from "../Header";

interface PageLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  className?: string;
}

export default function PageLayout({
  children,
  showHeader = true,
  className = "",
}: PageLayoutProps) {
  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 ${className}`}
    >
      {showHeader && <Header />}
      {children}
    </div>
  );
}
