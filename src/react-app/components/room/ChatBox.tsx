import { useState, useRef, useEffect } from "react";
import { Input, Button } from "../ui";
import { ChatBubble, Send } from "../ui/icons";

interface Message {
  type: string;
  timestamp: number;
  content?: string;
  username?: string;
  userId?: string;
}

interface ChatBoxProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  userId: string;
  isConnected: boolean;
  usersCount: number;
}

type BadgeVariant = "green" | "red" | "yellow";

const badgeVariantClasses: Record<BadgeVariant, string> = {
  green: "bg-green-500/20 text-green-400",
  red: "bg-red-500/20 text-red-400",
  yellow: "bg-yellow-500/20 text-yellow-400",
};

function NotificationBadge({
  variant,
  children,
}: {
  variant: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <div className="text-center py-2">
      <div
        className={`inline-block px-3 py-1 rounded-full text-xs ${badgeVariantClasses[variant]}`}
      >
        {children}
      </div>
    </div>
  );
}

export function ChatBox({
  messages,
  onSendMessage,
  userId,
  isConnected,
  usersCount,
}: ChatBoxProps) {
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (inputMessage.trim() && isConnected) {
      onSendMessage(inputMessage.trim());
      setInputMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderMessage = (message: Message, index: number) => {
    if (message.type === "user_joined") {
      return (
        <NotificationBadge key={index} variant="green">
          {message.username} joined the room
        </NotificationBadge>
      );
    }

    if (message.type === "user_left") {
      return (
        <NotificationBadge key={index} variant="red">
          {message.username} left the room
        </NotificationBadge>
      );
    }

    if (message.type === "error") {
      return (
        <NotificationBadge key={index} variant="yellow">
          {message.content}
        </NotificationBadge>
      );
    }

    if (message.type === "message" && message.content) {
      const isOwnMessage = message.userId === userId;
      return (
        <div
          key={index}
          className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"} mb-3`}
        >
          <div
            className={`max-w-[85%] px-4 py-2 rounded-2xl ${
              isOwnMessage
                ? "bg-gradient-to-r from-green-400 to-green-600 text-white rounded-br-md"
                : "bg-gray-700/50 text-gray-100 rounded-bl-md"
            }`}
          >
            {!isOwnMessage && message.username && (
              <div className="text-xs font-semibold mb-1 text-green-400">{message.username}</div>
            )}
            <p className="text-sm break-words">{message.content}</p>
          </div>
          <div className="flex items-center gap-2 mt-1 px-1">
            <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
            {isOwnMessage && <span className="text-xs text-gray-500">You</span>}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
            <ChatBubble className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Room Chat</h3>
            <p className="text-xs text-gray-400">
              {usersCount} user{usersCount !== 1 ? "s" : ""} online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs text-gray-400">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 bg-gray-700/30 rounded-full flex items-center justify-center mb-3">
              <ChatBubble className="w-6 h-6 text-gray-500" />
            </div>
            <p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => renderMessage(message, index))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700/50">
        <div className="flex gap-2">
          <Input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={!isConnected}
            size="sm"
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!inputMessage.trim() || !isConnected} size="sm">
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
