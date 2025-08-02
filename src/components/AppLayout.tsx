import React, { memo, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SidebarLayout, useSidebarContext } from './sidebar-layout';
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from './navbar';
import { 
  Sidebar, 
  SidebarBody, 
  SidebarFooter, 
  SidebarHeader, 
  SidebarItem, 
  SidebarLabel, 
  SidebarSection, 
  SidebarSpacer
} from './sidebar';
import { 
  Dropdown, 
  DropdownButton, 
  DropdownDivider, 
  DropdownItem, 
  DropdownLabel, 
  DropdownMenu 
} from './dropdown';
import {
  DropdownMenu as UIDropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar } from './avatar';
import { ProfileAvatar } from './profile-avatar';
import { LoginButton } from './login-button';
import NotificationIndicator from './NotificationIndicator';
import { 
  PlayIcon, 
  TableCellsIcon, 
  TrophyIcon, 
  HomeIcon, 
  Cog6ToothIcon, 
  QuestionMarkCircleIcon,
  UserIcon,
  ArrowRightStartOnRectangleIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon
} from '@heroicons/react/24/solid';
import type { User } from 'firebase/auth';

interface AppLayoutProps {
  user: User | null;
  pendingInvitations: number;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
  refreshInvitations: () => Promise<void>;
  children: React.ReactNode;
}

// Static navbar component (never re-renders unless user changes)
const StaticNavbar = memo<{
  user: User | null;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
}>(({ user, handleLogin, handleLogout }) => {
  const { closeSidebar } = useSidebarContext();
  
  // Function to close sidebar on mobile
  const handleLinkClick = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && closeSidebar) {
      closeSidebar();
    }
  }, [closeSidebar]);

  return (
  <Navbar>
    <NavbarSpacer />
    <NavbarSection>
      <Link to="/create-game" onClick={handleLinkClick}>
        <NavbarItem aria-label="New Game">
          <PlayIcon />
        </NavbarItem>
      </Link>
      <Link to="/rankings" onClick={handleLinkClick}>
        <NavbarItem aria-label="Rankings">
          <TableCellsIcon className="h-5 w-5" />
        </NavbarItem>
      </Link>
      <Link to="/leagues" onClick={handleLinkClick}>
        <NavbarItem aria-label="Leagues">
          <TrophyIcon className="h-5 w-5" />
        </NavbarItem>
      </Link>
      {user ? (
        <UIDropdownMenu>
          <DropdownMenuTrigger asChild>
            <NavbarItem className="data-[state=open]:bg-zinc-700 data-[state=open]:text-white cursor-pointer" aria-label="User menu">
              <ProfileAvatar
                user={user}
                size="small"
                square
                alt={user.displayName || "User profile"}
                className="h-8 w-8 rounded-lg"
              />
            </NavbarItem>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side="bottom"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <ProfileAvatar
                  user={user}
                  size="small"
                  square
                  alt={user.displayName || "User profile"}
                  className="h-8 w-8 rounded-lg"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {user.displayName || "User"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email || ""}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <Link to="/profile" onClick={handleLinkClick}>
                <DropdownMenuItem>
                  <UserIcon className="h-4 w-4" />
                  My Profile
                </DropdownMenuItem>
              </Link>
              <Link to="/games" onClick={handleLinkClick}>
                <DropdownMenuItem>
                  <PlayIcon className="h-4 w-4" />
                  My Games
                </DropdownMenuItem>
              </Link>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </UIDropdownMenu>
      ) : (
        <LoginButton onClick={handleLogin} variant="navbar" />
      )}
    </NavbarSection>
  </Navbar>
  );
});
StaticNavbar.displayName = 'StaticNavbar';

