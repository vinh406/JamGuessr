import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { DefaultAvatar } from "./ui";
import { App, History, Settings, Logout } from "./ui/icons";
import type { ReactNode } from "react";

interface HeaderProps {
  children?: ReactNode;
}

export default function Header({ children }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    try {
      await logout();
    } catch {
      // ignore
    }
  };

  return (
    <header className="border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-3 cursor-pointer">
          <App className="w-10 h-10" />
          <span className="text-2xl font-bold text-white">JamGuessr</span>
        </button>

        {children ? (
          <div className="flex items-center gap-4">{children}</div>
        ) : user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 cursor-pointer rounded-full border border-gray-700/30 bg-gray-800/50 pr-3 pl-1 py-1 hover:bg-gray-700/50 transition-colors"
            >
              <DefaultAvatar name={user.name} src={user.image} size={32} />
              <span className="text-gray-300 font-medium hidden md:block">{user.name}</span>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 border border-gray-700/50 rounded-xl shadow-xl py-2 z-50">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate("/history");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-gray-700/50 transition-colors text-sm"
                >
                  <History className="w-4 h-4" />
                  History
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate("/settings");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-gray-700/50 transition-colors text-sm"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <div className="border-t border-gray-700/50 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-gray-700/50 transition-colors text-sm"
                >
                  <Logout className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
