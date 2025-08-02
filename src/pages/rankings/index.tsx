import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  getAllLeaguesWithRankings,
  calculateTitle,
  RankingEntry as RankingEntryType,
  UserProfile,
  getUserProfile,
} from "../../firebase";
import { Timestamp } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import UserProfileModal, { useUserProfileModal } from "../../components/UserProfileModal";

// Use the RankingEntry type from firebase.ts
type RankingEntry = RankingEntryType;

// Helper function to convert RankingEntry to UserProfile
const convertRankingEntryToUserProfile = (entry: RankingEntry): UserProfile => {
  return {
    uid: entry.userId,
    displayName: entry.displayName,
    username: entry.username,
    email: "", // Not available in RankingEntry
    photoURL: entry.photoURL,
    createdAt: Timestamp.now(), // Placeholder timestamp
    stats: {
      gamesPlayed: entry.gamesPlayed,
      gamesWon: entry.gamesWon,
      totalPoints: entry.totalPoints,
      globalRank: entry.rank,
      // These properties are not available in RankingEntry, so we provide defaults
      winStreak: 0, // Not available in RankingEntry
      maxWinStreak: 0, // Not available in RankingEntry
    },
    hasSetUsername: !!entry.username,
  };
};

// League with rankings interface
interface LeagueWithRankings {
  id: string;
  name: string;
  description?: string;
  photoURL?: string;
  rankings: RankingEntry[];
}

// Extended RankingEntry type for table display
interface RankingTableRow extends RankingEntry {
  formattedTitle: string;
  positionDisplay: string;
  playerDisplay: React.ReactNode;
}

// Define columns for the rankings table
const createRankingColumns = (
  onPlayerClick: (player: RankingEntry) => void
): ColumnDef<RankingTableRow>[] => [
  {
    accessorKey: "positionDisplay",
    header: "Rank",
    cell: ({ row }) => (
      <div className="text-xs sm:text-sm font-bold text-center">
        #{row.getValue("positionDisplay")}
      </div>
    ),
  },
  {
    accessorKey: "playerDisplay",
    header: "Player",
    cell: ({ row }) => row.getValue("playerDisplay"),
  },
  {
    accessorKey: "gamesPlayed",
    header: "Games",
    cell: ({ row }) => (
      <div className="text-xs sm:text-sm text-center">{row.getValue("gamesPlayed")}</div>
    ),
  },
  {
    accessorKey: "gamesWon",
    header: "Wins",
    cell: ({ row }) => (
      <div className="text-xs sm:text-sm text-center">{row.getValue("gamesWon")}</div>
    ),
  },
  {
    accessorKey: "winPercentage",
    header: "Win %",
    cell: ({ row }) => {
      const entry = row.original;
      const winPercentage = entry.gamesPlayed > 0 
        ? ((entry.gamesWon / entry.gamesPlayed) * 100).toFixed(1)
        : "0.0";
      return (
        <div className="text-xs sm:text-sm text-center font-medium">
          {winPercentage}%
        </div>
      );
    },
  },
  {
    accessorKey: "totalPoints",
    header: "Points",
    cell: ({ row }) => (
      <div className="text-xs sm:text-sm text-center font-mono">
        {row.getValue("totalPoints")}
      </div>
    ),
  },
  // {
  //   accessorKey: "formattedTitle",
  //   header: "Title",
  //   cell: ({ row }) => (
  //     <div className="text-xs sm:text-sm font-medium text-center">
  //       {row.getValue("formattedTitle")}
  //     </div>
  //   ),
  // },
];

// Memoized Loading Component
const LoadingState = memo(() => (
  <div className="p-2 sm:p-4 lg:p-6 w-full lg:max-w-6xl lg:mx-auto">
    <h1 className="sr-only">Rankings</h1>
    <Card>
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">Rankings</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </CardContent>
    </Card>
  </div>
));

// Memoized No Data State
const NoDataState = memo(() => (
  <Card>
    <CardContent className="text-center pt-6">
      <p className="mb-4">No leagues or ranking data available.</p>
    </CardContent>
  </Card>
));

