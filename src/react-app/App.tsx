import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./hooks/useAuth";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RoomPage from "./pages/RoomPage";
import LibraryPage from "./pages/LibraryPage";
import SettingsPage from "./pages/SettingsPage";
import HistoryPage from "./pages/HistoryPage";
import GameDetailPage from "./pages/GameDetailPage";
import { Toaster } from "sonner";
import FullScreenLoader from "./components/common/FullScreenLoader";

function HomeRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  return isAuthenticated ? <HomePage /> : <Navigate to="/login" replace />;
}

function LoginRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  return isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

const router = createBrowserRouter([
  {
    element: (
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    ),
    children: [
      { index: true, element: <HomeRoute /> },
      { path: "login", element: <LoginRoute /> },
      { path: "room/:roomName", element: <RoomPage /> },
      {
        path: "library",
        element: (
          <ProtectedRoute>
            <LibraryPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "settings",
        element: (
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "history",
        element: (
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "history/:id",
        element: (
          <ProtectedRoute>
            <GameDetailPage />
          </ProtectedRoute>
        ),
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
