import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/AppLayout";
import { ThemeProvider } from "./components/theme-provider";
import { useState, useEffect, useCallback, useMemo, memo, lazy, Suspense } from "react";
import { signOut, onAuthStateChanged, type User } from "firebase/auth";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import {
  auth,
  loginWithGoogle,
  getUserProfile,
  getNewInvitations,
} from "./firebase";
import UsernameSetup from "@/components/auth/UsernameSetup";
import { isJudge } from "./utils/auth";
import { browserScheduler } from "./utils/leagueStatusScheduler";

// Direct imports for critical routes (instant loading)
import Home from "./pages/Home";
import Rules from "./pages/Rules";
import Settings from "./pages/Settings";
import CreateGame from "./pages/CreateGame";
import Rankings from "./pages/rankings";
import Leagues from "./pages/leagues";

// Lazy load less critical pages
const Profile = lazy(() => import("./pages/Profile"));
const GameDetail = lazy(() => import("./pages/GameDetail"));
const GamesList = lazy(() => import("./pages/GamesList"));
const CreateLeague = lazy(() => import("./pages/leagues/create"));
const LeagueDetail = lazy(() => import("./pages/leagues/detail"));
const JoinLeague = lazy(() => import("./pages/leagues/join"));
const LeagueManagement = lazy(() => import("./pages/leagues/manage"));

// Preload strategy for lazy pages
const preloadLazyPages = () => {
  import("./pages/GamesList");
  import("./pages/Profile");
};

// Loading component for Suspense
const PageLoader = memo(() => (
  <div className="flex h-64 w-full items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
  </div>
));
PageLoader.displayName = 'PageLoader';

// Types
interface AppState {
  user: User | null;
  loading: boolean;
  needsUsername: boolean;
}

// Custom hook for invitation management with optimized polling
const useInvitationManager = (user: User | null) => {
  const [pendingInvitations, setPendingInvitations] = useState<number>(0);

  const fetchInvitations = useCallback(async () => {
    if (!user) {
      setPendingInvitations(0);
      return;
    }

    try {
      const invites = await getNewInvitations();
      setPendingInvitations(invites.length);
    } catch (error) {
      console.error("Error fetching game invitations:", error);
    }
  }, [user]);

  useEffect(() => {
    fetchInvitations();

    if (!user) return;

    // Smart polling: frequent when active, less when inactive
    let intervalId: NodeJS.Timeout;
    
    const handleVisibilityChange = () => {
      clearInterval(intervalId);
      
      if (document.visibilityState === 'visible') {
        fetchInvitations();
        intervalId = setInterval(fetchInvitations, 30000); // 30s
      } else {
        intervalId = setInterval(fetchInvitations, 120000); // 2min
      }
    };

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, fetchInvitations]);

  return { pendingInvitations, refreshInvitations: fetchInvitations };
};

