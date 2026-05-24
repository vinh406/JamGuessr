import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import Header from "../components/Header";
import ActionCard from "../components/common/ActionCard";
import { Input, Button } from "../components/ui";
import { generateRoomCode } from "../../shared/constants";

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateRoom = () => {
    const code = generateRoomCode();
    sessionStorage.setItem("chat-username", user?.name || "Player");
    navigate(`/room/${code}`);
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) return;

    setIsJoining(true);
    try {
      // Store username in session storage
      sessionStorage.setItem("chat-username", user?.name || "Player");
      // Navigate to the room
      navigate(`/room/${roomCode}`);
    } catch (error) {
      console.error("Failed to join room:", error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <Header>
        {user && (
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/library")}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="hidden md:block">My Library</span>
            </Button>
            {user.image && (
              <img src={user.image} alt={user.name} className="w-8 h-8 rounded-full" />
            )}
            <span className="text-gray-300 font-medium hidden md:block">{user.name}</span>
            <Button variant="ghost" onClick={handleLogout}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </Button>
          </div>
        )}
      </Header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Welcome back,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
              {user?.name?.split(" ")[0] || "Player"}
            </span>
          </h1>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Create Room Card */}
          <ActionCard
            icon={
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            }
            title="Create a Room"
            description="Start a new game and invite your friends with a room code. You'll be the host!"
            buttonText="Create Room"
            onClick={handleCreateRoom}
          />

          {/* Join Room Card */}
          <ActionCard
            variant="blue"
            icon={
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
            title="Join a Room"
            description="Have a room code? Enter it below to join your friend's game!"
            buttonText="Join Room"
            onClick={handleJoinRoom}
            isLoading={isJoining}
            disabled={!roomCode.trim()}
          >
            <Input
              variant="blue"
              type="text"
              placeholder="Enter room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="mb-4"
            />
          </ActionCard>
        </div>
      </main>
    </div>
  );
}
