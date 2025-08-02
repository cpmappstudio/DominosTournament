import React from "react";
import {
  Dialog,
  DialogTitle,
} from "./dialog";
import { Avatar } from "./avatar";
import { Badge } from "./badge";
import { RankingEntry, calculateTitle } from "../firebase";

interface PlayerProfileDialogProps {
  player: RankingEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

const PlayerProfileDialog: React.FC<PlayerProfileDialogProps> = ({
  player,
  isOpen,
  onClose,
}) => {
  if (!player) return null;

  const winPercentage = player.gamesPlayed > 0 
    ? ((player.gamesWon / player.gamesPlayed) * 100).toFixed(1)
    : "0.0";

  const lossRate = player.gamesPlayed > 0 
    ? (((player.gamesPlayed - player.gamesWon) / player.gamesPlayed) * 100).toFixed(1)
    : "0.0";

  const title = calculateTitle(player.gamesWon);

  return (
    <Dialog open={isOpen} onClose={onClose} size="md">
      <div className="space-y-6">
        <DialogTitle>Player Profile</DialogTitle>
        
        <div className="flex flex-col items-center space-y-4">
          {/* Player Avatar and Basic Info */}
          <div className="flex flex-col items-center space-y-2">
            <Avatar 
              src={player.photoURL} 
              initials={player.displayName.substring(0, 2).toUpperCase()}
              className="h-20 w-20"
            />
            
            <div className="text-center">
              <h3 className="text-lg font-semibold">{player.displayName}</h3>
              {player.username && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">@{player.username}</p>
              )}
            </div>
            
            <Badge color="blue" className="text-sm">
              {title}
            </Badge>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{player.rank}</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Rank</div>
            </div>
            
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{player.gamesWon}</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Wins</div>
            </div>
            
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{player.gamesPlayed}</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Games</div>
            </div>
            
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{player.totalPoints}</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Points</div>
            </div>
          </div>

          {/* Win/Loss Percentages */}
          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-xl font-bold text-green-600">{winPercentage}%</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Win Rate</div>
            </div>
            
            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-xl font-bold text-red-600">{lossRate}%</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Loss Rate</div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default PlayerProfileDialog;
