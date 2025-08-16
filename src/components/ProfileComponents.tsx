import React, { memo } from "react";
import { Link } from "react-router-dom";

// Reusable StatCard component from Profile.tsx
export const StatCard = memo<{ 
  title: string; 
  value: number | string; 
  color: string;
  className?: string;
}>(({ title, value, color, className = "" }) => (
  <div className={`p-3 sm:p-4 bg-gray-50 dark:bg-zinc-700 rounded-lg text-center ${className}`}>
    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-1">
      {title}
    </p>
    <p className={`text-lg sm:text-2xl font-bold ${color}`}>
      {value}
    </p>
  </div>
));
StatCard.displayName = 'StatCard';

// Enhanced LeagueCard component with ranking support
export const LeagueCard = memo<{ 
  league: { 
    id: string; 
    name: string; 
    photoURL?: string; 
    description?: string;
    rank?: number;
    totalMembers?: number;
  };
  showRanking?: boolean;
  onClick?: () => void;
  href?: string;
}>(({ league, showRanking = false, onClick, href }) => {
  const CardContent = (
    <div className="group flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 dark:bg-zinc-700 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors min-w-[220px] cursor-pointer">
      {league.photoURL ? (
        <img
          src={league.photoURL}
          alt={league.name}
          className="w-10 h-10 rounded-full object-cover border border-gray-300 dark:border-gray-600"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
          {league.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-medium text-zinc-900 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-blue-200">
          {league.name}
        </span>
        {league.description && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
            {league.description}
          </span>
        )}
        {showRanking && league.rank && (
          <span className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            Rank #{league.rank}{league.totalMembers ? ` of ${league.totalMembers}` : ''}
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link to={href} style={{ textDecoration: "none" }}>
        {CardContent}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div onClick={onClick}>
        {CardContent}
      </div>
    );
  }

  return CardContent;
});
LeagueCard.displayName = 'LeagueCard';

// TitleBadge component from Profile.tsx
export const TitleBadge = memo<{ gamesWon: number }>(({ gamesWon }) => {
  const calculateTitle = (wins: number): string => {
    if (wins >= 25) return "Duro del 6";
    if (wins >= 15) return "Tranquero";
    if (wins >= 8) return "Matador";
    return "Novice";
  };

  const title = calculateTitle(gamesWon);

  return (
    <div>
      <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
        {title}
      </span>
    </div>
  );
});
TitleBadge.displayName = 'TitleBadge';

// User Stats Grid component
export const UserStatsGrid = memo<{ 
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    totalPoints: number;
    globalRank?: number;
    winStreak?: number;
    maxWinStreak?: number;
  }
}>(({ stats }) => {
  const winPercentage = stats.gamesPlayed > 0 
    ? ((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(1)
    : "0.0";

  const lossRate = stats.gamesPlayed > 0 
    ? (((stats.gamesPlayed - stats.gamesWon) / stats.gamesPlayed) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard 
        title="Games Won" 
        value={stats.gamesWon} 
        color="text-green-600" 
      />
      <StatCard 
        title="Games Played" 
        value={stats.gamesPlayed} 
        color="text-blue-600" 
      />
      <StatCard 
        title="Total Points" 
        value={stats.totalPoints} 
        color="text-purple-600" 
      />
      <StatCard 
        title="Global Rank" 
        value={stats.globalRank || "N/A"} 
        color="text-orange-600" 
      />
      <StatCard 
        title="Win Rate" 
        value={`${winPercentage}%`} 
        color="text-green-600" 
      />
      <StatCard 
        title="Loss Rate" 
        value={`${lossRate}%`} 
        color="text-red-600" 
      />
      {stats.winStreak !== undefined && (
        <StatCard 
          title="Win Streak" 
          value={stats.winStreak} 
          color="text-yellow-600" 
        />
      )}
      {stats.maxWinStreak !== undefined && (
        <StatCard 
          title="Best Streak" 
          value={stats.maxWinStreak} 
          color="text-indigo-600" 
        />
      )}
    </div>
  );
});
UserStatsGrid.displayName = 'UserStatsGrid';
