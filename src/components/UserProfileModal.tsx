import React, { useState, useEffect, useCallback, memo } from "react";
import { Dialog, DialogTitle, DialogBody, DialogActions } from "./dialog";
import { Button } from "./button";
import { Avatar } from "./avatar";
import { UserProfile, getUserLeaguesWithRanking } from "../firebase";
import { StatCard, LeagueCard, TitleBadge, UserStatsGrid } from "./ProfileComponents";
import { Link } from "react-router-dom";

interface UserProfileModalProps {
  /** The user to display */
  user: UserProfile | null;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Optional custom stats to display instead of user's stats */
  customStats?: {
    gamesPlayed?: number;
    gamesWon?: number;
    totalPoints?: number;
    rank?: number;
    winRate?: number;
  };
  /** Show/hide specific sections */
  sections?: {
    stats?: boolean;
    leagues?: boolean;
    memberInfo?: boolean;
  };
  /** Custom title for the modal */
  title?: string;
  /** Show action buttons */
  showActions?: boolean;
  /** Custom actions */
  actions?: React.ReactNode;
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

const UserProfileModal: React.FC<UserProfileModalProps> = memo(({
  user,
  isOpen,
  onClose,
  customStats,
  sections = {
    stats: true,
    leagues: true,
    memberInfo: true,
  },
  title = "Player Profile",
  showActions = true,
  actions,
  size = "2xl"
}) => {
  const [userLeagues, setUserLeagues] = useState<any[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);

  // Load user leagues when modal opens
  useEffect(() => {
    if (isOpen && user && sections.leagues) {
      setLoadingLeagues(true);
      getUserLeaguesWithRanking(user.uid)
        .then(setUserLeagues)
        .catch(error => {
          console.error("Error loading user leagues:", error);
          setUserLeagues([]);
        })
        .finally(() => setLoadingLeagues(false));
    }
  }, [isOpen, user, sections.leagues]);

  // Memoized stats calculation
  const displayStats = React.useMemo(() => {
    if (!user) return null;
    
    return {
      gamesPlayed: customStats?.gamesPlayed ?? user.stats.gamesPlayed,
      gamesWon: customStats?.gamesWon ?? user.stats.gamesWon,
      totalPoints: customStats?.totalPoints ?? user.stats.totalPoints,
      globalRank: customStats?.rank ?? user.stats.globalRank,
      winStreak: user.stats.winStreak,
      maxWinStreak: user.stats.maxWinStreak,
      winRate: customStats?.winRate ?? (
        user.stats.gamesPlayed > 0 
          ? Math.round((user.stats.gamesWon / user.stats.gamesPlayed) * 100)
          : 0
      )
    };
  }, [user, customStats]);

  // Close handler
  const handleClose = useCallback(() => {
    onClose();
    // Reset leagues when closing
    setUserLeagues([]);
  }, [onClose]);

  if (!user) return null;

  return (
    <Dialog open={isOpen} onClose={handleClose} size={size}>
      <DialogTitle className="flex items-center justify-between">
        <span>{title}</span>
        <button
          onClick={handleClose}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </DialogTitle>
      
      <DialogBody>
          {/* Player Header - Always visible */}
          <div className="flex flex-col items-center space-y-4 mb-6">
            <Avatar 
              src={user.photoURL} 
              initials={user.displayName.substring(0, 2).toUpperCase()}
              className="h-24 w-24"
            />
            
            <div className="text-center">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                {user.displayName}
              </h3>
              {user.username && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  @{user.username}
                </p>
              )}
              {user.email && (
                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                  {user.email}
                </p>
              )}
            </div>
            
            <TitleBadge gamesWon={user.stats.gamesWon} />
          </div>

          {/* Stats Section */}
          {sections.stats && displayStats && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3 text-zinc-900 dark:text-white">
                Statistics
              </h4>
              <UserStatsGrid stats={displayStats} />
            </div>
          )}

          {/* Leagues Section */}
          {sections.leagues && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3 text-zinc-900 dark:text-white">
                Leagues
              </h4>
              {loadingLeagues ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : userLeagues.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {userLeagues.map((league) => (
                    <div key={league.id} onClick={handleClose}>
                      <Link
                        to={`/leagues/${league.id}`}
                        className="block p-3 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          {/* League Avatar */}
                          <div className="flex-shrink-0">
                            {league.photoURL ? (
                              <img
                                src={league.photoURL}
                                alt={league.name}
                                className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-zinc-600"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                                  <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          
                          {/* League Info */}
                          <div className="flex-1 min-w-0">
                            <h5 className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                              {league.name}
                            </h5>
                            <div className="flex items-center space-x-2 mt-1">
                              {league.rank && (
                                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                  Rank #{league.rank}
                                </span>
                              )}
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {league.totalMembers || 0} members
                              </span>
                            </div>
                            {league.description && (
                              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-1">
                                {league.description}
                              </p>
                            )}
                          </div>
                          
                          {/* Arrow Icon */}
                          <div className="flex-shrink-0">
                            <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-sm">Not a member of any leagues yet</p>
                </div>
              )}
            </div>
          )}

          {/* Member Information */}
          {sections.memberInfo && (
            <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">Member since</span>
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : "Unknown"}
                  </span>
                </div>
                {user.stats.lastGameAt && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">Last game</span>
                    <span className="font-medium text-zinc-900 dark:text-white">
                      {new Date(user.stats.lastGameAt.toDate()).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogBody>

    </Dialog>
  );
});

UserProfileModal.displayName = 'UserProfileModal';

export default UserProfileModal;

// Hook for easier usage
export const useUserProfileModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const openModal = useCallback((user: UserProfile) => {
    setSelectedUser(user);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    // Delay clearing the user to allow for exit animation
    setTimeout(() => setSelectedUser(null), 200);
  }, []);

  return {
    isOpen,
    selectedUser,
    openModal,
    closeModal,
  };
};
