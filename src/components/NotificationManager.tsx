import { memo, useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { getNewInvitations } from '../firebase';
import NotificationIndicator from './NotificationIndicator';

interface NotificationManagerProps {
  user: User | null;
  children: (pendingInvitations: number, refreshInvitations: () => Promise<void>) => React.ReactNode;
}

export const NotificationManager = memo<NotificationManagerProps>(({ user, children }) => {
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

    // Only set up polling if user is logged in
    if (!user) return;

    // Use smart polling: more frequent when tab is active, less when inactive
    let intervalId: NodeJS.Timeout;
    
    const handleVisibilityChange = () => {
      clearInterval(intervalId);
      
      if (document.visibilityState === 'visible') {
        // Active tab: check every 30 seconds
        fetchInvitations();
        intervalId = setInterval(fetchInvitations, 30000);
      } else {
        // Inactive tab: check every 2 minutes to save resources
        intervalId = setInterval(fetchInvitations, 120000);
      }
    };

    // Initial setup
    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, fetchInvitations]);

  return <>{children(pendingInvitations, fetchInvitations)}</>;
});

NotificationManager.displayName = 'NotificationManager';
