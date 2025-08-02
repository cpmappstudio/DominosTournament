import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { 
  auth, 
  getGameById, 
  getUserProfile, 
  submitGameScore, 
  confirmGameResult, 
  acceptGameInvitation,
  rejectGameInvitation,
  startGame
} from "../firebase";
import { useGameModeInfo, usePointsInfo, useRulesetInfo } from "../hooks/useGameConfig";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import type { Game, UserProfile } from "../firebase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

interface GameDetailProps {
  refreshNotifications?: () => Promise<void>;
}

// Component to display game mode with dynamic info
const GameModeDisplay = memo<{ gameMode: string }>(({ gameMode }) => {
  const gameModeInfo = useGameModeInfo(gameMode);
  
  return (
    <div className="p-3 bg-gray-50 dark:bg-zinc-700 rounded-md">
      <p className="text-sm text-gray-500 dark:text-zinc-400">Game Mode</p>
      <p className="font-medium">
        {gameModeInfo?.label || gameMode}
        {!gameModeInfo?.isValid && (
          <span className="ml-2 text-xs text-red-500">(Legacy)</span>
        )}
      </p>
      {gameModeInfo?.description && (
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
          {gameModeInfo.description}
        </p>
      )}
    </div>
  );
});

// Component to display points with dynamic info
const PointsDisplay = memo<{ points: number }>(({ points }) => {
  const pointsInfo = usePointsInfo(points);
  
  return (
    <div className="p-3 bg-gray-50 dark:bg-zinc-700 rounded-md">
      <p className="text-sm text-gray-500 dark:text-zinc-400">Points to Win</p>
      <p className="font-medium">
        {pointsInfo?.label || `${points} points`}
        {!pointsInfo?.isValid && (
          <span className="ml-2 text-xs text-red-500">(Custom)</span>
        )}
      </p>
      {pointsInfo?.description && (
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
          {pointsInfo.description}
        </p>
      )}
    </div>
  );
});

// Component to display ruleset with dynamic info
const RulesetDisplay = memo<{ useBoricuaRules: boolean }>(({ useBoricuaRules }) => {
  const rulesetValue = useBoricuaRules ? "boricua" : "standard";
  const rulesetInfo = useRulesetInfo(rulesetValue);
  
  return (
    <div className="p-3 bg-gray-50 dark:bg-zinc-700 rounded-md">
      <p className="text-sm text-gray-500 dark:text-zinc-400">Game Rules</p>
      <p className="font-medium">
        {rulesetInfo?.label || (useBoricuaRules ? "Boricua" : "Standard")}
        {!rulesetInfo?.isValid && (
          <span className="ml-2 text-xs text-red-500">(Legacy)</span>
        )}
      </p>
      {rulesetInfo?.description && (
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
          {rulesetInfo.description}
        </p>
      )}
    </div>
  );
});

// Add display names for debugging
GameModeDisplay.displayName = 'GameModeDisplay';
PointsDisplay.displayName = 'PointsDisplay';
RulesetDisplay.displayName = 'RulesetDisplay';

