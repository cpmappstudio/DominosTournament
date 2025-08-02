import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogBody,
} from "./dialog";
import { Avatar } from "./avatar";
import { UserProfile, getUserLeaguesWithRanking } from "../firebase";
import { StatCard, LeagueCard, TitleBadge, UserStatsGrid } from "./ProfileComponents";

interface UserProfileDialogProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  stats?: {
    gamesPlayed?: number;
    gamesWon?: number;
    totalPoints?: number;
    rank?: number;
    winRate?: number;
  };
}

const UserProfileDialog: React.FC<UserProfileDialogProps> = ({
  user,
  isOpen,
  onClose,
  stats,
}) => {
  const [userLeagues, setUserLeagues] = useState<any[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setLoadingLeagues(true);
      getUserLeaguesWithRanking(user.uid)
        .then(setUserLeagues)
        .catch(error => {
          console.error("Error loading user leagues:", error);
          setUserLeagues([]);
        })
        .finally(() => setLoadingLeagues(false));
    }
  }, [isOpen, user]);

  if (!user) return null;

  // Use provided stats or fall back to user's stats
  const displayStats = {
    gamesPlayed: stats?.gamesPlayed ?? user.stats.gamesPlayed,
    gamesWon: stats?.gamesWon ?? user.stats.gamesWon,
    totalPoints: stats?.totalPoints ?? user.stats.totalPoints,
    globalRank: stats?.rank ?? user.stats.globalRank,
    winStreak: user.stats.winStreak,
    maxWinStreak: user.stats.maxWinStreak
  };

  return (
    <Dialog open={isOpen} onClose={onClose} size="2xl">
      <div className="space-y-6">
        <DialogTitle>Player Profile</DialogTitle>
        
        <DialogBody>
          {/* Player Header */}
          <div className="flex flex-col items-center space-y-4 mb-6">
            <Avatar 
              src={user.photoURL} 
              initials={user.displayName.substring(0, 2).toUpperCase()}
              className="h-24 w-24"
            />
            
            <div className="text-center">
              <h3 className="text-xl font-bold">{user.displayName}</h3>
              {user.username && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">@{user.username}</p>
              )}
              {user.email && (
                <p className="text-xs text-zinc-500 dark:text-zinc-500">{user.email}</p>
              )}
            </div>
            
            <TitleBadge gamesWon={user.stats.gamesWon} />
          </div>

          {/* Stats Section */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-3">Statistics</h4>
            <UserStatsGrid stats={displayStats} />
          </div>

          {/* Leagues Section */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-3">Leagues</h4>
            {loadingLeagues ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : userLeagues.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {userLeagues.map((league) => (
                  <LeagueCard
                    key={league.id}
                    league={league}
                    showRanking={true}
                    href={`/leagues/${league.id}`}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-zinc-500 dark:text-zinc-400">
                <p>Not a member of any leagues yet</p>
              </div>
            )}
          </div>

          {/* Member Since */}
          <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Member since</span>
              <span className="font-medium">
                {user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : "Unknown"}
              </span>
            </div>
            {user.stats.lastGameAt && (
              <div className="flex justify-between items-center text-sm mt-2">
                <span className="text-zinc-600 dark:text-zinc-400">Last game</span>
                <span className="font-medium">
                  {new Date(user.stats.lastGameAt.toDate()).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </DialogBody>
      </div>
    </Dialog>
  );
};

export default UserProfileDialog;
