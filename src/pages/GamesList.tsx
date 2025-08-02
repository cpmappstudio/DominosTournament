import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  auth,
  getUserGames,
  acceptGameInvitation,
  rejectGameInvitation,
  startGame,
  isPlayerInActiveGame,
  getLeagueById,
} from "../firebase";
import type { Game, UserProfile } from "../firebase";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import {
  BellAlertIcon,
} from "@heroicons/react/24/solid";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../components/ui/avatar";
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
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

interface GamesListProps {
  refreshNotifications?: () => Promise<void>;
}

// Extended Game type for table display
interface GameTableRow extends Game {
  opponentName: string;
  opponentPhotoURL?: string;
  opponentInitials: string;
  formattedDate: string;
  statusDisplay: string;
  statusColor: string;
  gameInfo: string;
  result?: "Won" | "Lost" | null;
  leagueName?: string;
}

// Define columns for the games table
const createColumns = (
  handleAcceptInvitation: (gameId: string) => void,
  handleRejectInvitation: (gameId: string) => void,
  handleStartGame: (gameId: string) => void,
  actionInProgress: string | null,
  isInActiveGame: boolean,
  navigate: (path: string) => void
): ColumnDef<GameTableRow>[] => [
  {
    accessorKey: "formattedDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-semibold hover:bg-transparent"
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className="text-xs sm:text-sm whitespace-nowrap">{row.getValue("formattedDate")}</div>
    ),
  },
  {
    accessorKey: "opponentName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-semibold hover:bg-transparent"
        >
          Opponent
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const game = row.original;
      
      return (
        <div className="font-medium text-xs sm:text-sm flex items-center space-x-2">
          <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
            <AvatarImage src={game.opponentPhotoURL || undefined} alt={game.opponentName} />
            <AvatarFallback className="text-xs">{game.opponentInitials}</AvatarFallback>
          </Avatar>
          <div className="truncate max-w-20 sm:max-w-none" title={game.opponentName}>
            {game.opponentName}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "gameInfo",
    header: "Type",
    cell: ({ row }) => (
      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap capitalize">
        {row.getValue("gameInfo")}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-semibold hover:bg-transparent"
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const game = row.original;
      return (
        <span className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium rounded-full ${game.statusColor}`}>
          {game.statusDisplay}
        </span>
      );
    },
  },
  {
    accessorKey: "result",
    header: "Result",
    cell: ({ row }) => {
      const result = row.getValue("result") as string | null;
      if (!result) return null;
      
      return (
        <span className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium rounded ${
          result === "Won" 
            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
        }`}>
          {result === "Won" ? "W" : "L"}
          <span className="hidden sm:inline">
            {result === "Won" ? "on" : "ost"}
          </span>
        </span>
      );
    },
  },
  {
    accessorKey: "leagueName",
    header: "League",
    cell: ({ row }) => {
      const leagueName = row.getValue("leagueName") as string | null;
      if (!leagueName || leagueName === "Individual") {
        return (
          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Individual
          </span>
        );
      }
      
      return (
        <span className="inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
          {leagueName}
        </span>
      );
    },
  },
];

// Memoized Loading Component
const LoadingState = memo(() => (
  <div className="p-2 sm:p-4 lg:p-6 w-full lg:max-w-6xl lg:mx-auto">
    <h1 className="sr-only">My Games</h1>
    <Card>
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">My Games</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </CardContent>
    </Card>
  </div>
));

// Memoized Unauthenticated State
const UnauthenticatedState = memo(({ onNavigateHome }: { onNavigateHome: () => void }) => (
  <div className="p-2 sm:p-4 lg:p-6 w-full lg:max-w-6xl lg:mx-auto">
    <h1 className="sr-only">My Games</h1>
    <Card>
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">My Games</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="mb-4">Please sign in to view your games.</p>
        <Button onClick={onNavigateHome}>
          Go to Home
        </Button>
      </CardContent>
    </Card>
  </div>
));

// Memoized No Games State
const NoGamesState = memo(({ isInActiveGame, onCreateGame }: { 
  isInActiveGame: boolean; 
  onCreateGame: (e: React.MouseEvent) => void;
}) => (
  <Card>
    <CardContent className="text-center pt-6">
      <p className="mb-4">You don't have any games yet.</p>
      <Link
        to="/create-game"
        className={`inline-block ${
          isInActiveGame
            ? "pointer-events-none opacity-50"
            : ""
        }`}
        onClick={onCreateGame}
      >
        <Button disabled={isInActiveGame}>
          Create Your First Game
        </Button>
      </Link>
    </CardContent>
  </Card>
));

