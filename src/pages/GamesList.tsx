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
  
  // Combine related states to reduce re-renders
  const [gameState, setGameState] = useState({
    games: [] as Game[],
    loading: true,
    error: null as string | null,
    isRefreshing: false,
  });
  
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [leagueNames, setLeagueNames] = useState<Record<string, string>>({});
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [isInActiveGame, setIsInActiveGame] = useState(false);

  // Table states
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")

  // Optimize league fetching - batch all league requests
  const fetchLeagueNames = useCallback(async (leagueIds: string[]) => {
    if (leagueIds.length === 0) return {};
    
    try {
      // Batch fetch all leagues at once instead of individual requests
      const leaguePromises = leagueIds.map(async (leagueId) => {
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
      
      return leaguesMap;
    } catch (error) {
      console.error("Error fetching league names:", error);
      return {};
    }
  }, []);

  // Function to refresh games list - simplified and faster
  const refreshGames = useCallback(async () => {
    if (!auth.currentUser) {
      navigate("/");
      return;
    }

    try {
      setGameState(prev => ({ ...prev, isRefreshing: true }));

      // Get all games in parallel with user profile check
      const [userGames, activeGameStatus] = await Promise.all([
        getUserGames(),
        isPlayerInActiveGame(auth.currentUser.uid)
      ]);

      setGameState(prev => ({ ...prev, games: userGames }));
      setIsInActiveGame(activeGameStatus);

      // Get all unique user IDs for opponent profiles
      const userIds = new Set<string>();
      userGames.forEach((game) => {
        userIds.add(game.createdBy);
        userIds.add(game.opponent);
      });

      // Batch fetch all user profiles
      const db = getFirestore();
      const profilePromises = Array.from(userIds).map(async (uid) => {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { uid, profile: docSnap.data() as UserProfile } : null;
      });

      const profiles = (await Promise.all(profilePromises)).filter(Boolean) as {
        uid: string;
        profile: UserProfile;
      }[];
      
      const profilesMap: Record<string, UserProfile> = {};
      profiles.forEach((item) => {
        profilesMap[item.uid] = item.profile;
      });
      setUserProfiles(profilesMap);

      // Get league names for games with leagues
      const leagueIds = Array.from(new Set(
        userGames
          .map(game => game.leagueId)
          .filter(Boolean) as string[]
      ));
      
      if (leagueIds.length > 0) {
        const leaguesMap = await fetchLeagueNames(leagueIds);
        setLeagueNames(leaguesMap);
      }

      // Refresh notifications if needed
      if (refreshNotifications) {
        refreshNotifications();
      }
    } catch (error) {
      console.error("Error fetching games:", error);
      setGameState(prev => ({ ...prev, error: "Failed to load your games" }));
    } finally {
      setGameState(prev => ({ ...prev, isRefreshing: false }));
    }
  }, [navigate, refreshNotifications, fetchLeagueNames]);

  // Simplified real-time updates
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Initial load
    const fetchGames = async () => {
      setGameState(prev => ({ ...prev, loading: true }));
      await refreshGames();
      setGameState(prev => ({ ...prev, loading: false }));
    };

    fetchGames();

    // Simple real-time listener for game updates
    const db = getFirestore();
    const gamesQuery = query(
      collection(db, "games"),
      where("createdBy", "==", currentUser.uid)
    );
    
    const opponentQuery = query(
      collection(db, "games"),
      where("opponent", "==", currentUser.uid)
    );

    // Throttled refresh to avoid excessive calls
    let lastRefresh = 0;
    const throttledRefresh = () => {
      const now = Date.now();
      if (now - lastRefresh > 2000) { // 2 second throttle
        lastRefresh = now;
        refreshGames();
      }
    };

    const unsubscribe1 = onSnapshot(gamesQuery, throttledRefresh);
    const unsubscribe2 = onSnapshot(opponentQuery, throttledRefresh);

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, []); // Empty dependency array

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

  // Simplified table data transformation
  const tableData = useMemo(() => {
    return gameState.games.map((game): GameTableRow => {
      const isCreator = auth.currentUser?.uid === game.createdBy;
      const opponentData = getOpponentData(game);
      
      // Simplified status logic
      const statusMap = {
        invited: game.opponent === auth.currentUser?.uid 
          ? { display: "New Invitation", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 animate-pulse" }
          : { display: "Awaiting Response", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300" },
        accepted: { display: "Ready to Play", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" },
        in_progress: { display: "🔥 In Progress", color: "bg-gradient-to-r from-green-400 to-green-600 text-white dark:from-green-500 dark:to-green-700 animate-pulse shadow-lg border border-green-300" },
        waiting_confirmation: { display: "Waiting Confirmation", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" },
        completed: { display: "Completed", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100" },
        rejected: { display: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" }
      };

      const status = statusMap[game.status as keyof typeof statusMap] || 
        { display: game.status, color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100" };

      const result = game.status === "completed" && game.winner
        ? (game.winner === auth.currentUser?.uid ? "Won" : "Lost")
        : null;

      return {
        ...game,
        opponentName: opponentData.name,
        opponentPhotoURL: opponentData.photoURL,
        opponentInitials: opponentData.initials,
        formattedDate: formatDate(game.createdAt),
        statusDisplay: status.display,
        statusColor: status.color,
        gameInfo: game.settings.gameMode === "single" ? "Individual" : "Teams",
        result: result as "Won" | "Lost" | null,
        leagueName: game.leagueId ? (leagueNames[game.leagueId] || "League Game") : "Individual",
      };
    });
  }, [gameState.games, getOpponentData, formatDate, leagueNames]);

  // Simplified invitation handling
  const handleAcceptInvitation = useCallback(async (gameId: string) => {
    if (isInActiveGame) {
      setGameState(prev => ({ 
        ...prev, 
        error: "You cannot accept this invitation because you're already in an active game" 
      }));
      return;
    }

    try {
      setActionInProgress(gameId);
      const result = await acceptGameInvitation(gameId);
      if (result) {
        await refreshGames();
        setIsInActiveGame(true);
      }
    } catch (error) {
      setGameState(prev => ({ ...prev, error: "Failed to accept game invitation" }));
    } finally {
      setActionInProgress(null);
    }
  }, [isInActiveGame, refreshGames]);

  const handleRejectInvitation = useCallback(async (gameId: string) => {
    try {
      setActionInProgress(gameId);
      const result = await rejectGameInvitation(gameId);
      if (result) {
        await refreshGames();
      }
    } catch (error) {
      setGameState(prev => ({ ...prev, error: "Failed to reject game invitation" }));
    } finally {
      setActionInProgress(null);
    }
  }, [refreshGames]);

  const handleStartGame = useCallback(async (gameId: string) => {
    try {
      setActionInProgress(gameId);
      const result = await startGame(gameId);
      if (result) {
        await refreshGames();
        navigate(`/game/${gameId}`);
      }
    } catch (error) {
      setGameState(prev => ({ ...prev, error: "Failed to start the game" }));
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

  // Simplified notification indicators
  const notificationState = useMemo(() => {
    const invitations = tableData.filter(g => g.status === "invited" && g.opponent === auth.currentUser?.uid);
    const inProgress = tableData.filter(g => g.status === "in_progress");
    
    return {
      hasNewInvitations: invitations.length > 0,
      hasInProgressGames: inProgress.length > 0,
      inProgressCount: inProgress.length,
    };
  }, [tableData]);

  if (gameState.loading) {
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
            {notificationState.hasInProgressGames && (
              <span className="ml-3 inline-flex items-center">
                <div className="relative">
                  <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="absolute top-0 left-0 h-3 w-3 bg-green-400 rounded-full animate-ping opacity-75"></div>
                </div>
                <span className="ml-2 text-sm font-medium text-green-600 dark:text-green-400">
                  {notificationState.inProgressCount} Game{notificationState.inProgressCount > 1 ? 's' : ''} in Progress
                </span>
              </span>
            )}
          </h1>
          <div className="flex items-center">
            <button
              onClick={refreshGames}
              disabled={gameState.isRefreshing}
              className="md:ml-3 p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              title="Refresh games list"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className={`w-5 h-5 ${gameState.isRefreshing ? "animate-spin" : ""}`}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </button>
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

      {gameState.error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md flex justify-between items-center">
          <div>{gameState.error}</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGameState(prev => ({ ...prev, error: null }))}
            className="ml-4 text-red-700 hover:text-red-800"
          >
            Dismiss
          </Button>
        </div>
      )}

      {gameState.isRefreshing && !gameState.loading && (
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

      {notificationState.hasInProgressGames && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-900 dark:text-green-200 rounded-md">
          <div className="flex items-center">
            <div className="relative mr-3">
              <div className="h-4 w-4 bg-green-500 rounded-full animate-pulse"></div>
              <div className="absolute top-0 left-0 h-4 w-4 bg-green-400 rounded-full animate-ping opacity-75"></div>
            </div>
            <div>
              <p className="font-medium">
                {notificationState.inProgressCount} game{notificationState.inProgressCount > 1 ? 's' : ''} currently in progress!
              </p>
              <p className="text-sm">
                {notificationState.inProgressCount === 1 
                  ? "Your game is active. Click on it to continue playing." 
                  : "You have multiple active games. Click on any to continue playing."}
              </p>
            </div>
          </div>
        </div>
      )}

      {gameState.games.length === 0 ? (
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