// Main App component with optimized state management
const App = memo(() => {
  const [appState, setAppState] = useState<AppState>({
    user: null,
    loading: true,
    needsUsername: false,
  });

  const { pendingInvitations, refreshInvitations } = useInvitationManager(appState.user);

  // Optimized auth state listener with preloading
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userProfile = await getUserProfile(currentUser.uid);
          const needsUsernameSetup = userProfile
            ? userProfile.hasSetUsername === false && !userProfile.username
            : true;

          setAppState(prev => ({
            ...prev,
            user: currentUser,
            needsUsername: needsUsernameSetup,
            loading: false,
          }));

          // Preload lazy pages when user is authenticated
          if (!needsUsernameSetup) {
            preloadLazyPages();
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setAppState(prev => ({
            ...prev,
            user: currentUser,
            needsUsername: false,
            loading: false,
          }));
        }
      } else {
        setAppState({
          user: null,
          loading: false,
          needsUsername: false,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Initialize league status scheduler for authenticated users
  useEffect(() => {
    if (appState.user) {
      // Use simpler visibility-based scheduler with much longer intervals
      const cleanup = browserScheduler.startOnVisible({
        interval: 4 * 60 * 60 * 1000, // 4 hours interval instead of 1 hour - much more reasonable
        onUpdate: (result) => {
          // Only log in development mode when there are actual updates
          if (import.meta.env.DEV && result.updated > 0) {
            console.log(`League statuses updated: ${result.updated} leagues`);
          }
        },
        onError: (error) => {
          console.error('League status scheduler error:', error);
        }
      });

      return cleanup;
    }
  }, [appState.user]);

  // Memoized auth handlers
  const handleGoogleLogin = useCallback(async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, []);

  const handleUsernameSetupComplete = useCallback(() => {
    setAppState(prev => ({ ...prev, needsUsername: false }));
  }, []);

  // Memoized app props to prevent unnecessary re-renders
  const appContentProps = useMemo(() => ({
    user: appState.user,
    needsUsername: appState.needsUsername,
    pendingInvitations,
    handleLogin: handleGoogleLogin,
    handleLogout,
    refreshInvitations,
  }), [
    appState.user,
    appState.needsUsername,
    pendingInvitations,
    handleGoogleLogin,
    handleLogout,
    refreshInvitations,
  ]);

  if (appState.loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log critical errors for monitoring
        console.error('App-level error:', error);
        console.error('Error info:', errorInfo);
        
        // In production, send to error monitoring service
        if (import.meta.env.PROD) {
          // Example: Sentry.captureException(error);
        }
      }}
    >
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <BrowserRouter>
          {/* Username setup is shown only once per user and cannot be changed after setup */}
          {appState.needsUsername && appState.user && (
            <UsernameSetup 
              user={appState.user} 
              onComplete={handleUsernameSetupComplete} 
            />
          )}
          <AppContent {...appContentProps} />
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
});

App.displayName = 'App';

// Memoized AppContent component
const AppContent = memo<{
  user: User | null;
  needsUsername: boolean;
  pendingInvitations: number;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
  refreshInvitations: () => Promise<void>;
}>(({
  user,
  needsUsername,
  pendingInvitations,
  handleLogin,
  handleLogout,
  refreshInvitations,
}) => {
  // Authentication check helper
  const isAuthenticated = user && !needsUsername;

  return (
    <AppLayout
      user={user}
      pendingInvitations={pendingInvitations}
      handleLogin={handleLogin}
      handleLogout={handleLogout}
      refreshInvitations={refreshInvitations}
    >
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/leagues" element={<Leagues />} />

        {/* Protected routes */}
        <Route
          path="/profile"
          element={isAuthenticated ? (
            <Suspense fallback={<PageLoader />}>
              <Profile />
            </Suspense>
          ) : <Navigate to="/" />}
        />
        <Route
          path="/create-game"
          element={isAuthenticated ? <CreateGame /> : <Navigate to="/" />}
        />
        <Route
          path="/settings"
          element={isAuthenticated ? <Settings /> : <Navigate to="/" />}
        />
        <Route
          path="/games"
          element={isAuthenticated ? (
            <Suspense fallback={<PageLoader />}>
              <GamesList refreshNotifications={refreshInvitations} />
            </Suspense>
          ) : <Navigate to="/" />}
        />
        <Route
          path="/game/:id"
          element={isAuthenticated ? (
            <Suspense fallback={<PageLoader />}>
              <GameDetail refreshNotifications={refreshInvitations} />
            </Suspense>
          ) : <Navigate to="/" />}
        />

        {/* League routes */}
        <Route
          path="/leagues/create"
          element={isAuthenticated && isJudge(user) ? (
            <Suspense fallback={<PageLoader />}>
              <CreateLeague />
            </Suspense>
          ) : <Navigate to="/leagues" />}
        />
        <Route
          path="/leagues/:id"
          element={isAuthenticated ? (
            <Suspense fallback={<PageLoader />}>
              <LeagueDetail />
            </Suspense>
          ) : <Navigate to="/leagues" />}
        />
        <Route
          path="/leagues/join/:id"
          element={isAuthenticated ? (
            <Suspense fallback={<PageLoader />}>
              <JoinLeague />
            </Suspense>
          ) : <Navigate to="/leagues" />}
        />
        <Route
          path="/leagues/manage/:id"
          element={isAuthenticated ? (
            <Suspense fallback={<PageLoader />}>
              <LeagueManagement />
            </Suspense>
          ) : <Navigate to="/leagues" />}
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AppLayout>
  );
});

AppContent.displayName = 'AppContent';

export default App;
