import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  auth,
  getUserGames,
  acceptGameInvitation,
  rejectGameInvitation,
  startGame,
  isPlayerInActiveGame,
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
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";

interface GamesListProps {
  refreshNotifications?: () => Promise<void>;
}

const GamesList: React.FC<GamesListProps> = ({ refreshNotifications }) => {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>(
    {},
  );
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [isInActiveGame, setIsInActiveGame] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Function to refresh games list
  const refreshGames = async () => {
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
  };

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

  // Helper to format date
  const formatDate = (timestamp: unknown): string => {
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
  };

  // Helper to get opponent name
  const getOpponentName = (game: Game) => {
    const isCreator = auth.currentUser?.uid === game.createdBy;
    const opponentId = isCreator ? game.opponent : game.createdBy;
    return userProfiles[opponentId]?.displayName || "Unknown player";
  };

  // Handle accepting a game invitation
  const handleAcceptInvitation = async (gameId: string) => {
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
  };

  // Handle rejecting a game invitation
  const handleRejectInvitation = async (gameId: string) => {
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
  };

  // Handle starting a game
  const handleStartGame = async (gameId: string) => {
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
  };

  // Filter games by status
  const invitationsReceived = games.filter(
    (game) =>
      game.status === "invited" && game.opponent === auth.currentUser?.uid,
  );

  const pendingInvitations = games.filter(
    (game) =>
      game.status === "invited" && game.createdBy === auth.currentUser?.uid,
  );

  // Active games include accepted and in_progress games
  const activeGames = games.filter(
    (game) => game.status === "accepted" || game.status === "in_progress",
  );

  // Games waiting for confirmation (separate from active games)
  const waitingConfirmation = games.filter(
    (game) =>
      game.status === "waiting_confirmation" &&
      game.confirmedBy === auth.currentUser?.uid,
  );

  const otherWaitingGames = games.filter(
    (game) =>
      game.status === "waiting_confirmation" &&
      game.confirmedBy !== auth.currentUser?.uid,
  );

  // All games requiring action are those that are active or waiting confirmation
  const actionRequiredGames = [
    ...activeGames,
    ...waitingConfirmation,
    ...otherWaitingGames,
  ];

  const completedGames = games.filter((game) => game.status === "completed");

  const rejectedGames = games.filter((game) => game.status === "rejected");

  // Check for notifications and actionable items
  const hasNewInvitations = invitationsReceived.length > 0;
  const hasActiveGames = actionRequiredGames.length > 0;

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-zinc-900 dark:text-white">
        <h1 className="text-2xl font-bold mb-6">My Games</h1>
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!auth.currentUser) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-zinc-900 dark:text-white">
        <h1 className="text-2xl font-bold mb-6">My Games</h1>
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 text-center">
          <p className="mb-4">Please sign in to view your games.</p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto text-zinc-900 dark:text-white">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0">
          <h1 className="text-2xl font-bold flex items-center">
            My Games
            {hasNewInvitations && (
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
          className={`px-4 py-2 ${
            isInActiveGame
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          } text-white rounded-md`}
          onClick={(e) => {
            if (isInActiveGame) {
              e.preventDefault();
              alert(
                "You cannot create a new game while you have an active game",
              );
            }
          }}
        >
          Create New Game
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md flex justify-between items-center">
          <div>{error}</div>
          <button
            className="ml-4 text-red-700 font-medium underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
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
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 text-center">
          <p className="mb-4">You don't have any games yet.</p>
          <Link
            to="/create-game"
            className={`px-4 py-2 ${
              isInActiveGame
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            } text-white rounded-md`}
            onClick={(e) => {
              if (isInActiveGame) {
                e.preventDefault();
                alert(
                  "You cannot create a new game while you have an active game",
                );
              }
            }}
          >
            Create Your First Game
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Game invitations received */}
          {invitationsReceived.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3 flex items-center">
                <span className="mr-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {invitationsReceived.length}
                </span>
                Game Invitations Received
                <span className="ml-2 animate-pulse inline-block w-2 h-2 bg-red-500 rounded-full"></span>
              </h2>
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden border-2 border-amber-400 dark:border-amber-500">
                <ul className="divide-y divide-gray-200 dark:divide-zinc-700">
                  {invitationsReceived.map((game) => (
                    <li
                      key={game.id}
                      className="hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    >
                      <div className="p-4">
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <p className="font-bold text-lg">
                              Invitation from {getOpponentName(game)}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-zinc-400">
                              {formatDate(game.createdAt)} •{" "}
                              {game.settings.gameMode} •{" "}
                              {game.settings.pointsToWin} points
                            </p>
                            {game.settings.useBoricuaRules && (
                              <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded dark:bg-blue-900/20 dark:text-blue-300">
                                Boricua Rules
                              </span>
                            )}
                          </div>
                          <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 animate-pulse">
                            New Invitation
                          </span>
                        </div>
                        <div className="flex justify-end space-x-3">
                          <button
                            onClick={() =>
                              handleRejectInvitation(game.id || "")
                            }
                            disabled={
                              actionInProgress === game.id || isInActiveGame
                            }
                            className={`px-4 py-2 text-sm font-medium rounded-md ${
                              actionInProgress === game.id
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-100 dark:hover:bg-red-900/80"
                            }`}
                          >
                            {actionInProgress === game.id
                              ? "Processing..."
                              : "Decline"}
                          </button>
                          <button
                            onClick={() =>
                              handleAcceptInvitation(game.id || "")
                            }
                            disabled={actionInProgress === game.id}
                            className={`px-4 py-2 text-sm font-medium rounded-md ${
                              actionInProgress === game.id
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : isInActiveGame
                                  ? "bg-yellow-600 text-white hover:bg-yellow-700"
                                  : "bg-green-600 text-white hover:bg-green-700"
                            }`}
                          >
                            {actionInProgress === game.id
                              ? "Processing..."
                              : isInActiveGame
                                ? "Already in a game"
                                : "Accept Invitation"}
                          </button>
                        </div>
                        {isInActiveGame && !actionInProgress && (
                          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-md dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200">
                            <p className="text-sm">
                              You must complete your active game before
                              accepting a new invitation.
                            </p>
                            <Link
                              to={`/games`}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 mt-1 inline-block"
                              onClick={refreshGames}
                            >
                              View my active game →
                            </Link>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Pending invitations (waiting for opponent) */}
          {pendingInvitations.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3">
                Pending Invitations
              </h2>
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-zinc-700">
                  {pendingInvitations.map((game) => (
                    <li
                      key={game.id}
                      className="hover:bg-gray-50 dark:hover:bg-zinc-700"
                    >
                      <Link to={`/game/${game.id}`} className="block p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center">
                              <p className="font-medium">
                                Invitation to {getOpponentName(game)}
                              </p>
                              <span className="ml-2 flex-shrink-0 h-2 w-2 bg-blue-500 rounded-full animate-pulse"></span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-zinc-400">
                              {formatDate(game.createdAt)} •{" "}
                              {game.settings.gameMode} •{" "}
                              {game.settings.pointsToWin} points
                            </p>
                          </div>
                          <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                            Awaiting Response
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Active games (accepted, in progress, or waiting confirmation) */}
          {actionRequiredGames.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3 flex items-center">
                <span className="mr-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-green-500 rounded-full">
                  {actionRequiredGames.length}
                </span>
                Active Games
              </h2>
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden border-2 border-green-400 dark:border-green-500">
                <ul className="divide-y divide-gray-200 dark:divide-zinc-700">
                  {actionRequiredGames.map((game) => (
                    <li
                      key={game.id}
                      className="hover:bg-gray-50 dark:hover:bg-zinc-700"
                    >
                      <div className="p-4">
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <p className="font-medium">
                              Game with {getOpponentName(game)}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-zinc-400">
                              {formatDate(game.createdAt)} •{" "}
                              {game.settings.gameMode} •{" "}
                              {game.settings.pointsToWin} points
                            </p>
                          </div>
                          <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                            {game.status === "accepted"
                              ? "Ready to Play"
                              : game.status === "in_progress"
                                ? "In Progress"
                                : "Waiting Confirmation"}
                          </span>
                        </div>

                        {game.status === "accepted" && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleStartGame(game.id || "")}
                              disabled={actionInProgress === game.id}
                              className={`px-3 py-1.5 text-sm font-medium rounded ${
                                actionInProgress === game.id
                                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                  : "bg-blue-600 text-white hover:bg-blue-700"
                              }`}
                            >
                              {actionInProgress === game.id
                                ? "Starting..."
                                : "Start Game"}
                            </button>
                          </div>
                        )}

                        {(game.status === "in_progress" ||
                          game.status === "waiting_confirmation") && (
                          <div className="flex justify-end">
                            <Link
                              to={`/game/${game.id}`}
                              className="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
                            >
                              {game.status === "waiting_confirmation"
                                ? "View Game"
                                : "Continue Game"}
                            </Link>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Games requiring confirmation - now included in active games section */}
          {false && (
            <div>
              <h2 className="text-xl font-semibold mb-3">
                Games Waiting Your Confirmation
              </h2>
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-zinc-700">
                  {waitingConfirmation.map((game) => (
                    <li
                      key={game.id}
                      className="hover:bg-gray-50 dark:hover:bg-zinc-700"
                    >
                      <Link to={`/game/${game.id}`} className="block p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">
                              Game with {getOpponentName(game)}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-zinc-400">
                              {formatDate(game.updatedAt)}
                            </p>
                          </div>
                          <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
                            Needs Confirmation
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Waiting for other player confirmation - now included in active games section */}
          {false && (
            <div>
              <h2 className="text-xl font-semibold mb-3">
                Waiting for Opponent Confirmation
              </h2>
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-zinc-700">
                  {otherWaitingGames.map((game) => (
                    <li
                      key={game.id}
                      className="hover:bg-gray-50 dark:hover:bg-zinc-700"
                    >
                      <Link to={`/game/${game.id}`} className="block p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">
                              Game with {getOpponentName(game)}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-zinc-400">
                              {formatDate(game.updatedAt)}
                            </p>
                          </div>
                          <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            Waiting Confirmation
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Rejected games */}
          {rejectedGames.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Declined Games</h2>
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-zinc-700">
                  {rejectedGames.map((game) => (
                    <li
                      key={game.id}
                      className="hover:bg-gray-50 dark:hover:bg-zinc-700"
                    >
                      <div className="block p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">
                              Game with {getOpponentName(game)}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-zinc-400">
                              {formatDate(game.updatedAt)}
                            </p>
                            {game.rejectionReason && (
                              <p className="text-sm text-red-500 mt-1">
                                Reason: {game.rejectionReason}
                              </p>
                            )}
                          </div>
                          <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                            Declined
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Completed games */}
          {completedGames.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Completed Games</h2>
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-zinc-700">
                  {completedGames.map((game) => {
                    const currentUserWon =
                      game.winner === auth.currentUser?.uid;
                    return (
                      <li
                        key={game.id}
                        className="hover:bg-gray-50 dark:hover:bg-zinc-700"
                      >
                        <Link to={`/game/${game.id}`} className="block p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">
                                Game with {getOpponentName(game)}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-zinc-400">
                                {formatDate(game.updatedAt)}
                              </p>
                              {game.scores && (
                                <p className="text-sm mt-1">
                                  Score: {game.scores.creator} -{" "}
                                  {game.scores.opponent}
                                </p>
                              )}
                            </div>
                            <span
                              className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
                                currentUserWon
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                              }`}
                            >
                              {currentUserWon ? "Won" : "Lost"}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GamesList;
