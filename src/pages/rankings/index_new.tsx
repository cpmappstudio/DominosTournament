import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  getFirestore,
  collection,
  query,
  getDocs,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import {
  auth,
  calculateTitle,
  getRankingsByTimePeriod,
  RankingEntry as RankingEntryType,
  getAllSeasons,
} from "../../firebase";
import { Season } from "../../models/league";
import CustomSelect from "../../components/custom-select";
import { useGameConfig } from "../../config/gameConfig";
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
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

// Use the RankingEntry type from firebase.ts
type RankingEntry = RankingEntryType;

interface RankingFilter {
  leagueId: string | null;
  timeFrame: string; // Changed to string to support years
  gameMode: string; // Now will use gameConfig values
  seasonId: string | null;
}

// Extended RankingEntry type for table display
interface RankingTableRow extends RankingEntry {
  formattedTitle: string;
  positionDisplay: string;
  playerDisplay: React.ReactNode; // For avatar + name or team avatars
}

// Generate year options for timeFrame
const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear; year >= currentYear - 10; year--) {
    years.push({
      value: year.toString(),
      label: year.toString()
    });
  }
  return [
    { value: "all", label: "All Time" },
    ...years
  ];
};

// Define columns for the rankings table
const createRankingColumns = (gameMode: string): ColumnDef<RankingTableRow>[] => [
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
    header: gameMode === "double" ? "Team" : "Player",
    cell: ({ row }) => row.getValue("playerDisplay"),
  },
  {
    accessorKey: "gamesPlayed",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-semibold hover:bg-transparent"
        >
          Games
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className="text-xs sm:text-sm text-center">{row.getValue("gamesPlayed")}</div>
    ),
  },
  {
    accessorKey: "gamesWon",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-semibold hover:bg-transparent"
        >
          Wins
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className="text-xs sm:text-sm text-center">{row.getValue("gamesWon")}</div>
    ),
  },
  {
    accessorKey: "winPercentage",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-semibold hover:bg-transparent"
        >
          Win %
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
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
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-semibold hover:bg-transparent"
        >
          Points
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className="text-xs sm:text-sm text-center font-mono">
        {row.getValue("totalPoints")}
      </div>
    ),
  },
  {
    accessorKey: "formattedTitle",
    header: "Title",
    cell: ({ row }) => (
      <div className="text-xs sm:text-sm font-medium text-center">
        {row.getValue("formattedTitle")}
      </div>
    ),
  },
];

