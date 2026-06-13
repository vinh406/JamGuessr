import { useAuth } from "../hooks/useAuth";
import PageLayout from "../components/common/PageLayout";
import LoadingSpinner from "../components/common/LoadingSpinner";
import FeatureItem from "../components/common/FeatureItem";
import { Button } from "../components/ui";
import { App, Google, Users, MusicNote, Lightning } from "../components/ui/icons";

export default function LoginPage() {
  const { login, isLoading } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      await login({ provider: "google" });
    } catch (error) {
      console.error("Failed to login with Google:", error);
    }
  };

  return (
    <PageLayout showHeader={false} className="flex items-center justify-center pt-6">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <App className="w-20 h-20 mx-auto mb-6 drop-shadow-[0_4px_12px_rgba(34,197,94,0.3)]" />
          <h1 className="text-4xl font-bold text-white mb-3">JamGuessr</h1>
          <p className="text-gray-400 text-lg">The ultimate music guessing game</p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-3xl p-8 pt-6 border border-gray-700/50 shadow-xl">
          <h2 className="text-2xl font-semibold text-white mb-4 text-center">Welcome!</h2>

          {/* Google Login Button */}
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            variant="white"
            className="w-full flex items-center justify-center gap-3 mb-6"
            size="lg"
          >
            {isLoading ? <LoadingSpinner size="md" /> : <Google className="w-6 h-6" />}
            {isLoading ? "Signing in..." : "Continue with Google"}
          </Button>

          {/* Features */}
          <div className="space-y-4">
            <FeatureItem
              icon={<Users className="w-5 h-5 text-green-400" />}
              title="Play with Friends"
              description="Create rooms and invite your friends"
            />

            <FeatureItem
              icon={<MusicNote className="w-5 h-5 text-green-400" />}
              title="Your Music Taste"
              description="Games based on your Spotify library"
            />

            <FeatureItem
              icon={<Lightning className="w-5 h-5 text-green-400" />}
              title="Real-time Battles"
              description="Compete in live music challenges"
            />
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-8">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </PageLayout>
  );
}
