import { Avatar } from "@/components/avatar";
import { ProfileAvatar } from "@/components/profile-avatar";
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from "@/components/dropdown";
import {
  Navbar,
  NavbarItem,
  NavbarSection,
  NavbarSpacer,
} from "@/components/navbar";
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from "@/components/sidebar";
import { SidebarLayout } from "@/components/sidebar-layout";
import {
  ArrowRightStartOnRectangleIcon,
  ChevronUpIcon,
  UserIcon,
} from "@heroicons/react/16/solid";
import { HomeIcon, QuestionMarkCircleIcon } from "@heroicons/react/20/solid";
import { TableCellsIcon } from "@heroicons/react/24/solid";
import { ClipboardIcon } from "@heroicons/react/24/solid";
import { PlayIcon } from "@heroicons/react/24/solid";
import { Cog6ToothIcon } from "@heroicons/react/24/solid";
import { useState, useEffect } from "react";
import { signOut, onAuthStateChanged, type User } from "firebase/auth";
import { LoginButton } from "@/components/login-button";
import {
  auth,
  loginWithGoogle,
  getUserProfile,
  getNewInvitations,
} from "./firebase";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import UsernameSetup from "@/components/auth/UsernameSetup";
import NotificationIndicator from "@/components/NotificationIndicator";
import { BellAlertIcon, TrophyIcon } from "@heroicons/react/24/solid";
import { isJudge } from "./utils/auth";

// Import page components
import Home from "./pages/Home";
import Rules from "./pages/Rules";
import Profile from "./pages/Profile";
import CreateGame from "./pages/CreateGame";
import GameDetail from "./pages/GameDetail";
import GamesList from "./pages/GamesList";
import Settings from "./pages/Settings";
import Rankings from "./pages/rankings";
import Leagues from "./pages/leagues";
import CreateLeague from "./pages/leagues/create";
import LeagueDetail from "./pages/leagues/detail";
import JoinLeague from "./pages/leagues/join";
import LeagueManagement from "./pages/leagues/manage";

// Main App component with routing
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<number>(0);

  // Function to fetch pending game invitations
  const fetchPendingInvitations = async () => {
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
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Check if user needs to set a username
        const userProfile = await getUserProfile(currentUser.uid);
        // Only show username setup if user has no profile or hasSetUsername is explicitly false
        // Once a username is set, it can never be changed
        setNeedsUsername(
          userProfile
            ? userProfile.hasSetUsername === false && !userProfile.username
            : true,
        );
      } else {
        setNeedsUsername(false);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch invitations when user changes
  useEffect(() => {
    fetchPendingInvitations();

    // Set up interval to check for new invitations every 30 seconds
    const intervalId = setInterval(fetchPendingInvitations, 30000);

    return () => clearInterval(intervalId);
  }, [user]);

  // Login function using Google authentication
  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {/* Username setup is shown only once per user and cannot be changed after setup */}
      {needsUsername && user ? (
        <UsernameSetup user={user} onComplete={() => setNeedsUsername(false)} />
      ) : null}
      <AppContent
        user={user}
        needsUsername={needsUsername}
        pendingInvitations={pendingInvitations}
        handleLogin={handleGoogleLogin}
        handleLogout={handleLogout}
        refreshInvitations={fetchPendingInvitations}
      />
    </BrowserRouter>
  );
}

