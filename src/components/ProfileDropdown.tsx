import { memo } from 'react';
import { User } from 'firebase/auth';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@/components/dropdown';
import { NavbarItem } from '@/components/navbar';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ModeToggle } from '@/components/mode-toggle';
import { LoginButton } from '@/components/login-button';
import {
  UserIcon,
  Cog6ToothIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { PlayIcon } from '@heroicons/react/24/solid';

interface ProfileDropdownProps {
  user: User | null;
  onLogout: () => Promise<void>;
  onLogin?: () => Promise<void>;
}

export const ProfileDropdown = memo<ProfileDropdownProps>(({ user, onLogout, onLogin }) => {
  if (!user) {
    return (
      <>
        {onLogin && (
          <LoginButton onClick={onLogin} />
        )}
        <ModeToggle />
      </>
    );
  }

  return (
    <>
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
          <DropdownItem href="/settings">
            <Cog6ToothIcon className="h-5 w-5" />
            <DropdownLabel>Settings</DropdownLabel>
          </DropdownItem>
          <DropdownDivider />
          <DropdownItem onClick={onLogout}>
            <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
            <DropdownLabel>Sign Out</DropdownLabel>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
      <ModeToggle />
    </>
  );
});

ProfileDropdown.displayName = 'ProfileDropdown';