const GameDetail: React.FC<GameDetailProps> = ({ refreshNotifications }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // State
  const [game, setGame] = useState<Game | null>(null);
  const [creator, setCreator] = useState<UserProfile | null>(null);
  const [opponent, setOpponent] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatorScore, setCreatorScore] = useState<number>(0);
  const [opponentScore, setOpponentScore] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  // Check if current user is part of this game
  const isParticipant = useCallback(() => {
    if (!game || !auth.currentUser) return false;
    return game.createdBy === auth.currentUser.uid || game.opponent === auth.currentUser.uid;
  }, [game]);

  // Check if current user is the creator
  const isCreator = useCallback(() => {
    if (!game || !auth.currentUser) return false;
    return game.createdBy === auth.currentUser.uid;
  }, [game]);

  // Check if current user is the opponent
  const isOpponent = useCallback(() => {
    if (!game || !auth.currentUser) return false;
    return game.opponent === auth.currentUser.uid;
  }, [game]);
  
  // Check if it's current user's turn to submit scores
  const canSubmitScores = useCallback(() => {
    if (!game || !auth.currentUser) return false;
    
    // Only the player who's currently active can submit scores
    if (game.status === "in_progress" && game.activePlayer) {
      return game.activePlayer === auth.currentUser.uid;
    }
    
    // If no activePlayer is set, only the creator can submit scores
    return isCreator();
  }, [game, isCreator]);

  // Check if this is an invitation waiting for the current user to accept/reject
  const isPendingInvitation = useCallback(() => {
    if (!game || !auth.currentUser) return false;
    return game.status === "invited" && game.opponent === auth.currentUser.uid;
  }, [game]);

  // Check if this is an invitation the current user sent
  const isSentInvitation = useCallback(() => {
    if (!game || !auth.currentUser) return false;
    return game.status === "invited" && game.createdBy === auth.currentUser.uid;
  }, [game]);

  // Check if game is accepted and ready to start
  const isAccepted = useCallback(() => {
    if (!game) return false;
    return game.status === "accepted";
  }, [game]);

  // Check if it's the current user's turn
  const isCurrentUserTurn = useCallback(() => {
    if (!game || !auth.currentUser || !game.activePlayer) return false;
    return game.activePlayer === auth.currentUser.uid;
  }, [game]);

  // Check if user needs to confirm the game
  const needsConfirmation = useCallback(() => {
    if (!game || !auth.currentUser) return false;
    return game.status === "waiting_confirmation" && game.confirmedBy === auth.currentUser.uid;
  }, [game]);

  // Load game data and user profiles
  useEffect(() => {
    const loadGame = async () => {
      if (!id) {
        setError("Game ID is missing");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Get game data
        const gameData = await getGameById(id);
        if (!gameData) {
          setError("Game not found");
          setLoading(false);
          return;
        }
        
        setGame(gameData);

        // Get creator profile
        const creatorProfile = await getUserProfile(gameData.createdBy);
        setCreator(creatorProfile);

        // Get opponent profile
        const opponentProfile = await getUserProfile(gameData.opponent);
        setOpponent(opponentProfile);

        // Initialize score inputs if scores exist
        if (gameData.scores) {
          setCreatorScore(gameData.scores.creator);
          setOpponentScore(gameData.scores.opponent);
        }
      } catch (err) {
        console.error("Error loading game:", err);
        setError("Failed to load game details");
      } finally {
        setLoading(false);
      }
    };

    loadGame();
    
    // Set up real-time listener for game updates
    const db = getFirestore();
    const gameRef = doc(db, "games", id || "");
    
    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = { id: docSnapshot.id, ...docSnapshot.data() } as Game;
        setGame(gameData);
        
        // Update scores if they exist
        if (gameData.scores) {
          setCreatorScore(gameData.scores.creator);
          setOpponentScore(gameData.scores.opponent);
        }
      }
    }, (error) => {
      console.error("Error listening to game updates:", error);
    });
    
    // Clean up listener on unmount
    return () => unsubscribe();
  }, [id, refreshNotifications]);

  // Handle accepting invitation
  const handleAcceptInvitation = useCallback(async () => {
    if (!id || !isPendingInvitation()) {
      setError("You cannot accept this invitation");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const updatedGame = await acceptGameInvitation(id);
      
      if (updatedGame) {
        setGame(updatedGame);
        // Refresh notifications when invitation is accepted
        if (refreshNotifications) {
          refreshNotifications();
        }
      } else {
        setError("Failed to accept invitation");
      }
    } catch (err: any) {
      console.error("Error accepting invitation:", err);
      setError(err.message || "An error occurred while accepting the invitation");
    } finally {
      setIsSubmitting(false);
    }
  }, [id, isPendingInvitation, refreshNotifications]);

  // Handle rejecting invitation
  const handleRejectInvitation = useCallback(async () => {
    if (!id || !isPendingInvitation()) {
      setError("You cannot reject this invitation");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const updatedGame = await rejectGameInvitation(id, rejectionReason);
      
      if (updatedGame) {
        setGame(updatedGame);
        // Refresh notifications when invitation is rejected
        if (refreshNotifications) {
          refreshNotifications();
        }
        navigate('/games');
      } else {
        setError("Failed to reject invitation");
      }
    } catch (err: any) {
      console.error("Error rejecting invitation:", err);
      setError(err.message || "An error occurred while rejecting the invitation");
    } finally {
      setIsSubmitting(false);
    }
  }, [id, isPendingInvitation, rejectionReason, refreshNotifications, navigate]);

  // Handle starting the game
  const handleStartGame = useCallback(async () => {
    if (!id || !isAccepted()) {
      setError("This game is not ready to start");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const updatedGame = await startGame(id);
      
      if (updatedGame) {
        setGame(updatedGame);
        // Refresh notifications when game starts
        if (refreshNotifications) {
          refreshNotifications();
        }
      } else {
        setError("Failed to start the game");
      }
    } catch (err: any) {
      console.error("Error starting game:", err);
      setError(err.message || "An error occurred while starting the game");
    } finally {
      setIsSubmitting(false);
    }
  }, [id, isAccepted, refreshNotifications]);

  // Handle score submission
  const handleScoreSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id || !isParticipant() || !game) {
      setError("You cannot submit scores for this game");
      return;
    }
    
    // Check if it's this player's turn to submit scores
    if (!canSubmitScores()) {
      setError("It's not your turn to submit scores");
      return;
    }

    // Validate scores
    if (creatorScore < 0 || opponentScore < 0) {
      setError("Scores cannot be negative");
      return;
    }
    
    // Make sure one player has reached the winning score
    const maxScore = Math.max(creatorScore, opponentScore);
    if (maxScore < game.settings.pointsToWin) {
      setError(`At least one player must reach ${game.settings.pointsToWin} points to end the game`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const updatedGame = await submitGameScore(id, creatorScore, opponentScore);
      
      if (updatedGame) {
        setGame(updatedGame);
        // Refresh notifications when scores are submitted
        if (refreshNotifications) {
          refreshNotifications();
        }
      } else {
        setError("Failed to submit scores");
      }
    } catch (err: any) {
      console.error("Error submitting scores:", err);
      setError(err.message || "An error occurred while submitting scores");
    } finally {
      setIsSubmitting(false);
    }
  }, [id, isParticipant, game, canSubmitScores, creatorScore, opponentScore, refreshNotifications]);

  // Handle game confirmation
  const handleConfirmation = useCallback(async (isConfirmed: boolean) => {
    if (!id || !needsConfirmation() || !game) {
      setError("You cannot confirm this game");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const updatedGame = await confirmGameResult(id, isConfirmed);
      
      if (updatedGame) {
        setGame(updatedGame);
        // Refresh notifications when game is confirmed
        if (refreshNotifications) {
          refreshNotifications();
        }
      } else {
        setError(isConfirmed ? "Failed to confirm game" : "Failed to dispute game");
      }
    } catch (err: any) {
      console.error("Error confirming game:", err);
      setError(err.message || "An error occurred while confirming the game");
    } finally {
      setIsSubmitting(false);
    }
  }, [id, needsConfirmation, game, refreshNotifications]);

  // Memoized calculations for better performance
  const gameStatus = useMemo(() => {
    if (!game) return null;
    
    return {
      isParticipant: isParticipant(),
      isCreator: isCreator(),
      isOpponent: isOpponent(),
      canSubmitScores: canSubmitScores(),
      isPendingInvitation: isPendingInvitation(),
      isSentInvitation: isSentInvitation(),
      isAccepted: isAccepted(),
      isCurrentUserTurn: isCurrentUserTurn(),
      needsConfirmation: needsConfirmation(),
    };
  }, [game, isParticipant, isCreator, isOpponent, canSubmitScores, isPendingInvitation, isSentInvitation, isAccepted, isCurrentUserTurn, needsConfirmation]);

  // Memoized score validation
  const scoreValidation = useMemo(() => {
    if (!game) return { isValid: false, canSubmit: false };
    
    const maxScore = Math.max(creatorScore, opponentScore);
    const isValid = creatorScore >= 0 && opponentScore >= 0;
    const canSubmit = isValid && maxScore >= game.settings.pointsToWin;
    
    return { isValid, canSubmit, maxScore };
  }, [game, creatorScore, opponentScore]);

  // Memoized loading component
  const LoadingComponent = useMemo(() => (
    <div className="p-6 max-w-6xl mx-auto text-zinc-900 dark:text-white">
      <h1 className="text-2xl font-bold mb-6">Game Details</h1>
      <Card>
        <CardContent className="flex justify-center p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </CardContent>
      </Card>
    </div>
  ), []);

  // Memoized error component
  const ErrorComponent = useMemo(() => (
    <div className="p-6 max-w-6xl mx-auto text-zinc-900 dark:text-white">
      <h1 className="text-2xl font-bold mb-6">Game Details</h1>
      <Card>
        <CardContent className="p-6">
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
            {error || "Game not found"}
          </div>
          <Link to="/games" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md">
            Back to Games
          </Link>
        </CardContent>
      </Card>
    </div>
  ), [error]);

  // Render loading state
  if (loading) {
    return LoadingComponent;
  }

  // Render error state
  if (error || !game) {
    return ErrorComponent;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto text-zinc-900 dark:text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Game Details</h1>
        <Link to="/games" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
          Back to Games
        </Link>
      </div>

      <Card>
        <CardContent className="p-6">
        {/* Game Status */}
        <div className="mb-6">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium 
            ${game.status === "invited" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100" : ""}
            ${game.status === "accepted" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}
            ${game.status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" : ""}
            ${game.status === "in_progress" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" : ""}
            ${game.status === "waiting_confirmation" ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100" : ""}
            ${game.status === "completed" ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100" : ""}
          `}>
            {game.status === "invited" && "Invitation Pending"}
            {game.status === "accepted" && "Ready to Play"}
            {game.status === "rejected" && "Invitation Rejected"}
            {game.status === "in_progress" && "In Progress"}
            {game.status === "waiting_confirmation" && "Waiting for Confirmation"}
            {game.status === "completed" && "Completed"}
          </span>
          
          {game.status === "in_progress" && game.activePlayer && (
            <span className="ml-3 text-sm">
              Current Turn: {game.activePlayer === game.createdBy 
                ? creator?.displayName || "Creator" 
                : opponent?.displayName || "Opponent"}
            </span>
          )}
        </div>

        {/* Game Information */}
        <div className="mb-6 space-y-4">
          <GameModeDisplay gameMode={game.settings.gameMode} />
          <PointsDisplay points={game.settings.pointsToWin} />
          <RulesetDisplay useBoricuaRules={game.settings.useBoricuaRules || false} />
        </div>

        {/* Participants */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Participants</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 p-3 border border-gray-200 dark:border-zinc-700 rounded-md">
              <div className="flex items-center">
                {creator?.photoURL ? (
                  <img 
                    src={creator.photoURL} 
                    alt={creator.displayName} 
                    className="w-10 h-10 rounded-full mr-3"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3">
                    {creator?.displayName.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
                <div>
                  <p className="font-medium">{creator?.displayName || "Unknown"}</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Creator</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 p-3 border border-gray-200 dark:border-zinc-700 rounded-md">
              <div className="flex items-center">
                {opponent?.photoURL ? (
                  <img 
                    src={opponent.photoURL} 
                    alt={opponent.displayName} 
                    className="w-10 h-10 rounded-full mr-3"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3">
                    {opponent?.displayName.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
                <div>
                  <p className="font-medium">{opponent?.displayName || "Unknown"}</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Opponent</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invitation Actions - Only show if this is a pending invitation for the current user */}
        {gameStatus?.isPendingInvitation && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Game Invitation</h2>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-md mb-4">
              <p className="mb-3">
                {creator?.displayName || "A player"} has invited you to play a game of dominoes.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Rejection Reason (optional)
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reason for declining (optional)"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleRejectInvitation}
                  disabled={isSubmitting}
                  className={`py-2 rounded-md font-medium ${
                    isSubmitting
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  {isSubmitting ? "Processing..." : "Decline Invitation"}
                </button>
                <button
                  onClick={handleAcceptInvitation}
                  disabled={isSubmitting}
                  className={`py-2 rounded-md font-medium ${
                    isSubmitting
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  {isSubmitting ? "Processing..." : "Accept Invitation"}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Invitation Sent Status */}
        {gameStatus?.isSentInvitation && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Invitation Sent</h2>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-md mb-4">
              <p>
                Your invitation has been sent to {opponent?.displayName || "the opponent"}. 
                You'll be notified when they accept or decline.
              </p>
            </div>
          </div>
        )}
        
        {/* Ready to Play Status */}
        {gameStatus?.isAccepted && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Ready to Play</h2>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-md mb-4">
              <p className="mb-3">
                Both players have accepted! You're ready to start the game.
              </p>
              <button
                onClick={handleStartGame}
                disabled={isSubmitting}
                className={`w-full py-2 rounded-md font-medium ${
                  isSubmitting
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {isSubmitting ? "Starting Game..." : "Start Game"}
              </button>
            </div>
          </div>
        )}
        
        {/* Rejected Status */}
        {game.status === "rejected" && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Invitation Declined</h2>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-md mb-4">
              <p>
                This game invitation was declined.
              </p>
              {game.rejectionReason && (
                <p className="mt-2">
                  <strong>Reason:</strong> {game.rejectionReason}
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Score Submission - Only show if game is in progress and it's user's turn to submit scores */}
        {game.status === "in_progress" && gameStatus?.isParticipant && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Submit Final Scores</h2>
            
            {!gameStatus?.canSubmitScores ? (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-md mb-4">
                <p>It's not your turn to submit scores. Wait for the active player to finish their turn.</p>
                <p className="mt-2 text-sm">
                  Active player: <span className="font-medium">{game.activePlayer === game.createdBy ? creator?.displayName : opponent?.displayName}</span>
                </p>
              </div>
            ) : (
              <form onSubmit={handleScoreSubmit}>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-md mb-4">
                  <p>You are submitting the final scores for this game. The other player will need to confirm these scores.</p>
                  <p className="mt-2 text-sm">Enter scores for both players. At least one player must reach {game.settings.pointsToWin} points.</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {creator?.displayName || "Creator"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      value={creatorScore}
                      onChange={(e) => setCreatorScore(parseInt(e.target.value) || 0)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {opponent?.displayName || "Opponent"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      value={opponentScore}
                      onChange={(e) => setOpponentScore(parseInt(e.target.value) || 0)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !scoreValidation.canSubmit}
                  className={`w-full py-2 rounded-md font-medium ${
                    isSubmitting || !scoreValidation.canSubmit
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {isSubmitting ? "Submitting..." : "Submit Final Scores"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Confirmation UI - Only show if game is waiting for confirmation from current user */}
        {gameStatus?.needsConfirmation && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Confirm Results</h2>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-md mb-4">
              <p className="mb-3">The other player has submitted the following scores:</p>
              <div className="flex justify-center items-center text-center mb-4">
                <div className="text-center px-6">
                  <p className="text-sm">{creator?.displayName || "Creator"}</p>
                  <p className="text-2xl font-bold">{game.scores?.creator}</p>
                </div>
                
                <div className="text-xl font-bold mx-4">-</div>
                
                <div className="text-center px-6">
                  <p className="text-sm">{opponent?.displayName || "Opponent"}</p>
                  <p className="text-2xl font-bold">{game.scores?.opponent}</p>
                </div>
              </div>
              <p className="mb-3">Are these scores correct?</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleConfirmation(true)}
                  disabled={isSubmitting}
                  className={`py-2 rounded-md font-medium ${
                    isSubmitting
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  {isSubmitting ? "Processing..." : "Confirm"}
                </button>
                <button
                  onClick={() => handleConfirmation(false)}
                  disabled={isSubmitting}
                  className={`py-2 rounded-md font-medium ${
                    isSubmitting
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  {isSubmitting ? "Processing..." : "Dispute"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Final Results - Only show if game is completed */}
        {game.status === "completed" && game.scores && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Final Results</h2>
            <div className={`p-4 rounded-md ${
              game.winner === auth.currentUser?.uid
                ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900"
            }`}>
              <div className="flex justify-center items-center text-center mb-4">
                <div className="text-center px-6">
                  <p className="text-sm">{creator?.displayName || "Creator"}</p>
                  <p className="text-3xl font-bold">{game.scores.creator}</p>
                </div>
                
                <div className="text-xl font-bold mx-4">-</div>
                
                <div className="text-center px-6">
                  <p className="text-sm">{opponent?.displayName || "Opponent"}</p>
                  <p className="text-3xl font-bold">{game.scores.opponent}</p>
                </div>
              </div>
              
              <p className="text-center font-medium">
                {game.winner === (gameStatus?.isCreator ? game.createdBy : game.opponent)
                  ? "You won this game!"
                  : "You lost this game"}
              </p>
            </div>
          </div>
        )}

        {/* Waiting for confirmation message */}
        {game.status === "waiting_confirmation" && !gameStatus?.needsConfirmation && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-md mb-4">
            <p className="text-center">
              Waiting for {gameStatus?.needsConfirmation ? "you" : "the other player"} to confirm the results.
            </p>
          </div>
        )}
        
        {/* Player turns indicator - show only during active gameplay */}
        {game.status === "in_progress" && game.activePlayer && (
          <div className={`p-4 mb-4 rounded-md ${
            gameStatus?.isCurrentUserTurn 
              ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900" 
              : "bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-900"
          }`}>
            <p className="text-center font-medium">
              {gameStatus?.isCurrentUserTurn 
                ? "It's your turn to play and submit the final scores" 
                : `Waiting for ${game.activePlayer === game.createdBy 
                    ? creator?.displayName 
                    : opponent?.displayName} to play and submit the final scores`}
            </p>
            {gameStatus?.isCurrentUserTurn && (
              <p className="text-center text-sm mt-2 text-green-600 dark:text-green-400">
                Play your game in person, then submit the final scores when finished
              </p>
            )}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
};

// Memoize the entire component for better performance
const MemoizedGameDetail = memo(GameDetail);

export default MemoizedGameDetail;