// Separate component for app content with routing
const AppContent: React.FC<{
  user: User | null;
  needsUsername: boolean;
  pendingInvitations: number;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
  refreshInvitations: () => Promise<void>;
}> = ({
  user,
  needsUsername,
  pendingInvitations,
  handleLogin,
  handleLogout,
  refreshInvitations,
}) => {
  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection>
            <NavbarItem href="/create-game" aria-label="New Game">
              <PlayIcon />
            </NavbarItem>
            <NavbarItem href="/rankings" aria-label="Rankings">
              <TableCellsIcon className="h-5 w-5" />
            </NavbarItem>
            <NavbarItem href="/leagues" aria-label="Leagues">
              <TrophyIcon className="h-5 w-5" />
            </NavbarItem>
            <NavbarItem
              href="/games"
              aria-label="My Games"
              onClick={refreshInvitations}
            >
              <div className="relative">
                <PlayIcon className="h-5 w-5" />
                {pendingInvitations > 0 && (
                  <NotificationIndicator
                    count={pendingInvitations}
                    size="small"
                  />
                )}
              </div>
            </NavbarItem>
            <NavbarItem href="/rules" aria-label="Rules">
              <ClipboardIcon />
            </NavbarItem>
            {user ? (
              <Dropdown>
                <DropdownButton as={NavbarItem}>
                  <ProfileAvatar
                    user={user}
                    size="small"
                    square
                    alt={user.displayName || "User profile"}
                  />
                </DropdownButton>
                <DropdownMenu className="min-w-64" anchor="bottom end">
                  <DropdownItem href="/profile">
                    <UserIcon />
                    <DropdownLabel>My Profile</DropdownLabel>
                  </DropdownItem>
                  <DropdownItem href="/games">
                    <PlayIcon className="h-5 w-5" />
                    <DropdownLabel>My Games</DropdownLabel>
                  </DropdownItem>
                  <DropdownDivider />
                  <DropdownItem onClick={handleLogout}>
                    <ArrowRightStartOnRectangleIcon />
                    <DropdownLabel>Sign out</DropdownLabel>
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            ) : (
              <LoginButton onClick={handleLogin} variant="navbar" />
            )}
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <Dropdown>
              <SidebarItem href="/" className="lg:mb-2.5">
                <Avatar src="/usa-federation.jpg" />
                <SidebarLabel>USA Domino</SidebarLabel>
              </SidebarItem>
            </Dropdown>
            <SidebarSection className="max-lg:hidden">
              <SidebarItem href="/create-game">
                <PlayIcon />
                <SidebarLabel>New game</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/rankings">
                <TableCellsIcon className="h-5 w-5" />
                <SidebarLabel>Rankings</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/leagues">
                <TrophyIcon className="h-5 w-5" />
                <SidebarLabel>Leagues</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarHeader>
          <SidebarBody>
            <SidebarSection>
              <SidebarItem href="/">
                <HomeIcon />
                <SidebarLabel>Home</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/games" onClick={refreshInvitations}>
                <div className="relative">
                  <PlayIcon className="h-5 w-5" />
                  {pendingInvitations > 0 && (
                    <NotificationIndicator
                      count={pendingInvitations}
                      size="small"
                    />
                  )}
                </div>
                <SidebarLabel>My Games</SidebarLabel>
              </SidebarItem>

              <SidebarItem href="/settings">
                <Cog6ToothIcon className="h-5 w-5" />
                <SidebarLabel>Settings</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
            <SidebarSpacer />
            <SidebarSection>
              <SidebarItem href="/rules">
                <QuestionMarkCircleIcon />
                <SidebarLabel>Rules</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>
          <SidebarFooter className="max-lg:hidden">
            {user ? (
              <Dropdown>
                <DropdownButton as={SidebarItem}>
                  <span className="flex min-w-0 items-center gap-3">
                    <ProfileAvatar
                      user={user}
                      size="medium"
                      square
                      alt={user.displayName || "User profile"}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
                        {user.displayName || "User"}
                      </span>
                      <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                        {user.email || ""}
                      </span>
                    </span>
                  </span>
                  <ChevronUpIcon />
                </DropdownButton>
                <DropdownMenu className="min-w-64" anchor="top start">
                  <DropdownItem href="/profile">
                    <UserIcon />
                    <DropdownLabel>My profile</DropdownLabel>
                  </DropdownItem>
                  <DropdownDivider />
                  <DropdownItem onClick={handleLogout}>
                    <ArrowRightStartOnRectangleIcon />
                    <DropdownLabel>Sign out</DropdownLabel>
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            ) : (
              <LoginButton onClick={handleLogin} />
            )}
          </SidebarFooter>
        </Sidebar>
      }
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/rules" element={<Rules />} />
        <Route
          path="/profile"
          element={user && !needsUsername ? <Profile /> : <Navigate to="/" />}
        />
        <Route path="/rankings" element={<Rankings />} />
        <Route
          path="/create-game"
          element={
            user && !needsUsername ? <CreateGame /> : <Navigate to="/" />
          }
        />
        <Route
          path="/games"
          element={
            user && !needsUsername ? (
              <GamesList refreshNotifications={refreshInvitations} />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/game/:id"
          element={
            user && !needsUsername ? (
              <GameDetail refreshNotifications={refreshInvitations} />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/settings"
          element={user && !needsUsername ? <Settings /> : <Navigate to="/" />}
        />
        <Route path="/leagues" element={<Leagues />} />
        <Route
          path="/leagues/create"
          element={
            user && !needsUsername && isJudge(user) ? (
              <CreateLeague />
            ) : (
              <Navigate to="/leagues" />
            )
          }
        />
        <Route
          path="/leagues/:id"
          element={
            user && !needsUsername ? (
              <LeagueDetail />
            ) : (
              <Navigate to="/leagues" />
            )
          }
        />
        <Route
          path="/leagues/join/:id"
          element={
            user && !needsUsername ? <JoinLeague /> : <Navigate to="/leagues" />
          }
        />
        <Route
          path="/leagues/manage/:id"
          element={
            user && !needsUsername ? <LeagueManagement /> : <Navigate to="/leagues" />
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </SidebarLayout>
  );
};

export default App;
