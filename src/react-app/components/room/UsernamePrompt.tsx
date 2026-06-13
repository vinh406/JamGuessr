import { App, Google } from "../ui/icons";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

interface UsernamePromptProps {
  roomName: string;
  onSubmit: (username: string) => void;
  onLogin: () => void;
}

export function UsernamePrompt({ roomName, onSubmit, onLogin }: UsernamePromptProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-700/50">
        <div className="text-center mb-8">
          <App className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">
            Join <span className="text-green-400">#{roomName}</span>
          </h1>
          <p className="text-gray-400">Enter your username to join this game room</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const username = formData.get("username") as string;
            if (username?.trim()) {
              onSubmit(username.trim());
            }
          }}
          className="space-y-6"
        >
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <Input
              type="text"
              id="username"
              name="username"
              placeholder="Enter your username..."
              maxLength={20}
              required
              autoFocus
            />
          </div>

          <Button type="submit" className="w-full">
            Join as Guest
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700/50" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-gray-800/50 text-gray-500">or</span>
          </div>
        </div>

        <Button
          onClick={onLogin}
          variant="white"
          className="w-full flex items-center justify-center gap-3"
          size="lg"
        >
          <Google className="w-6 h-6" />
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