// League Rankings Table Component
const LeagueRankingsTable: React.FC<{
  league: LeagueWithRankings;
  onPlayerClick: (player: RankingEntry) => void;
}> = memo(({ league, onPlayerClick }) => {
  // Table states
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // Helper function to create player display with avatar
  const createPlayerDisplay = useCallback((entry: RankingEntry) => {
    return (
      <div className="font-medium text-xs sm:text-sm flex items-center space-x-2">
        <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
          <AvatarImage src={entry.photoURL || undefined} alt={entry.displayName} />
          <AvatarFallback className="text-xs">
            {entry.displayName.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="truncate max-w-20 sm:max-w-none" title={entry.displayName}>
          {entry.displayName}
        </div>
      </div>
    );
  }, []);

  // Transform rankings data for table display
  const tableData = useMemo(() => {
    return league.rankings.map((entry, index): RankingTableRow => ({
      ...entry,
      formattedTitle: calculateTitle(entry.gamesWon),
      positionDisplay: (index + 1).toString(),
      playerDisplay: createPlayerDisplay(entry),
    }));
  }, [league.rankings, createPlayerDisplay]);

  // Create columns with click handler
  const columns = useMemo(() => 
    createRankingColumns(onPlayerClick), 
    [onPlayerClick]
  );

  // Configure table
  const table = useReactTable({
    data: tableData,
    columns,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      columnFilters,
    },
  });

  if (league.rankings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            {league.photoURL && (
              <Avatar className="h-8 w-8">
                <AvatarImage src={league.photoURL} alt={league.name} />
                <AvatarFallback>
                  {league.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <span>{league.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-zinc-600 dark:text-zinc-400">
            No rankings available for this league yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-3">
          {league.photoURL && (
            <Avatar className="h-8 w-8">
              <AvatarImage src={league.photoURL} alt={league.name} />
              <AvatarFallback>
                {league.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <span>{league.name}</span>
        </CardTitle>
        {league.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {league.description}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="w-full">
          {/* Table */}
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-pointer"
                      onClick={() => onPlayerClick(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No rankings found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-end space-x-2 py-4">
              <div className="text-muted-foreground flex-1 text-sm">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </div>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

const Rankings: React.FC = () => {
  const [leagues, setLeagues] = useState<LeagueWithRankings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use the user profile modal hook
  const { isOpen: isProfileModalOpen, selectedUser, openModal: openProfileModal, closeModal: closeProfileModal } = useUserProfileModal();

  const fetchLeaguesWithRankings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const leaguesData = await getAllLeaguesWithRankings();
      setLeagues(leaguesData);
    } catch (error) {
      console.error("Error fetching leagues with rankings:", error);
      setError("Failed to load leagues and rankings data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaguesWithRankings();
  }, [fetchLeaguesWithRankings]);

  // Handle player click - simplified with new modal hook
  const handlePlayerClick = useCallback(async (player: RankingEntry) => {
    try {
      // Get the complete user profile to include all stats (winStreak, maxWinStreak, etc.)
      const fullUserProfile = await getUserProfile(player.userId);
      
      if (fullUserProfile) {
        openProfileModal(fullUserProfile);
      } else {
        // Fallback to converted profile if getUserProfile fails
        const userProfile = convertRankingEntryToUserProfile(player);
        openProfileModal(userProfile);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      // Fallback to converted profile on error
      const userProfile = convertRankingEntryToUserProfile(player);
      openProfileModal(userProfile);
    }
  }, [openProfileModal]);

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="p-2 sm:p-4 lg:p-6 w-full lg:max-w-6xl lg:mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
        <h1 className="text-xl sm:text-2xl font-bold">League Rankings</h1>
        <button
          onClick={fetchLeaguesWithRankings}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Refresh Rankings
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md flex justify-between items-center">
          <div>{error}</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setError(null)}
            className="ml-4 text-red-700 hover:text-red-800"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Leagues with Rankings */}
      {leagues.length === 0 ? (
        <NoDataState />
      ) : (
        <div className="space-y-8">
          {leagues.map((league) => (
            <LeagueRankingsTable
              key={league.id}
              league={league}
              onPlayerClick={handlePlayerClick}
            />
          ))}
        </div>
      )}

      {/* User Profile Modal */}
      <UserProfileModal
        user={selectedUser}
        isOpen={isProfileModalOpen}
        onClose={closeProfileModal}
        customStats={selectedUser ? {
          gamesPlayed: selectedUser.stats.gamesPlayed,
          gamesWon: selectedUser.stats.gamesWon,
          totalPoints: selectedUser.stats.totalPoints,
          rank: selectedUser.stats.globalRank,
          winRate: selectedUser.stats.gamesPlayed > 0 
            ? (selectedUser.stats.gamesWon / selectedUser.stats.gamesPlayed) * 100 
            : 0
        } : undefined}
      />
    </div>
  );
};

// Memoize the entire component for better performance
const MemoizedRankings = memo(Rankings);

export default MemoizedRankings;
