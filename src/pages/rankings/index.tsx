import React, { useState, useEffect, useCallback } from "react";
import { getFirestore, collection, query, getDocs, where } from "firebase/firestore";
import { auth, calculateTitle, getRankingsByTimePeriod, RankingEntry as RankingEntryType } from "../../firebase";

// Use the RankingEntry type from firebase.ts
type RankingEntry = RankingEntryType;

interface RankingFilter {
  leagueId: string | null;
  timeFrame: "all" | "month" | "week";
  gameMode: "all" | "individual" | "teams";
}

const Rankings: React.FC = () => {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RankingFilter>({
    leagueId: null,
    timeFrame: "all",
    gameMode: "all",
  });
  
  const [leagues, setLeagues] = useState<{ id: string; name: string }[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<RankingEntry | null>(null);

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use the getRankingsByTimePeriod function to get properly filtered data
      const rankingData = await getRankingsByTimePeriod(filter.timeFrame);
      
      // Further filter by game mode if specified
      let filteredRankings = rankingData;
      
      if (filter.gameMode !== 'all') {
        // Filter games by mode
        // This requires looking at each player's game history
        const db = getFirestore();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        // Get game data for filtering by mode
        const gamesQuery = query(
          collection(db, "games"),
          where("status", "==", "completed"),
          where("gameMode", "==", filter.gameMode)
        );
        
        const gamesSnapshot = await getDocs(gamesQuery);
        const gamesByMode = new Set<string>();
        
        gamesSnapshot.forEach(doc => {
          const game = doc.data() as {createdBy: string; opponent: string};
          gamesByMode.add(game.createdBy);
          gamesByMode.add(game.opponent);
        });
        
        // Only include players who have played games in this mode
        filteredRankings = filteredRankings.filter(player => 
          gamesByMode.has(player.userId)
        );
      }
      
      // Filter by league if specified
      if (filter.leagueId) {
        // Get players from the specified league's memberships
        const db = getFirestore();
        const memberQuery = query(
          collection(db, "leagueMemberships"),
          where("leagueId", "==", filter.leagueId),
          where("status", "==", "active")
        );
        
        const memberSnap = await getDocs(memberQuery);
        const leagueUserIds: string[] = [];
        
        memberSnap.forEach(doc => {
          leagueUserIds.push(doc.data().userId);
        });
        
        // Only include players who are members of this league
        filteredRankings = filteredRankings.filter(player => 
          leagueUserIds.includes(player.userId)
        );
      }
      
      setRankings(filteredRankings);
    } catch (err) {
      console.error("Error fetching rankings:", err);
      setError("Failed to load rankings data");
    } finally {
      setLoading(false);
    }
  }, [filter]);

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
          where("status", "in", ["active", "completed"])
        );
        
        const leaguesSnap = await getDocs(leaguesQuery);
        const leaguesList: { id: string; name: string }[] = [];
        
        leaguesSnap.forEach(doc => {
          leaguesList.push({
            id: doc.id,
            name: doc.data().name
          });
        });
        
        setLeagues(leaguesList);
      } catch (err) {
        console.error("Error fetching leagues:", err);
      }
    };
    
    fetchLeagues();
  }, []);

  const handleFilterChange = (
    filterKey: keyof RankingFilter, 
    value: string | null | 'all' | 'month' | 'week' | 'individual' | 'teams'
  ) => {
    setFilter(prev => ({
      ...prev,
      [filterKey]: value
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

  // Find the current user in the rankings
  const currentUserRanking = rankings.find(
    player => player.userId === auth.currentUser?.uid
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            Player Rankings
          </h1>
          {filter.leagueId && (
            <div className="text-lg text-gray-600 dark:text-gray-400 mt-1">
              {leagues.find(league => league.id === filter.leagueId)?.name || 'League Rankings'}
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
              League: {leagues.find(league => league.id === filter.leagueId)?.name}
              <button 
                onClick={() => handleFilterChange("leagueId", null)} 
                className="ml-2 text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
              >
                ×
              </button>
            </span>
          )}
          {filter.timeFrame !== 'all' && (
            <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm px-3 py-1 rounded-full flex items-center">
              Time: {filter.timeFrame === 'week' ? 'Past Week' : 'Past Month'}
              <button 
                onClick={() => handleFilterChange("timeFrame", "all")} 
                className="ml-2 text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100"
              >
                ×
              </button>
            </span>
          )}
          {filter.gameMode !== 'all' && (
            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-sm px-3 py-1 rounded-full flex items-center">
              Mode: {filter.gameMode === 'teams' ? 'Teams' : 'Individual'}
              <button 
                onClick={() => handleFilterChange("gameMode", "all")} 
                className="ml-2 text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100"
              >
                ×
              </button>
            </span>
          )}
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* League Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">League</label>
            <select
              value={filter.leagueId || "global"}
              onChange={(e) => handleFilterChange("leagueId", e.target.value === "global" ? null : e.target.value)}
              className={`w-full p-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-zinc-600 ${
                filter.leagueId ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-300 dark:bg-zinc-700'
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
          
          {/* Time Frame Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">Time Frame</label>
            <select
              value={filter.timeFrame}
              onChange={(e) => handleFilterChange("timeFrame", e.target.value)}
              className={`w-full p-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-zinc-600 ${
                filter.timeFrame !== 'all' ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-gray-300 dark:bg-zinc-700'
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
                filter.gameMode !== 'all' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' : 'border-gray-300 dark:bg-zinc-700'
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
      {(filter.leagueId !== null || filter.timeFrame !== 'all' || filter.gameMode !== 'all') && (
        <div className="bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Current View</h2>
            <button 
              onClick={() => {
                setFilter({
                  leagueId: null,
                  timeFrame: 'all',
                  gameMode: 'all'
                });
              }}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            >
              Clear All Filters
            </button>
          </div>
          
          <div className="mt-2 text-gray-700 dark:text-gray-300">
            {filter.timeFrame !== 'all' && (
              <span className="font-medium">{filter.timeFrame === 'week' ? 'Past Week' : 'Past Month'}</span>
            )}
            {filter.gameMode !== 'all' && (
              <span>{filter.timeFrame !== 'all' ? ' • ' : ''}<span className="font-medium">{filter.gameMode === 'teams' ? 'Teams Mode' : 'Individual Mode'}</span></span>
            )}
            {filter.leagueId && (
              <span>{(filter.timeFrame !== 'all' || filter.gameMode !== 'all') ? ' • ' : ''}<span className="font-medium">{leagues.find(league => league.id === filter.leagueId)?.name || 'League'}</span></span>
            )}
          </div>
        </div>
      )}

      {/* Current User's Ranking */}
      {currentUserRanking && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">
            Your Ranking
          </h2>
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-4">
              <div className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">
                {currentUserRanking.rank}
              </div>
            </div>
            <div className="flex-grow grid grid-cols-1 md:grid-cols-5 gap-2">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Player</p>
                <p className="font-medium">{currentUserRanking.displayName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Title</p>
                <p className="font-medium">{calculateTitle(currentUserRanking.gamesWon)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Games Won</p>
                <p className="font-medium">{currentUserRanking.gamesWon}/{currentUserRanking.gamesPlayed}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
                <p className="font-medium">{currentUserRanking.winRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Points</p>
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
            {filter.leagueId ? 
              `No players found in ${leagues.find(league => league.id === filter.leagueId)?.name || 'this league'}.` : 
              filter.gameMode !== 'all' ? 
                `No players have played games in ${filter.gameMode} mode.` : 
                "No ranking data available"
            }
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
              <thead className="bg-gray-50 dark:bg-zinc-700">
                {/* Table filter label */}
                {(filter.leagueId !== null || filter.timeFrame !== 'all' || filter.gameMode !== 'all') && (
                  <tr>
                    <th colSpan={6} className="px-6 py-2 text-sm text-gray-600 dark:text-gray-400">
                      Showing rankings for: 
                      {filter.timeFrame !== 'all' && (
                        <span className="ml-1 font-medium">{filter.timeFrame === 'week' ? 'Past Week' : 'Past Month'}</span>
                      )}
                      {filter.gameMode !== 'all' && (
                        <span>{filter.timeFrame !== 'all' ? ' • ' : ' '}<span className="font-medium">{filter.gameMode === 'teams' ? 'Teams Mode' : 'Individual Mode'}</span></span>
                      )}
                      {filter.leagueId && (
                        <span>{(filter.timeFrame !== 'all' || filter.gameMode !== 'all') ? ' • ' : ' '}<span className="font-medium">{leagues.find(league => league.id === filter.leagueId)?.name || 'League'}</span></span>
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
                    Total Points
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-zinc-700">
                {rankings.map((player) => (
                  <tr 
                    key={player.userId} 
                    className={`hover:bg-gray-50 dark:hover:bg-zinc-700 cursor-pointer ${
                      player.userId === auth.currentUser?.uid ? "bg-blue-50 dark:bg-blue-900/10" : ""
                    }`}
                    onClick={() => openPlayerDetails(player)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                        player.rank <= 3 
                          ? "bg-yellow-400 text-white" 
                          : "bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-white"
                      }`}>
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
                          <div className="font-medium">{player.displayName}</div>
                          {player.username && player.username !== player.displayName && (
                            <div className="text-sm text-gray-500">@{player.username}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        player.gamesWon >= 25 ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200" :
                        player.gamesWon >= 15 ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200" :
                        player.gamesWon >= 8 ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200" :
                        "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                      }`}>
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
              <h2 className="text-2xl font-bold">{selectedPlayer.displayName}</h2>
              <button
                onClick={closePlayerDetails}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                <p className="text-xl font-bold">{selectedPlayer.displayName}</p>
                {selectedPlayer.username && selectedPlayer.username !== selectedPlayer.displayName && (
                  <p className="text-gray-500">@{selectedPlayer.username}</p>
                )}
                <p className="mt-1 text-sm">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    selectedPlayer.gamesWon >= 25 ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200" :
                    selectedPlayer.gamesWon >= 15 ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200" :
                    selectedPlayer.gamesWon >= 8 ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200" :
                    "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                  }`}>
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
                <p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
                <p className="text-2xl font-bold">{selectedPlayer.winRate.toFixed(1)}%</p>
              </div>
              <div className="bg-gray-100 dark:bg-zinc-700 p-4 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Games Played</p>
                <p className="text-2xl font-bold">{selectedPlayer.gamesPlayed}</p>
              </div>
              <div className="bg-gray-100 dark:bg-zinc-700 p-4 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Games Won</p>
                <p className="text-2xl font-bold">{selectedPlayer.gamesWon}</p>
              </div>
            </div>
            
            <div className="bg-gray-100 dark:bg-zinc-700 p-4 rounded-lg mb-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Points</p>
              <p className="text-2xl font-bold">{selectedPlayer.totalPoints}</p>
            </div>
            
            {/* Future: Add match history, leagues, etc. */}
            <p className="text-gray-500 text-sm">
              League support and detailed player statistics coming soon.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rankings;