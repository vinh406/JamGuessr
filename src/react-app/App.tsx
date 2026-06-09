import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./hooks/useAuth";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RoomPage from "./pages/RoomPage";
import LibraryPage from "./pages/LibraryPage";
import SettingsPage from "./pages/SettingsPage";
import HistoryPage from "./pages/HistoryPage";
import GameDetailPage from "./pages/GameDetailPage";
import { Toaster } from "sonner";
import FullScreenLoader from "./components/common/FullScreenLoader";

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <HomePage /> : <Navigate to="/login" replace />} />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/room/:roomName" element={<RoomPage />} />
      <Route
        path="/library"
        element={isAuthenticated ? <LibraryPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/settings"
        element={isAuthenticated ? <SettingsPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/history"
        element={isAuthenticated ? <HistoryPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/history/:id"
        element={isAuthenticated ? <GameDetailPage /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1f2937",
              border: "1px solid rgba(55,65,81,0.5)",
              color: "#f3f4f6",
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