const GamesList: React.FC<GamesListProps> = ({ refreshNotifications }) => {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>(
    {},
  );
  const [leagueNames, setLeagueNames] = useState<Record<string, string>>({});
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [isInActiveGame, setIsInActiveGame] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Table states
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")

  // Function to refresh games list - memoized with useCallback
  const refreshGames = useCallback(async () => {
    if (!auth.currentUser) {
      navigate("/");
      return;
    }

    try {
      setIsRefreshing(true);

      // First get all games
      const userGames = await getUserGames();
      setGames(userGames);

      // Then check if user is in an active game
      if (auth.currentUser) {
        const activeGameStatus = await isPlayerInActiveGame(
          auth.currentUser.uid,
        );
        setIsInActiveGame(activeGameStatus);
      }

      // Get opponent names for display
      const userIds = new Set<string>();
      userGames.forEach((game) => {
        userIds.add(game.createdBy);
        userIds.add(game.opponent);
      });

      const db = getFirestore();
      const profilePromises = Array.from(userIds).map(async (uid) => {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return { uid, profile: docSnap.data() as UserProfile };
        }
        return null;
      });

      const profiles = (await Promise.all(profilePromises)).filter(Boolean) as {
        uid: string;
        profile: UserProfile;
      }[];
      const profilesMap: Record<string, UserProfile> = {};
      profiles.forEach((item) => {
        if (item) profilesMap[item.uid] = item.profile;
      });

      setUserProfiles(profilesMap);

      // Get league names for games that belong to leagues
      const leagueIds = new Set<string>();
      userGames.forEach((game) => {
        if (game.leagueId) {
          leagueIds.add(game.leagueId);
        }
      });

      const leaguePromises = Array.from(leagueIds).map(async (leagueId) => {
        const league = await getLeagueById(leagueId);
        return league ? { id: leagueId, name: league.name } : null;
      });

      const leagues = (await Promise.all(leaguePromises)).filter(Boolean) as {
        id: string;
        name: string;
      }[];
      const leaguesMap: Record<string, string> = {};
      leagues.forEach((league) => {
        leaguesMap[league.id] = league.name;
      });

      setLeagueNames(leaguesMap);

      // Check for new invitations
      const newInvites = userGames.filter(
        (game) =>
          game.status === "invited" && game.opponent === auth.currentUser?.uid,
      );

      // Only trigger notification refresh if we have new invitations
      if (newInvites.length > 0 && refreshNotifications) {
        refreshNotifications();
      }
    } catch (error) {
      console.error("Error fetching games:", error);
      setError("Failed to load your games");
    } finally {
      setIsRefreshing(false);
    }
  }, [navigate, refreshNotifications]);

  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true);
      await refreshGames();
      setLoading(false);
    };

    fetchGames();

    // Set up real-time listeners for game updates instead of interval-based refresh
    const db = getFirestore();

    // Only proceed if user is logged in
    if (!auth.currentUser) return;

    // Listen for games where user is creator
    const creatorQuery = query(
      collection(db, "games"),
      where("createdBy", "==", auth.currentUser.uid),
    );

    // Listen for games where user is opponent
    const opponentQuery = query(
      collection(db, "games"),
      where("opponent", "==", auth.currentUser.uid),
    );

    // Set up the listeners
    const creatorUnsubscribe = onSnapshot(creatorQuery, (snapshot) => {
      if (!snapshot.empty) {
        // Only refresh if there are actual changes
        if (snapshot.docChanges().length > 0) {
          refreshGames();
        }
      }
    });

    const opponentUnsubscribe = onSnapshot(opponentQuery, (snapshot) => {
      if (!snapshot.empty) {
        // Only refresh if there are actual changes
        if (snapshot.docChanges().length > 0) {
          refreshGames();
        }
      }
    });

    // Clean up listeners when component unmounts
    return () => {
      creatorUnsubscribe();
      opponentUnsubscribe();
    };
  }, [navigate]);

  // Helper to format date - memoized
  const formatDate = useCallback((timestamp: unknown): string => {
    if (!timestamp) return "Unknown date";

    // Handle Firestore Timestamp-like objects
    if (
      typeof timestamp === "object" &&
      timestamp !== null &&
      "toDate" in timestamp &&
      typeof (timestamp as { toDate: unknown }).toDate === "function"
    ) {
      return (timestamp as { toDate: () => Date })
        .toDate()
        .toLocaleDateString();
    }

    // Handle Date object
    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString();
    }

    // Handle number or string
    if (typeof timestamp === "number" || typeof timestamp === "string") {
      try {
        return new Date(timestamp).toLocaleDateString();
      } catch {
        return "Invalid date";
      }
    }

    return "Unknown date format";
  }, []);

  // Helper to get opponent name - memoized
  const getOpponentName = useCallback((game: Game) => {
    const isCreator = auth.currentUser?.uid === game.createdBy;
    const opponentId = isCreator ? game.opponent : game.createdBy;
    return userProfiles[opponentId]?.displayName || "Unknown player";
  }, [userProfiles]);

  // Helper to get opponent data (name, avatar, etc.) - memoized
  const getOpponentData = useCallback((game: Game) => {
    const isCreator = auth.currentUser?.uid === game.createdBy;
    const opponentId = isCreator ? game.opponent : game.createdBy;
    const profile = userProfiles[opponentId];
    return {
      name: profile?.displayName || "Unknown player",
      photoURL: profile?.photoURL || null,
      initials: profile?.displayName ? profile.displayName.substring(0, 2).toUpperCase() : "UP"
    };
  }, [userProfiles]);

  // Transform games data for table display - memoized
  const tableData = useMemo(() => {
    return games.map((game): GameTableRow => {
      const isCreator = auth.currentUser?.uid === game.createdBy;
      const opponentData = getOpponentData(game);
      
      // Determine status display and color
      let statusDisplay = "";
      let statusColor = "";
      let result: "Won" | "Lost" | null = null;
      
      switch (game.status) {
        case "invited":
          if (game.opponent === auth.currentUser?.uid) {
            statusDisplay = "New Invitation";
            statusColor = "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 animate-pulse";
          } else {
            statusDisplay = "Awaiting Response";
            statusColor = "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
          }
          break;
        case "accepted":
          statusDisplay = "Ready to Play";
          statusColor = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
          break;
        case "in_progress":
          statusDisplay = "In Progress";
          statusColor = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
          break;
        case "waiting_confirmation":
          statusDisplay = "Waiting Confirmation";
          statusColor = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
          break;
        case "completed":
          statusDisplay = "Completed";
          statusColor = "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100";
          result = game.winner === auth.currentUser?.uid ? "Won" : "Lost";
          break;
        case "rejected":
          statusDisplay = "Rejected";
          statusColor = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
          break;
        default:
          statusDisplay = game.status;
          statusColor = "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100";
      }

      // Create game info string - simplified for mobile
      const gameInfo = game.settings.gameMode === "single" ? "Individual" : "Teams";

      return {
        ...game,
        opponentName: opponentData.name,
        opponentPhotoURL: opponentData.photoURL,
        opponentInitials: opponentData.initials,
        formattedDate: formatDate(game.createdAt),
        statusDisplay,
        statusColor,
        gameInfo,
        result,
        leagueName: game.leagueId ? (leagueNames[game.leagueId] || "League Game") : "Individual",
      };
    });
  }, [games, getOpponentData, formatDate, leagueNames]);

  // Handle accepting a game invitation - memoized
  const handleAcceptInvitation = useCallback(async (gameId: string) => {
    try {
      // Check if user is already in an active game before proceeding
      if (isInActiveGame) {
        setError(
          "You cannot accept this invitation because you're already in an active game",
        );
        return;
      }

      setActionInProgress(gameId);
      const result = await acceptGameInvitation(gameId);
      if (result) {
        // Refresh games list
        await refreshGames();
        setIsInActiveGame(true);
      }
    } catch (error) {
      console.error("Error accepting invitation:", error);
      setError("Failed to accept game invitation");
    } finally {
      setActionInProgress(null);
    }
  }, [isInActiveGame, refreshGames]);

  // Handle rejecting a game invitation - memoized
  const handleRejectInvitation = useCallback(async (gameId: string) => {
    try {
      setActionInProgress(gameId);
      const result = await rejectGameInvitation(gameId);
      if (result) {
        // Refresh games list
        await refreshGames();
      }
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      setError("Failed to reject game invitation");
    } finally {
      setActionInProgress(null);
    }
  }, [refreshGames]);

  // Handle starting a game - memoized
  const handleStartGame = useCallback(async (gameId: string) => {
    try {
      setActionInProgress(gameId);
      const result = await startGame(gameId);
      if (result) {
        // Refresh games list
        await refreshGames();

        // Navigate to game detail page
        navigate(`/game/${gameId}`);
      }
    } catch (error) {
      console.error("Error starting game:", error);
      setError("Failed to start the game");
    } finally {
      setActionInProgress(null);
    }
  }, [refreshGames, navigate]);

  // Handle navigation callbacks
  const handleNavigateHome = useCallback(() => navigate("/"), [navigate]);
  
  const handleCreateGameClick = useCallback((e: React.MouseEvent) => {
    if (isInActiveGame) {
      e.preventDefault();
      alert("You cannot create a new game while you have an active game");
    }
  }, [isInActiveGame]);

  // Create columns with handlers
  const columns = useMemo(() => 
    createColumns(
      handleAcceptInvitation,
      handleRejectInvitation,
      handleStartGame,
      actionInProgress,
      isInActiveGame,
      navigate
    ), 
    [handleAcceptInvitation, handleRejectInvitation, handleStartGame, actionInProgress, isInActiveGame, navigate]
  );

  // Configure table
  const table = useReactTable({
    data: tableData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  });

  // Memoized notification indicators for header
  const notificationState = useMemo(() => {
    const newInvitations = tableData.filter(
      (game) => game.status === "invited" && game.opponent === auth.currentUser?.uid
    );
    const activeGames = tableData.filter(
      (game) => game.status === "accepted" || game.status === "in_progress" || game.status === "waiting_confirmation"
    );
    
    return {
      hasNewInvitations: newInvitations.length > 0,
      hasActiveGames: activeGames.length > 0,
    };
  }, [tableData]);

  if (loading) {
    return <LoadingState />;
  }

  if (!auth.currentUser) {
    return <UnauthenticatedState onNavigateHome={handleNavigateHome} />;
  }

  return (
    <div className="p-2 sm:p-4 lg:p-6 w-full lg:max-w-6xl lg:mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center">
            My Games
            {notificationState.hasNewInvitations && (
              <span className="ml-3 inline-flex items-center">
                <BellAlertIcon className="h-5 w-5 text-amber-500 animate-bounce" />
                <span className="ml-1 text-sm font-medium text-amber-600">
                  New Invitations!
                </span>
              </span>
            )}
          </h1>
          <div className="flex items-center">
            <button
              onClick={refreshGames}
              disabled={isRefreshing}
              className="md:ml-3 p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              title="Refresh games list"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </button>
            <div className="ml-3 text-xs text-gray-500 dark:text-gray-400">
              Real-time updates enabled
            </div>
          </div>
        </div>
        <Link
          to="/create-game"
          className={`inline-block ${
            isInActiveGame
              ? "pointer-events-none opacity-50"
              : ""
          }`}
          onClick={handleCreateGameClick}
        >
          <Button disabled={isInActiveGame} className="bg-blue-600 text-white hover:bg-blue-700">
            Create New Game
          </Button>
        </Link>
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

      {isRefreshing && !loading && (
        <div className="mb-6 p-4 bg-blue-100 border border-blue-400 text-blue-800 rounded-md flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-800 mr-2"></div>
          <span>Refreshing games...</span>
        </div>
      )}

      {isInActiveGame && (
        <div className="mb-6 p-4 bg-blue-100 border border-blue-400 text-blue-800 rounded-md">
          <p className="font-medium">You currently have an active game.</p>
          <p>
            You must complete your active game before creating or joining a new
            one.
          </p>
        </div>
      )}

      {games.length === 0 ? (
        <NoGamesState isInActiveGame={isInActiveGame} onCreateGame={handleCreateGameClick} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Games</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full">
              {/* Search Input */}
              <div className="flex items-center md:flex-row flex-col-reverse py-4">
                <Input
                  placeholder="Search games by opponent name, status..."
                  value={globalFilter ?? ""}
                  onChange={(event) => setGlobalFilter(String(event.target.value))}
                  className="max-w-sm"
                />
                <div className="ml-auto text-sm text-muted-foreground">
                  {table.getFilteredRowModel().rows.length} of{" "}
                  {table.getCoreRowModel().rows.length} games
                </div>
              </div>
              
              {/* Table */}
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                          // Check if this is the Type column and add responsive class
                          const isTypeColumn = header.column.id === "gameInfo";
                          return (
                            <TableHead 
                              key={header.id}
                              className={isTypeColumn ? "hidden sm:table-cell" : ""}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </TableHead>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700/50"
                          onClick={() => navigate(`/game/${row.original.id}`)}
                        >
                          {row.getVisibleCells().map((cell) => {
                            // Check if this is the Type column and add responsive class
                            const isTypeColumn = cell.column.id === "gameInfo";
                            return (
                              <TableCell 
                                key={cell.id}
                                className={isTypeColumn ? "hidden sm:table-cell" : ""}
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="h-24 text-center"
                        >
                          No games found.
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
const MemoizedGamesList = memo(GamesList);

export default MemoizedGamesList;