// Memoized Loading Component
const LoadingState = memo(() => (
  <div className="p-6 max-w-6xl mx-auto dark:text-white">
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
      <p className="mb-4">No ranking data available for the selected filters.</p>
    </CardContent>
  </Card>
));

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

  // Game config hook
  const { config: gameConfig, loading: configLoading } = useGameConfig();

  // Table states
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // Helper function to create player display with avatar
  const createPlayerDisplay = useCallback((entry: RankingEntry) => {
    // For now, show individual player with avatar (teams will be handled in future iterations)
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

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let rankingData: RankingEntry[] = [];

      // For now, keep the original logic but adapt timeFrame
      const timeFrame = filter.timeFrame === "all" ? "all" : 
                       parseInt(filter.timeFrame) ? "all" : // If it's a year, use "all" for now
                       "all"; // Fallback to "all"

      if (filter.leagueId) {
        // Get league-specific rankings
        const db = getFirestore();
        const leagueDocRef = doc(db, "leagues", filter.leagueId);
        const leagueDoc = await getDoc(leagueDocRef);

        if (leagueDoc.exists()) {
          const leagueData = leagueDoc.data();
          rankingData = leagueData.rankings || [];
        }
      } else {
        // Get global rankings with time period filter
        rankingData = await getRankingsByTimePeriod(timeFrame as "all" | "month" | "week");
      }

      // Apply game mode filter if needed (for future team support)
      if (filter.gameMode !== "all") {
        // This will be implemented when team rankings are added
        // For now, all rankings are individual player rankings
      }

      setRankings(rankingData);
    } catch (error) {
      console.error("Error fetching rankings:", error);
      setError("Failed to load rankings data");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchLeagues = useCallback(async () => {
    try {
      const db = getFirestore();
      const leaguesQuery = query(collection(db, "leagues"));
      const leaguesSnapshot = await getDocs(leaguesQuery);
      const leaguesData = leaguesSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
      }));
      setLeagues(leaguesData);
    } catch (error) {
      console.error("Error fetching leagues:", error);
    }
  }, []);

  const fetchSeasons = useCallback(async () => {
    try {
      const seasonsData = await getAllSeasons();
      setSeasons(seasonsData);
    } catch (error) {
      console.error("Error fetching seasons:", error);
    }
  }, []);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  useEffect(() => {
    fetchLeagues();
    fetchSeasons();
  }, [fetchLeagues, fetchSeasons]);

  // Handle filter changes
  const handleFilterChange = useCallback((key: keyof RankingFilter, value: any) => {
    setFilter((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Transform rankings data for table display
  const tableData = useMemo(() => {
    return rankings.map((entry, index): RankingTableRow => ({
      ...entry,
      formattedTitle: calculateTitle(entry.gamesWon),
      positionDisplay: (index + 1).toString(),
      playerDisplay: createPlayerDisplay(entry),
    }));
  }, [rankings, createPlayerDisplay]);

  // Create columns with current game mode
  const columns = useMemo(() => 
    createRankingColumns(filter.gameMode), 
    [filter.gameMode]
  );

  // Configure table
  const table = useReactTable({
    data: tableData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  if (loading || configLoading) {
    return <LoadingState />;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto dark:text-white">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
        <h1 className="text-xl sm:text-2xl font-bold">Rankings</h1>
        <button
          onClick={fetchRankings}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Refresh Rankings
        </button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* League Filter */}
            <CustomSelect
              id="league-filter"
              name="league"
              label="League"
              value={filter.leagueId || "all"}
              onChange={(value) =>
                handleFilterChange("leagueId", value === "all" ? null : value)
              }
              options={[
                { value: "all", label: "All Leagues" },
                ...leagues.map((league) => ({
                  value: league.id,
                  label: league.name,
                })),
              ]}
              highlighted={!!filter.leagueId}
            />

            {/* Time Frame Filter */}
            <CustomSelect
              id="timeframe-filter"
              name="timeframe"
              label="Time Frame"
              value={filter.timeFrame}
              onChange={(value) => handleFilterChange("timeFrame", value)}
              options={getYearOptions()}
              highlighted={filter.timeFrame !== "all"}
            />

            {/* Game Mode Filter */}
            <CustomSelect
              id="gamemode-filter"
              name="gamemode"
              label="Game Mode"
              value={filter.gameMode}
              onChange={(value) => handleFilterChange("gameMode", value)}
              options={[
                { value: "all", label: "All Modes" },
                ...(gameConfig?.gameModes.map(mode => ({
                  value: mode.value,
                  label: mode.label
                })) || [])
              ]}
              highlighted={filter.gameMode !== "all"}
            />

            {/* Season Filter */}
            <CustomSelect
              id="season-filter"
              name="season"
              label="Season"
              value={filter.seasonId || "all"}
              onChange={(value) =>
                handleFilterChange("seasonId", value === "all" ? null : value)
              }
              options={[
                { value: "all", label: "All Seasons" },
                ...seasons.map((season) => ({
                  value: season.id,
                  label: season.name,
                })),
              ]}
              highlighted={!!filter.seasonId}
            />
          </div>
        </CardContent>
      </Card>

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

      {/* Rankings Table */}
      {rankings.length === 0 ? (
        <NoDataState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {filter.leagueId 
                ? `${leagues.find(l => l.id === filter.leagueId)?.name} Rankings`
                : "Global Rankings"
              }
            </CardTitle>
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
                          className="hover:bg-gray-50 dark:hover:bg-zinc-700/50"
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Memoize the entire component for better performance
const MemoizedRankings = memo(Rankings);

export default MemoizedRankings;