// Static sidebar component (only re-renders when user or notifications change)
const StaticSidebar = memo<{
  user: User | null;
  pendingInvitations: number;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
  refreshInvitations: () => Promise<void>;
}>(({ user, pendingInvitations, handleLogin, handleLogout, refreshInvitations }) => {
  // Detect if mobile for dropdown positioning
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  const { closeSidebar } = useSidebarContext();
  
  // Function to close sidebar on mobile
  const handleLinkClick = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && closeSidebar) {
      closeSidebar();
    }
  }, [closeSidebar]);

  // Combined function for games link
  const handleGamesClick = useCallback(() => {
    refreshInvitations();
    handleLinkClick();
  }, [refreshInvitations, handleLinkClick]);
  
  return (
  <Sidebar className="text-white">
    <SidebarHeader>
      <Link to="/" onClick={handleLinkClick}>
        <SidebarItem className="lg:mb-2.5">
          <Avatar src="/usa-federation.png" square className="w-32 h-32" />
          <SidebarLabel className="text-white">USA Domino</SidebarLabel>
        </SidebarItem>
      </Link>
      <SidebarSection className="max-lg:hidden">
        <Link to="/create-game" onClick={handleLinkClick}>
          <SidebarItem>
            <PlayIcon />
            <SidebarLabel>New game</SidebarLabel>
          </SidebarItem>
        </Link>
        <Link to="/rankings" onClick={handleLinkClick}>
          <SidebarItem>
            <TableCellsIcon className="h-5 w-5" />
            <SidebarLabel>Rankings</SidebarLabel>
          </SidebarItem>
        </Link>
        <Link to="/leagues" onClick={handleLinkClick}>
          <SidebarItem>
            <TrophyIcon className="h-5 w-5" />
            <SidebarLabel>Leagues</SidebarLabel>
          </SidebarItem>
        </Link>
      </SidebarSection>
    </SidebarHeader>
    <SidebarBody>
      <SidebarSection>
        <Link to="/" onClick={handleLinkClick}>
          <SidebarItem>
            <HomeIcon />
            <SidebarLabel>Home</SidebarLabel>
          </SidebarItem>
        </Link>
        <Link to="/games" onClick={handleGamesClick}>
          <SidebarItem>
            <div className="relative">
              <PlayIcon className="h-5 w-5" />
              {pendingInvitations > 0 && (
                <NotificationIndicator count={pendingInvitations} size="small" />
              )}
            </div>
            <SidebarLabel>My Games</SidebarLabel>
          </SidebarItem>
        </Link>
        <Link to="/settings" onClick={handleLinkClick}>
          <SidebarItem>
            <Cog6ToothIcon className="h-5 w-5" />
            <SidebarLabel>Settings</SidebarLabel>
          </SidebarItem>
        </Link>
      </SidebarSection>
      <SidebarSpacer />
      <SidebarSection>
        <Link to="/rules" onClick={handleLinkClick}>
          <SidebarItem>
            <QuestionMarkCircleIcon />
            <SidebarLabel>Rules</SidebarLabel>
          </SidebarItem>
        </Link>
      </SidebarSection>
    </SidebarBody>
    <SidebarFooter className="max-lg:hidden">
      {user ? (
        <UIDropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarItem className="data-[state=open]:bg-zinc-700 data-[state=open]:text-white cursor-pointer">
              <span className="flex min-w-0 items-center gap-3">
                <ProfileAvatar
                  user={user}
                  size="medium"
                  square
                  alt={user.displayName || "User profile"}
                  className="h-8 w-8 rounded-lg"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-white">
                    {user.displayName || "User"}
                  </span>
                  <span className="truncate text-xs text-white/70">
                    {user.email || ""}
                  </span>
                </div>
              </span>
              <EllipsisVerticalIcon className="ml-auto h-4 w-4" />
            </SidebarItem>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <ProfileAvatar
                  user={user}
                  size="small"
                  square
                  alt={user.displayName || "User profile"}
                  className="h-8 w-8 rounded-lg"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {user.displayName || "User"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email || ""}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <Link to="/profile" onClick={handleLinkClick}>
                <DropdownMenuItem>
                  <UserIcon className="h-4 w-4" />
                  My profile
                </DropdownMenuItem>
              </Link>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </UIDropdownMenu>
      ) : (
        <LoginButton onClick={handleLogin} />
      )}
    </SidebarFooter>
  </Sidebar>
  );
});
StaticSidebar.displayName = 'StaticSidebar';

// Main layout component - ultra-optimized
export const AppLayout = memo<AppLayoutProps>(({ 
  user, 
  pendingInvitations, 
  handleLogin, 
  handleLogout, 
  refreshInvitations, 
  children 
}) => {
  // Memoize navbar (only changes when user auth state changes)
  const navbar = useMemo(() => (
    <StaticNavbar 
      user={user} 
      handleLogin={handleLogin} 
      handleLogout={handleLogout} 
    />
  ), [user, handleLogin, handleLogout]);

  // Memoize sidebar (only changes when user or notifications change)
  const sidebar = useMemo(() => (
    <StaticSidebar 
      user={user} 
      pendingInvitations={pendingInvitations}
      handleLogin={handleLogin} 
      handleLogout={handleLogout}
      refreshInvitations={refreshInvitations}
    />
  ), [user, pendingInvitations, handleLogin, handleLogout, refreshInvitations]);

  return (
    <SidebarLayout navbar={navbar} sidebar={sidebar}>
      {children}
    </SidebarLayout>
  );
});

AppLayout.displayName = 'AppLayout';
