import React, { useState, useEffect, useCallback } from "react";
import {
  getFirestore,
  collection,
  query,
  getDocs,
  where,
} from "firebase/firestore";
import {
  auth,
  calculateTitle,
  getRankingsByTimePeriod,
  RankingEntry as RankingEntryType,
  getAllSeasons,
  getCurrentSeason,
  getDefaultSeason,
} from "../../firebase";
import { Season } from "../../models/league";

// Use the RankingEntry type from firebase.ts
type RankingEntry = RankingEntryType;

interface RankingFilter {
  leagueId: string | null;
  timeFrame: "all" | "month" | "week";
  gameMode: "all" | "individual" | "teams";
  seasonId: string | null;
}

const Rankings: React.FC = () => {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RankingFilter>({
    leagueId: null,
    timeFrame: "all",
    gameMode: "all",
    seasonId: null,
  });

  const [leagues, setLeagues] = useState<{ id: string; name: string }[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<RankingEntry | null>(
    null,
  );

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let filteredRankings: RankingEntry[] = [];

      if (filter.leagueId) {
        // League-specific rankings - calculate from league games only
        const db = getFirestore();
        
        // Get all members of the league first
        const memberQuery = query(
          collection(db, "leagueMemberships"),
          where("leagueId", "==", filter.leagueId),
          where("status", "==", "active"),
        );

        const memberSnap = await getDocs(memberQuery);
        const leagueUserIds: string[] = [];
        memberSnap.forEach((doc) => {
          leagueUserIds.push(doc.data().userId);
        });

        if (leagueUserIds.length === 0) {
          setRankings([]);
          return;
        }

        // Get league games (games with leagueId)
        let gamesQuery = query(
          collection(db, "games"),
          where("leagueId", "==", filter.leagueId),
          where("status", "==", "completed")
        );

        // Build filter conditions array
        const conditions = [
          where("leagueId", "==", filter.leagueId),
          where("status", "==", "completed")
        ];

        // Add game mode filter if specified
        if (filter.gameMode !== "all") {
          conditions.push(where("settings.gameMode", "==", filter.gameMode));
        }

        // Add season filter if specified
        if (filter.seasonId) {
          const selectedSeason = seasons.find(s => s.id === filter.seasonId);
          if (selectedSeason) {
            conditions.push(where("updatedAt", ">=", selectedSeason.startDate));
            conditions.push(where("updatedAt", "<=", selectedSeason.endDate));
          }
        } else if (filter.timeFrame !== "all") {
          // Add time filter if no season is selected
          const timeLimit = new Date();
          if (filter.timeFrame === "week") {
            timeLimit.setDate(timeLimit.getDate() - 7);
          } else if (filter.timeFrame === "month") {
            timeLimit.setMonth(timeLimit.getMonth() - 1);
          }
          conditions.push(where("updatedAt", ">=", timeLimit));
        }

        // Apply all conditions to the query
        gamesQuery = query(collection(db, "games"), ...conditions);

        const gamesSnapshot = await getDocs(gamesQuery);
        
        // Calculate league-specific statistics
        const playerStats: Record<string, {
          gamesPlayed: number;
          gamesWon: number;
          totalPoints: number;
          userId: string;
        }> = {};

        // Initialize stats for all league members
        leagueUserIds.forEach(userId => {
          playerStats[userId] = {
            gamesPlayed: 0,
            gamesWon: 0,
            totalPoints: 0,
            userId
          };
        });

        // Process games to calculate stats
        gamesSnapshot.forEach((doc) => {
          const game = doc.data() as {
            createdBy: string;
            opponent: string;
            winner?: string;
            scores?: { creator: number; opponent: number };
          };

          // Only count if both players are league members
          if (leagueUserIds.includes(game.createdBy) && leagueUserIds.includes(game.opponent)) {
            // Update games played
            playerStats[game.createdBy].gamesPlayed++;
            playerStats[game.opponent].gamesPlayed++;

            // Update wins and points based on winner
            if (game.winner === game.createdBy) {
              playerStats[game.createdBy].gamesWon++;
              playerStats[game.createdBy].totalPoints += 3; // Points for win
              playerStats[game.opponent].totalPoints += 0; // Points for loss
            } else if (game.winner === game.opponent) {
              playerStats[game.opponent].gamesWon++;
              playerStats[game.opponent].totalPoints += 3; // Points for win
              playerStats[game.createdBy].totalPoints += 0; // Points for loss
            } else {
              // Draw or no winner - give 1 point each
              playerStats[game.createdBy].totalPoints += 1;
              playerStats[game.opponent].totalPoints += 1;
            }
          }
        });

        // Get user display names
        const userPromises = leagueUserIds.map(async (userId) => {
          try {
            const userDoc = await getDocs(query(
              collection(db, "users"),
              where("__name__", "==", userId)
            ));
            
            if (!userDoc.empty) {
              const userData = userDoc.docs[0].data();
              return {
                userId,
                displayName: userData.displayName || userData.username || userId,
                username: userData.username,
                photoURL: userData.photoURL
              };
            }
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error);
          }
          return {
            userId,
            displayName: userId,
            username: userId,
            photoURL: undefined
          };
        });

        const userDetails = await Promise.all(userPromises);
        const userMap = new Map(userDetails.map(user => [user.userId, user]));

        // Convert to ranking entries and sort
        filteredRankings = Object.values(playerStats)
          .filter(stats => stats.gamesPlayed > 0 || leagueUserIds.includes(stats.userId)) // Include all league members
          .map(stats => {
            const userDetail = userMap.get(stats.userId);
            return {
              userId: stats.userId,
              displayName: userDetail?.displayName || stats.userId,
              username: userDetail?.username || stats.userId,
              photoURL: userDetail?.photoURL,
              gamesPlayed: stats.gamesPlayed,
              gamesWon: stats.gamesWon,
              totalPoints: stats.totalPoints,
              winRate: stats.gamesPlayed > 0 ? (stats.gamesWon / stats.gamesPlayed) * 100 : 0,
              rank: 0 // Will be set after sorting
            } as RankingEntry;
          })
          .sort((a, b) => {
            // Sort by total points first, then by win rate, then by games won
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            if (b.winRate !== a.winRate) return b.winRate - a.winRate;
            return b.gamesWon - a.gamesWon;
          })
          .map((player, index) => ({
            ...player,
            rank: index + 1
          }));

      } else {
        // Global rankings - handle season filtering or time period
        let timeFrame = filter.timeFrame;
        
        // If season is selected, override time frame filtering
        if (filter.seasonId) {
          // For global rankings with season, we need to fetch games within season dates
          const selectedSeason = seasons.find(s => s.id === filter.seasonId);
          if (selectedSeason) {
            const db = getFirestore();
            
            // Build conditions for global games within season
            const conditions = [
              where("status", "==", "completed"),
              where("updatedAt", ">=", selectedSeason.startDate),
              where("updatedAt", "<=", selectedSeason.endDate)
            ];

            // Add game mode filter if specified
            if (filter.gameMode !== "all") {
              conditions.push(where("settings.gameMode", "==", filter.gameMode));
            }

            const gamesQuery = query(collection(db, "games"), ...conditions);
            const gamesSnapshot = await getDocs(gamesQuery);

            // Calculate rankings from season games
            const playerStats: Record<string, {
              gamesPlayed: number;
              gamesWon: number;
              totalPoints: number;
              userId: string;
            }> = {};

            // Process games to calculate stats
            gamesSnapshot.forEach((doc) => {
              const game = doc.data() as {
                createdBy: string;
                opponent: string;
                winner?: string;
                scores?: { creator: number; opponent: number };
              };

              // Initialize player stats if not exists
              if (!playerStats[game.createdBy]) {
                playerStats[game.createdBy] = {
                  gamesPlayed: 0,
                  gamesWon: 0,
                  totalPoints: 0,
                  userId: game.createdBy
                };
              }
              if (!playerStats[game.opponent]) {
                playerStats[game.opponent] = {
                  gamesPlayed: 0,
                  gamesWon: 0,
                  totalPoints: 0,
                  userId: game.opponent
                };
              }

              // Update games played
              playerStats[game.createdBy].gamesPlayed++;
              playerStats[game.opponent].gamesPlayed++;

              // Update wins and points based on winner
              if (game.winner === game.createdBy) {
                playerStats[game.createdBy].gamesWon++;
                playerStats[game.createdBy].totalPoints += 3; // Points for win
                playerStats[game.opponent].totalPoints += 0; // Points for loss
              } else if (game.winner === game.opponent) {
                playerStats[game.opponent].gamesWon++;
                playerStats[game.opponent].totalPoints += 3; // Points for win
                playerStats[game.createdBy].totalPoints += 0; // Points for loss
              } else {
                // Draw or no winner - give 1 point each
                playerStats[game.createdBy].totalPoints += 1;
                playerStats[game.opponent].totalPoints += 1;
              }
            });

            // Get user display names for global players
            const userIds = Object.keys(playerStats);
            const userPromises = userIds.map(async (userId) => {
              try {
                const userDoc = await getDocs(query(
                  collection(db, "users"),
                  where("__name__", "==", userId)
                ));
                
                if (!userDoc.empty) {
                  const userData = userDoc.docs[0].data();
                  return {
                    userId,
                    displayName: userData.displayName || userData.username || userId,
                    username: userData.username,
                    photoURL: userData.photoURL
                  };
                }
              } catch (error) {
                console.error(`Error fetching user ${userId}:`, error);
              }
              return {
                userId,
                displayName: userId,
                username: userId,
                photoURL: undefined
              };
            });

            const userDetails = await Promise.all(userPromises);
            const userMap = new Map(userDetails.map(user => [user.userId, user]));

            // Convert to ranking entries and sort
            filteredRankings = Object.values(playerStats)
              .filter(stats => stats.gamesPlayed > 0)
              .map(stats => {
                const userDetail = userMap.get(stats.userId);
                return {
                  userId: stats.userId,
                  displayName: userDetail?.displayName || stats.userId,
                  username: userDetail?.username || stats.userId,
                  photoURL: userDetail?.photoURL,
                  gamesPlayed: stats.gamesPlayed,
                  gamesWon: stats.gamesWon,
                  totalPoints: stats.totalPoints,
                  winRate: stats.gamesPlayed > 0 ? (stats.gamesWon / stats.gamesPlayed) * 100 : 0,
                  rank: 0 // Will be set after sorting
                } as RankingEntry;
              })
              .sort((a, b) => {
                // Sort by total points first, then by win rate, then by games won
                if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
                if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                return b.gamesWon - a.gamesWon;
              })
              .map((player, index) => ({
                ...player,
                rank: index + 1
              }));
          } else {
            // Season not found, use all time
            filteredRankings = await getRankingsByTimePeriod("all");
          }
        } else {
          // No season selected, use time frame
          const rankingData = await getRankingsByTimePeriod(timeFrame);
          filteredRankings = rankingData;
        }

        // Further filter by game mode if specified and not already filtered by season
        if (filter.gameMode !== "all" && !filter.seasonId) {
          // Filter games by mode
          const db = getFirestore();

          // Get game data for filtering by mode
          const gamesQuery = query(
            collection(db, "games"),
            where("status", "==", "completed"),
            where("settings.gameMode", "==", filter.gameMode),
          );

          const gamesSnapshot = await getDocs(gamesQuery);
          const gamesByMode = new Set<string>();

          gamesSnapshot.forEach((doc) => {
            const game = doc.data() as { createdBy: string; opponent: string };
            gamesByMode.add(game.createdBy);
            gamesByMode.add(game.opponent);
          });

          // Only include players who have played games in this mode
          filteredRankings = filteredRankings.filter((player) =>
            gamesByMode.has(player.userId),
          );
        }
      }

      setRankings(filteredRankings);
    } catch (err) {
      console.error("Error fetching rankings:", err);
      setError("Failed to load rankings data");
    } finally {
      setLoading(false);
    }
  }, [filter, seasons]); // Add seasons dependency to re-fetch when seasons load

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  useEffect(() => {
    // Fetch available leagues
    const fetchLeagues = async () => {
      try {
        const db = getFirestore();
        const leaguesQuery = query(
          collection(db, "leagues"),
          where("status", "in", ["active", "completed"]),
        );

        const leaguesSnap = await getDocs(leaguesQuery);
        const leaguesList: { id: string; name: string }[] = [];

        leaguesSnap.forEach((doc) => {
          leaguesList.push({
            id: doc.id,
            name: doc.data().name,
          });
        });

        setLeagues(leaguesList);
      } catch (err) {
        console.error("Error fetching leagues:", err);
      }
    };

    const fetchSeasons = async () => {
      try {
        // Load seasons based on current league filter
        const seasonsList = await getAllSeasons(filter.leagueId || undefined);
        setSeasons(seasonsList);
        
        // Only auto-select season if there are seasons and user hasn't manually selected one
        // Don't auto-select to allow viewing all-time rankings by default
      } catch (err) {
        console.error("Error fetching seasons:", err);
      }
    };

    fetchLeagues();
    fetchSeasons();
  }, [filter.leagueId]); // Re-fetch seasons when league changes

  const handleFilterChange = (
    filterKey: keyof RankingFilter,
    value: string | null | "all" | "month" | "week" | "individual" | "teams",
  ) => {
    setFilter((prev) => ({
      ...prev,
      [filterKey]: value,
    }));

    // Reset to first page and refresh data when filters change
    setLoading(true);
  };

  const openPlayerDetails = (player: RankingEntry) => {
    setSelectedPlayer(player);
  };

  const closePlayerDetails = () => {
    setSelectedPlayer(null);
  };

  // Find the current user in the rankings (only if logged in)
  const currentUserRanking = auth.currentUser 
    ? rankings.find((player) => player.userId === auth.currentUser?.uid)
    : null;

  return (
    <div className="p-6 max-w-6xl mx-auto text-white">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Player Rankings</h1>
          {filter.leagueId && (
            <div className="text-lg text-gray-600 dark:text-gray-400 mt-1">
              {leagues.find((league) => league.id === filter.leagueId)?.name || "League Rankings"} - Liga Específica
            </div>
          )}
          {!filter.leagueId && (
            <div className="text-lg text-gray-600 dark:text-gray-400 mt-1">
              Rankings Globales
            </div>
          )}
        </div>
        <button
          onClick={fetchRankings}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Refresh Rankings
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        <div className="px-6 pt-6 pb-2 flex flex-wrap gap-2">
          {filter.leagueId && (
            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm px-3 py-1 rounded-full flex items-center">
              League:{" "}
              {leagues.find((league) => league.id === filter.leagueId)?.name}
              <button
                onClick={() => handleFilterChange("leagueId", null)}
                className="ml-2 text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
              >
                ×
              </button>
            </span>
          )}
          {filter.seasonId && (
            <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 text-sm px-3 py-1 rounded-full flex items-center">
              Season:{" "}
              {seasons.find((season) => season.id === filter.seasonId)?.name}
              <button
                onClick={() => handleFilterChange("seasonId", null)}
                className="ml-2 text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-orange-100"
              >
                ×
              </button>
            </span>
          )}
          {filter.timeFrame !== "all" && !filter.seasonId && (
            <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm px-3 py-1 rounded-full flex items-center">
              Time: {filter.timeFrame === "week" ? "Past Week" : "Past Month"}
              <button
                onClick={() => handleFilterChange("timeFrame", "all")}
                className="ml-2 text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100"
              >
                ×
              </button>
            </span>
          )}
          {filter.gameMode !== "all" && (
            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-sm px-3 py-1 rounded-full flex items-center">
              Mode: {filter.gameMode === "teams" ? "Teams" : "Individual"}
              <button
                onClick={() => handleFilterChange("gameMode", "all")}
                className="ml-2 text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100"
              >
                ×
              </button>
            </span>
          )}
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* League Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">League</label>
            <select
              value={filter.leagueId || "global"}
              onChange={(e) =>
                handleFilterChange(
                  "leagueId",
                  e.target.value === "global" ? null : e.target.value,
                )
              }
              className={`w-full p-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-zinc-600 ${
                filter.leagueId
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
                  : "border-gray-300 dark:bg-zinc-700"
              }`}
            >
              <option value="global">Global Ranking</option>
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>
          </div>

          {/* Season Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">Season</label>
            <select
              value={filter.seasonId || "all"}
              onChange={(e) =>
                handleFilterChange(
                  "seasonId",
                  e.target.value === "all" ? null : e.target.value,
                )
              }
              className={`w-full p-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-zinc-600 ${
                filter.seasonId
                  ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10"
                  : "border-gray-300 dark:bg-zinc-700"
              }`}
            >
              <option value="all">All Seasons</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name} {season.status === "active" ? "(Active)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Time Frame Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Time Frame {filter.seasonId ? "(Disabled)" : ""}
            </label>
            <select
              value={filter.timeFrame}
              onChange={(e) => handleFilterChange("timeFrame", e.target.value)}
              disabled={!!filter.seasonId}
              className={`w-full p-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-zinc-600 ${
                filter.seasonId 
                  ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-zinc-800"
                  : filter.timeFrame !== "all"
                    ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                    : "border-gray-300 dark:bg-zinc-700"
              }`}
            >
              <option value="all">All Time</option>
              <option value="month">Last Month</option>
              <option value="week">Last Week</option>
            </select>
          </div>

          {/* Game Mode Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">Game Mode</label>
            <select
              value={filter.gameMode}
              onChange={(e) => handleFilterChange("gameMode", e.target.value)}
              className={`w-full p-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-zinc-600 ${
                filter.gameMode !== "all"
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/10"
                  : "border-gray-300 dark:bg-zinc-700"
              }`}
            >
              <option value="all">All Modes</option>
              <option value="teams">Teams Mode</option>
              <option value="individual">Individual Mode</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Filters Summary */}
      {(filter.leagueId !== null ||
        filter.timeFrame !== "all" ||
        filter.gameMode !== "all" ||
        filter.seasonId !== null) && (
        <div className="bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Current View</h2>
            <button
              onClick={() => {
                setFilter({
                  leagueId: null,
                  timeFrame: "all",
                  gameMode: "all",
                  seasonId: null,
                });
              }}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            >
              Clear All Filters
            </button>
          </div>

          <div className="mt-2 text-gray-700 dark:text-gray-300">
            {filter.seasonId && (
              <span className="font-medium">
                Season: {seasons.find((season) => season.id === filter.seasonId)?.name || "Selected Season"}
              </span>
            )}
            {filter.timeFrame !== "all" && !filter.seasonId && (
              <span className="font-medium">
                {filter.seasonId ? " • " : ""}
                {filter.timeFrame === "week" ? "Past Week" : "Past Month"}
              </span>
            )}
            {filter.gameMode !== "all" && (
              <span>
                {(filter.timeFrame !== "all" && !filter.seasonId) || filter.seasonId ? " • " : ""}
                <span className="font-medium">
                  {filter.gameMode === "teams"
                    ? "Teams Mode"
                    : "Individual Mode"}
                </span>
              </span>
            )}
            {filter.leagueId && (
              <span>
                {((filter.timeFrame !== "all" && !filter.seasonId) || filter.gameMode !== "all" || filter.seasonId)
                  ? " • "
                  : ""}
                <span className="font-medium">
                  {leagues.find((league) => league.id === filter.leagueId)
                    ?.name || "League"}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Current User's Ranking - Only show if user is logged in */}
      {auth.currentUser && currentUserRanking && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">
            {filter.leagueId 
              ? `Tu Ranking en ${leagues.find((league) => league.id === filter.leagueId)?.name || "Liga"}`
              : "Your Global Ranking"
            }
          </h2>
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-4">
              <div className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">
                {currentUserRanking.rank}
              </div>
            </div>
            <div className="flex-grow grid grid-cols-1 md:grid-cols-5 gap-2">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Player
                </p>
                <p className="font-medium">{currentUserRanking.displayName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Title
                </p>
                <p className="font-medium">
                  {calculateTitle(currentUserRanking.gamesWon)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Games Won
                </p>
                <p className="font-medium">
                  {currentUserRanking.gamesWon}/{currentUserRanking.gamesPlayed}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Win Rate
                </p>
                <p className="font-medium">
                  {currentUserRanking.winRate.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {filter.leagueId ? "Puntos Liga" : "Total Points"}
                </p>
                <p className="font-medium">{currentUserRanking.totalPoints}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rankings Table */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading rankings...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : rankings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {filter.leagueId
              ? `No players found in ${leagues.find((league) => league.id === filter.leagueId)?.name || "this league"}.`
              : filter.gameMode !== "all"
                ? `No players have played games in ${filter.gameMode} mode.`
                : "No ranking data available"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
              <thead className="bg-gray-50 dark:bg-zinc-700">
                {/* Table filter label */}
                {(filter.leagueId !== null ||
                  filter.timeFrame !== "all" ||
                  filter.gameMode !== "all") && (
                  <tr>
                    <th
                      colSpan={6}
                      className="px-6 py-2 text-sm text-gray-600 dark:text-gray-400"
                    >
                      Showing rankings for:
                      {filter.timeFrame !== "all" && (
                        <span className="ml-1 font-medium">
                          {filter.timeFrame === "week"
                            ? "Past Week"
                            : "Past Month"}
                        </span>
                      )}
                      {filter.gameMode !== "all" && (
                        <span>
                          {filter.timeFrame !== "all" ? " • " : " "}
                          <span className="font-medium">
                            {filter.gameMode === "teams"
                              ? "Teams Mode"
                              : "Individual Mode"}
                          </span>
                        </span>
                      )}
                      {filter.leagueId && (
                        <span>
                          {filter.timeFrame !== "all" ||
                          filter.gameMode !== "all"
                            ? " • "
                            : " "}
                          <span className="font-medium">
                            {leagues.find(
                              (league) => league.id === filter.leagueId,
                            )?.name || "League"}
                          </span>
                        </span>
                      )}
                    </th>
                  </tr>
                )}
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                    Player
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                    Games Won
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                    Win Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                    {filter.leagueId ? "Puntos Liga" : "Total Points"}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-zinc-700">
                {rankings.map((player) => (
                  <tr
                    key={player.userId}
                    className={`hover:bg-gray-50 dark:hover:bg-zinc-700 cursor-pointer ${
                      auth.currentUser && player.userId === auth.currentUser?.uid
                        ? "bg-blue-50 dark:bg-blue-900/10"
                        : ""
                    }`}
                    onClick={() => openPlayerDetails(player)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          player.rank <= 3
                            ? "bg-yellow-400 text-white"
                            : "bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-white"
                        }`}
                      >
                        {player.rank}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {player.photoURL ? (
                          <img
                            src={player.photoURL}
                            alt={player.displayName}
                            className="w-10 h-10 rounded-full mr-3"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3">
                            {player.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium">
                            {player.displayName}
                          </div>
                          {player.username &&
                            player.username !== player.displayName && (
                              <div className="text-sm text-gray-500">
                                @{player.username}
                              </div>
                            )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          player.gamesWon >= 25
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200"
                            : player.gamesWon >= 15
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
                              : player.gamesWon >= 8
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {calculateTitle(player.gamesWon)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {player.gamesWon}/{player.gamesPlayed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {player.winRate.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {player.totalPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Player Details Modal (for future expansion) */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-lg p-6 mx-4">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">
                {selectedPlayer.displayName}
              </h2>
              <button
                onClick={closePlayerDetails}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex items-center mb-6">
              {selectedPlayer.photoURL ? (
                <img
                  src={selectedPlayer.photoURL}
                  alt={selectedPlayer.displayName}
                  className="w-16 h-16 rounded-full mr-4"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center mr-4">
                  {selectedPlayer.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-xl font-bold">
                  {selectedPlayer.displayName}
                </p>
                {selectedPlayer.username &&
                  selectedPlayer.username !== selectedPlayer.displayName && (
                    <p className="text-gray-500">@{selectedPlayer.username}</p>
                  )}
                <p className="mt-1 text-sm">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      selectedPlayer.gamesWon >= 25
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200"
                        : selectedPlayer.gamesWon >= 15
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
                          : selectedPlayer.gamesWon >= 8
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {calculateTitle(selectedPlayer.gamesWon)}
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-100 dark:bg-zinc-700 p-4 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Rank</p>
                <p className="text-2xl font-bold">{selectedPlayer.rank}</p>
              </div>
              <div className="bg-gray-100 dark:bg-zinc-700 p-4 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Win Rate
                </p>
                <p className="text-2xl font-bold">
                  {selectedPlayer.winRate.toFixed(1)}%
                </p>
              </div>
              <div className="bg-gray-100 dark:bg-zinc-700 p-4 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Games Played
                </p>
                <p className="text-2xl font-bold">
                  {selectedPlayer.gamesPlayed}
                </p>
              </div>
              <div className="bg-gray-100 dark:bg-zinc-700 p-4 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Games Won
                </p>
                <p className="text-2xl font-bold">{selectedPlayer.gamesWon}</p>
              </div>
            </div>

            <div className="bg-gray-100 dark:bg-zinc-700 p-4 rounded-lg mb-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {filter.leagueId ? "Puntos Liga" : "Total Points"}
              </p>
              <p className="text-2xl font-bold">{selectedPlayer.totalPoints}</p>
            </div>

            {/* Future: Add match history, leagues, etc. */}
            <p className="text-gray-500 text-sm">
              {filter.leagueId 
                ? `League-specific statistics for ${leagues.find((league) => league.id === filter.leagueId)?.name || "this league"}.`
                : auth.currentUser 
                  ? "League support and detailed player statistics coming soon."
                  : "Sign in to view detailed statistics and join leagues."
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rankings;
