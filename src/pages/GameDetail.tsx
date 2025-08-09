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
  startGame,
  getLeagueById,
  getUserLeaguesWithRanking
} from "../firebase";
import { useGameModeInfo, usePointsInfo, useRulesetInfo } from "../hooks/useGameConfig";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import type { Game, UserProfile } from "../firebase";
import UserProfileModal, { useUserProfileModal } from "../components/UserProfileModal";
import { Avatar } from "../components/avatar";
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
  
  // Combine related states to reduce re-renders
  const [gameState, setGameState] = useState({
    game: null as Game | null,
    creator: null as UserProfile | null,
    opponent: null as UserProfile | null,
    // Team game participants
    team1Players: [] as UserProfile[],
    team2Players: [] as UserProfile[],
    leagueInfo: null as {id: string, name: string, photoURL?: string} | null,
    loading: true,
    error: null as string | null,
  });
  
  const [scoreState, setScoreState] = useState({
    creatorScore: 0,
    opponentScore: 0,
    isSubmitting: false,
  });
  
  const [uiState, setUiState] = useState({
    rejectionReason: "",
  });

  // Use the user profile modal hook
  const { isOpen: isProfileModalOpen, selectedUser, openModal: openProfileModal, closeModal: closeProfileModal } = useUserProfileModal();

  // Destructure for cleaner access
  const { game, creator, opponent, team1Players, team2Players, leagueInfo, loading, error } = gameState;
  const { creatorScore, opponentScore, isSubmitting } = scoreState;
  const { rejectionReason } = uiState;

  // Helper functions for team games
  const getActivePlayerName = useCallback(() => {
    if (!game?.activePlayer) return "Unknown";
    
    if (game.teams) {
      // Team game - find player in teams
      const allPlayers = [...team1Players, ...team2Players];
      const activePlayer = allPlayers.find(p => p.uid === game.activePlayer);
      return activePlayer?.displayName || "Unknown";
    } else {
      // Traditional game
      return game.activePlayer === game.createdBy 
        ? creator?.displayName || "Creator"
        : opponent?.displayName || "Opponent";
    }
  }, [game, creator, opponent, team1Players, team2Players]);

  const getOpponentNames = useCallback(() => {
    if (game?.teams) {
      // For team games, get the opposing team's names
      const currentUserInTeam1 = team1Players.some(p => p.uid === auth.currentUser?.uid);
      const opposingTeam = currentUserInTeam1 ? team2Players : team1Players;
      return opposingTeam.map(p => p.displayName).join(" and ");
    } else {
      return opponent?.displayName || "the opponent";
    }
  }, [game, opponent, team1Players, team2Players]);

  // Get team names for score display
  const getTeamDisplayNames = useCallback(() => {
    if (game?.teams) {
      const team1Name = team1Players.map(p => p.displayName).join(" + ");
      const team2Name = team2Players.map(p => p.displayName).join(" + ");
      return { team1: team1Name, team2: team2Name };
    } else {
      return {
        team1: creator?.displayName || "Creator",
        team2: opponent?.displayName || "Opponent"
      };
    }
  }, [game, creator, opponent, team1Players, team2Players]);

  // Check if current user is part of this game (works for both traditional and team games)
  const isParticipant = useCallback(() => {
    if (!game || !auth.currentUser) return false;
    
    // Check traditional game structure
    if (game.createdBy === auth.currentUser.uid || game.opponent === auth.currentUser.uid) {
      return true;
    }
    
    // Check team game structure
    if (game.teams) {
      const allPlayers = [...(game.teams.team1 || []), ...(game.teams.team2 || [])];
      return allPlayers.includes(auth.currentUser.uid);
    }
    
    return false;
  }, [game]);

  // Check if current user is the creator (for team games, creator is first player of team1)
  const isCreator = useCallback(() => {
    if (!game || !auth.currentUser) return false;
    
    // Traditional game
    if (game.createdBy === auth.currentUser.uid) {
      return true;
    }
    
    // Team game - creator is the first player of team1
    if (game.teams && game.teams.team1 && game.teams.team1.length > 0) {
      return game.teams.team1[0] === auth.currentUser.uid;
    }
    
    return false;
  }, [game]);

  // Check if current user is the opponent (for team games, opponent is first player of team2)
  const isOpponent = useCallback(() => {
    if (!game || !auth.currentUser) return false;
    
    // Traditional game
    if (game.opponent === auth.currentUser.uid) {
      return true;
    }
    
    // Team game - opponent is the first player of team2
    if (game.teams && game.teams.team2 && game.teams.team2.length > 0) {
      return game.teams.team2[0] === auth.currentUser.uid;
    }
    
    return false;
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

  // Optimized batch data loading function
  const loadGameData = useCallback(async (gameId: string) => {
    try {
      setGameState(prev => ({ ...prev, loading: true, error: null }));
      
      // First, get game data
      const gameData = await getGameById(gameId);
      if (!gameData) {
        setGameState(prev => ({ 
          ...prev, 
          loading: false, 
          error: "Game not found" 
        }));
        return;
      }

      // Check if it's a team game
      const isTeamGame = gameData.teams && gameData.teams.team1 && gameData.teams.team2;

      if (isTeamGame) {
        // Load all team players in parallel
        const allPlayerIds = [...gameData.teams!.team1, ...gameData.teams!.team2];
        const playerPromises = allPlayerIds.map(playerId => getUserProfile(playerId));
        const leaguePromise = gameData.leagueId ? getLeagueById(gameData.leagueId) : Promise.resolve(null);
        
        const [playersResults, leagueData] = await Promise.allSettled([
          Promise.allSettled(playerPromises),
          leaguePromise
        ]);

        // Process player results
        const playerProfiles = playersResults.status === 'fulfilled' 
          ? (playersResults.value as PromiseSettledResult<UserProfile | null>[])
            .map(result => result.status === 'fulfilled' ? result.value : null)
            .filter((profile): profile is UserProfile => profile !== null)
          : [];

        // Separate team players
        const team1Players = playerProfiles.filter(profile => 
          gameData.teams!.team1.includes(profile.uid)
        );
        const team2Players = playerProfiles.filter(profile => 
          gameData.teams!.team2.includes(profile.uid)
        );

        // Extract league info
        const league = leagueData.status === 'fulfilled' ? leagueData.value : null;
        const leagueInfo = league ? {
          id: league.id,
          name: league.name,
          photoURL: league.photoURL
        } : null;

        // Update state for team game
        setGameState({
          game: gameData,
          creator: null,
          opponent: null,
          team1Players,
          team2Players,
          leagueInfo,
          loading: false,
          error: null,
        });
      } else {
        // Traditional game - load creator and opponent data in parallel
        const [creatorProfile, opponentProfile, leagueData] = await Promise.allSettled([
          getUserProfile(gameData.createdBy),
          getUserProfile(gameData.opponent),
          gameData.leagueId ? getLeagueById(gameData.leagueId) : Promise.resolve(null)
        ]);

        // Process results safely
        const creator = creatorProfile.status === 'fulfilled' ? creatorProfile.value : null;
        const opponent = opponentProfile.status === 'fulfilled' ? opponentProfile.value : null;
        const league = leagueData.status === 'fulfilled' ? leagueData.value : null;
        
        // Extract league info with photoURL
        const leagueInfo = league ? {
          id: league.id,
          name: league.name,
          photoURL: league.photoURL
        } : null;

        // Update all state at once
        setGameState({
          game: gameData,
          creator,
          opponent,
          team1Players: [],
          team2Players: [],
          leagueInfo,
          loading: false,
          error: null,
        });
      }

      // Initialize scores if they exist
      if (gameData.scores) {
        setScoreState(prev => ({
          ...prev,
          creatorScore: gameData.scores?.creator || 0,
          opponentScore: gameData.scores?.opponent || 0,
        }));
      }
    } catch (err) {
      console.error("Error loading game:", err);
      setGameState(prev => ({ 
        ...prev, 
        loading: false, 
        error: "Failed to load game details" 
      }));
    }
  }, []);

  // Load game data and user profiles
  useEffect(() => {
    if (!id) {
      setGameState(prev => ({ 
        ...prev, 
        loading: false, 
        error: "Game ID is missing" 
      }));
      return;
    }

    loadGameData(id);
    
    // Set up real-time listener for game updates with debouncing
    const db = getFirestore();
    const gameRef = doc(db, "games", id);
    
    let timeoutId: NodeJS.Timeout;
    
    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = { id: docSnapshot.id, ...docSnapshot.data() } as Game;
        
        // Debounce updates to prevent excessive re-renders
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setGameState(prev => ({ ...prev, game: gameData }));
          
          // Update scores if they exist
          if (gameData.scores) {
            setScoreState(prev => ({
              ...prev,
              creatorScore: gameData.scores.creator,
              opponentScore: gameData.scores.opponent,
            }));
          }
        }, 100); // 100ms debounce
      }
    }, (error) => {
      console.error("Error listening to game updates:", error);
    });
    
    // Clean up listener and timeout on unmount
    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [id, loadGameData]);

  // Handle accepting invitation
  const handleAcceptInvitation = useCallback(async () => {
    if (!id || !isPendingInvitation()) {
      setGameState(prev => ({ ...prev, error: "You cannot accept this invitation" }));
      return;
    }

    try {
      setScoreState(prev => ({ ...prev, isSubmitting: true }));
      setGameState(prev => ({ ...prev, error: null }));

      const updatedGame = await acceptGameInvitation(id);
      
      if (updatedGame) {
        setGameState(prev => ({ ...prev, game: updatedGame }));
        // Refresh notifications when invitation is accepted
        if (refreshNotifications) {
          refreshNotifications();
        }
      } else {
        setGameState(prev => ({ ...prev, error: "Failed to accept invitation" }));
      }
    } catch (err: any) {
      console.error("Error accepting invitation:", err);
      setGameState(prev => ({ 
        ...prev, 
        error: err.message || "An error occurred while accepting the invitation" 
      }));
    } finally {
      setScoreState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [id, isPendingInvitation, refreshNotifications]);

  // Handle rejecting invitation
  const handleRejectInvitation = useCallback(async () => {
    if (!id || !isPendingInvitation()) {
      setGameState(prev => ({ ...prev, error: "You cannot reject this invitation" }));
      return;
    }

    try {
      setScoreState(prev => ({ ...prev, isSubmitting: true }));
      setGameState(prev => ({ ...prev, error: null }));

      const updatedGame = await rejectGameInvitation(id, rejectionReason);
      
      if (updatedGame) {
        setGameState(prev => ({ ...prev, game: updatedGame }));
        // Refresh notifications when invitation is rejected
        if (refreshNotifications) {
          refreshNotifications();
        }
        navigate('/games');
      } else {
        setGameState(prev => ({ ...prev, error: "Failed to reject invitation" }));
      }
    } catch (err: any) {
      console.error("Error rejecting invitation:", err);
      setGameState(prev => ({ 
        ...prev, 
        error: err.message || "An error occurred while rejecting the invitation" 
      }));
    } finally {
      setScoreState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [id, isPendingInvitation, rejectionReason, refreshNotifications, navigate]);

  // Handle starting the game
  const handleStartGame = useCallback(async () => {
    if (!id || !isAccepted()) {
      setGameState(prev => ({ ...prev, error: "This game is not ready to start" }));
      return;
    }

    try {
      setScoreState(prev => ({ ...prev, isSubmitting: true }));
      setGameState(prev => ({ ...prev, error: null }));

      const updatedGame = await startGame(id);
      
      if (updatedGame) {
        setGameState(prev => ({ ...prev, game: updatedGame }));
        // Refresh notifications when game starts
        if (refreshNotifications) {
          refreshNotifications();
        }
      } else {
        setGameState(prev => ({ ...prev, error: "Failed to start the game" }));
      }
    } catch (err: any) {
      console.error("Error starting game:", err);
      setGameState(prev => ({ 
        ...prev, 
        error: err.message || "An error occurred while starting the game" 
      }));
    } finally {
      setScoreState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [id, isAccepted, refreshNotifications]);

  // Handle score submission
  const handleScoreSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id || !isParticipant() || !game) {
      setGameState(prev => ({ ...prev, error: "You cannot submit scores for this game" }));
      return;
    }
    
    // Check if it's this player's turn to submit scores
    if (!canSubmitScores()) {
      setGameState(prev => ({ ...prev, error: "It's not your turn to submit scores" }));
      return;
    }

    // Validate scores
    if (creatorScore < 0 || opponentScore < 0) {
      setGameState(prev => ({ ...prev, error: "Scores cannot be negative" }));
      return;
    }
    
    // Make sure one player has reached the winning score
    const maxScore = Math.max(creatorScore, opponentScore);
    if (maxScore < game.settings.pointsToWin) {
      setGameState(prev => ({ 
        ...prev, 
        error: `At least one player must reach ${game.settings.pointsToWin} points to end the game` 
      }));
      return;
    }

    try {
      setScoreState(prev => ({ ...prev, isSubmitting: true }));
      setGameState(prev => ({ ...prev, error: null }));

      const updatedGame = await submitGameScore(id, creatorScore, opponentScore);
      
      if (updatedGame) {
        setGameState(prev => ({ ...prev, game: updatedGame }));
        // Refresh notifications when scores are submitted
        if (refreshNotifications) {
          refreshNotifications();
        }
      } else {
        setGameState(prev => ({ ...prev, error: "Failed to submit scores" }));
      }
    } catch (err: any) {
      console.error("Error submitting scores:", err);
      setGameState(prev => ({ 
        ...prev, 
        error: err.message || "An error occurred while submitting scores" 
      }));
    } finally {
      setScoreState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [id, isParticipant, game, canSubmitScores, creatorScore, opponentScore, refreshNotifications]);

  // Handle game confirmation
  const handleConfirmation = useCallback(async (isConfirmed: boolean) => {
    if (!id || !needsConfirmation() || !game) {
      setGameState(prev => ({ ...prev, error: "You cannot confirm this game" }));
      return;
    }

    try {
      setScoreState(prev => ({ ...prev, isSubmitting: true }));
      setGameState(prev => ({ ...prev, error: null }));

      const updatedGame = await confirmGameResult(id, isConfirmed);
      
      if (updatedGame) {
        setGameState(prev => ({ ...prev, game: updatedGame }));
        // Refresh notifications when game is confirmed
        if (refreshNotifications) {
          refreshNotifications();
        }
      } else {
        setGameState(prev => ({ 
          ...prev, 
          error: isConfirmed ? "Failed to confirm game" : "Failed to dispute game" 
        }));
      }
    } catch (err: any) {
      console.error("Error confirming game:", err);
      setGameState(prev => ({ 
        ...prev, 
        error: err.message || "An error occurred while confirming the game" 
      }));
    } finally {
      setScoreState(prev => ({ ...prev, isSubmitting: false }));
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

  // Profile modal handlers - now simplified
  const handleUserClick = useCallback((user: UserProfile) => {
    openProfileModal(user);
  }, [openProfileModal]);

  // Memoized loading component
  const LoadingComponent = useMemo(() => (
    <div className="p-4 sm:p-6 max-w-sm sm:max-w-6xl mx-auto text-zinc-900 dark:text-white">
      <h1 className="text-xl sm:text-2xl font-bold mb-6">Game Details</h1>
      <Card>
        <CardContent className="flex justify-center p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </CardContent>
      </Card>
    </div>
  ), []);

  // Memoized error component
  const ErrorComponent = useMemo(() => (
    <div className="p-4 sm:p-6 max-w-sm sm:max-w-6xl mx-auto text-zinc-900 dark:text-white">
      <h1 className="text-xl sm:text-2xl font-bold mb-6">Game Details</h1>
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
    <div className="p-4 sm:p-6 max-w-sm sm:max-w-6xl mx-auto text-zinc-900 dark:text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Game Details</h1>
        <Link to="/games" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm sm:text-base">
          Back to Games
        </Link>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
        {/* Game Status */}
        <div className="mb-4 sm:mb-6">
          <span className={`inline-block px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium 
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
            <span className="ml-2 sm:ml-3 text-xs sm:text-sm block sm:inline mt-2 sm:mt-0">
              Current Turn: {getActivePlayerName()}
            </span>
          )}
        </div>

        {/* Game Information */}
        <div className="mb-6 space-y-4">
          <GameModeDisplay gameMode={game.settings.gameMode} />
          <PointsDisplay points={game.settings.pointsToWin} />
          <RulesetDisplay useBoricuaRules={game.settings.useBoricuaRules || false} />
          
          {/* Game Date */}
          <div className="p-3 bg-gray-50 dark:bg-zinc-700 rounded-md">
            <p className="text-sm text-gray-500 dark:text-zinc-400">Created</p>
            <p className="font-medium">
              {game.createdAt ? new Date(game.createdAt.toDate()).toLocaleString() : "Unknown"}
            </p>
          </div>
          
          {/* League Information */}
          {leagueInfo && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-md">
              <div className="flex items-center">
                {/* League Avatar */}
                <Avatar 
                  src={leagueInfo.photoURL || undefined} 
                  initials={leagueInfo.name.substring(0, 2).toUpperCase()}
                  alt={`${leagueInfo.name} league`}
                  className="h-12 w-12 mr-3 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-blue-600 dark:text-blue-400">League Game</p>
                  <p className="font-medium text-blue-800 dark:text-blue-200 truncate">{leagueInfo.name}</p>
                  {/* Add link to league if desired */}
                  <Link 
                    to={`/leagues/${leagueInfo.id}`}
                    className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    View League Details →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3">
            {game.teams ? "Teams (2 vs 2)" : "Participants"}
          </h2>
          
          {game.teams ? (
            /* Team Game Display */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Team 1 */}
              <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10">
                <div className="flex items-center mb-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <h3 className="font-medium text-blue-700 dark:text-blue-300">Team 1</h3>
                </div>
                <div className="space-y-3">
                  {team1Players.map((player, index) => (
                    <div 
                      key={player.uid}
                      className="flex items-center p-2 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/20 transition-colors cursor-pointer"
                      onClick={() => handleUserClick(player)}
                    >
                      {player.photoURL ? (
                        <img 
                          src={player.photoURL} 
                          alt={player.displayName} 
                          className="w-8 h-8 rounded-full mr-2"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center mr-2 text-sm">
                          {player.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-sm">{player.displayName}</p>
                        {index === 0 && (
                          <p className="text-xs text-blue-600 dark:text-blue-400">Team Captain</p>
                        )}
                        {player.stats && (
                          <div className="flex space-x-2 mt-1">
                            <span className="text-xs text-green-600 dark:text-green-400">
                              {player.stats.gamesWon}W
                            </span>
                            <span className="text-xs text-blue-600 dark:text-blue-400">
                              {player.stats.gamesPlayed}GP
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team 2 */}
              <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/10">
                <div className="flex items-center mb-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                  <h3 className="font-medium text-red-700 dark:text-red-300">Team 2</h3>
                </div>
                <div className="space-y-3">
                  {team2Players.map((player, index) => (
                    <div 
                      key={player.uid}
                      className="flex items-center p-2 rounded-md hover:bg-red-100 dark:hover:bg-red-800/20 transition-colors cursor-pointer"
                      onClick={() => handleUserClick(player)}
                    >
                      {player.photoURL ? (
                        <img 
                          src={player.photoURL} 
                          alt={player.displayName} 
                          className="w-8 h-8 rounded-full mr-2"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center mr-2 text-sm">
                          {player.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-sm">{player.displayName}</p>
                        {index === 0 && (
                          <p className="text-xs text-red-600 dark:text-red-400">Team Captain</p>
                        )}
                        {player.stats && (
                          <div className="flex space-x-2 mt-1">
                            <span className="text-xs text-green-600 dark:text-green-400">
                              {player.stats.gamesWon}W
                            </span>
                            <span className="text-xs text-blue-600 dark:text-blue-400">
                              {player.stats.gamesPlayed}GP
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Traditional Game Display */
            <div className="flex flex-col sm:flex-row gap-4">
              <div 
                className="flex-1 p-3 border border-gray-200 dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                onClick={() => creator && handleUserClick(creator)}
              >
                <div className="flex items-center">
                  {creator?.photoURL ? (
                    <img 
                      src={creator.photoURL} 
                      alt={creator.displayName} 
                      className="w-12 h-12 rounded-full mr-3"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3">
                      {creator?.displayName.charAt(0).toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{creator?.displayName || "Unknown"}</p>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">Creator</p>
                    {creator?.stats && (
                      <div className="flex space-x-4 mt-1">
                        <span className="text-xs text-green-600 dark:text-green-400">
                          {creator.stats.gamesWon} wins
                        </span>
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {creator.stats.gamesPlayed} games
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div 
                className="flex-1 p-3 border border-gray-200 dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                onClick={() => opponent && handleUserClick(opponent)}
              >
                <div className="flex items-center">
                  {opponent?.photoURL ? (
                    <img 
                      src={opponent.photoURL} 
                      alt={opponent.displayName} 
                      className="w-12 h-12 rounded-full mr-3"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3">
                      {opponent?.displayName.charAt(0).toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{opponent?.displayName || "Unknown"}</p>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">Opponent</p>
                    {opponent?.stats && (
                      <div className="flex space-x-4 mt-1">
                        <span className="text-xs text-green-600 dark:text-green-400">
                          {opponent.stats.gamesWon} wins
                        </span>
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {opponent.stats.gamesPlayed} games
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Invitation Actions - Only show if this is a pending invitation for the current user */}
        {gameStatus?.isPendingInvitation && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Game Invitation</h2>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-md mb-4">
              <p className="mb-3">
                {game.teams 
                  ? `${team1Players[0]?.displayName || "A player"} has invited you to play a team game of dominoes (2 vs 2).`
                  : `${creator?.displayName || "A player"} has invited you to play a game of dominoes.`
                }
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Rejection Reason (optional)
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setUiState(prev => ({ ...prev, rejectionReason: e.target.value }))}
                  placeholder="Reason for declining (optional)"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                Your invitation has been sent to {getOpponentNames()}. 
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
                  Active player: <span className="font-medium">{getActivePlayerName()}</span>
                </p>
              </div>
            ) : (
              <form onSubmit={handleScoreSubmit}>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-md mb-4">
                  <p>You are submitting the final scores for this game. The other player will need to confirm these scores.</p>
                  <p className="mt-2 text-sm">Enter scores for both players. At least one player must reach {game.settings.pointsToWin} points.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {getTeamDisplayNames().team1}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      value={creatorScore}
                      onChange={(e) => setScoreState(prev => ({ ...prev, creatorScore: parseInt(e.target.value) || 0 }))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {getTeamDisplayNames().team2}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      value={opponentScore}
                      onChange={(e) => setScoreState(prev => ({ ...prev, opponentScore: parseInt(e.target.value) || 0 }))}
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
              <p className="mb-3">The other {game.teams ? "team" : "player"} has submitted the following scores:</p>
              <div className="flex justify-center items-center text-center mb-4">
                <div className="text-center px-6">
                  <p className="text-sm">{getTeamDisplayNames().team1}</p>
                  <p className="text-2xl font-bold">{game.scores?.creator || game.scores?.team1 || 0}</p>
                </div>
                
                <div className="text-xl font-bold mx-4">-</div>
                
                <div className="text-center px-6">
                  <p className="text-sm">{getTeamDisplayNames().team2}</p>
                  <p className="text-2xl font-bold">{game.scores?.opponent || game.scores?.team2 || 0}</p>
                </div>
              </div>
              <p className="mb-3">Are these scores correct?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
            <div className="p-4 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900">
              <div className="flex justify-center items-center text-center mb-4">
                <div className="text-center px-6">
                  <p className="text-sm">{getTeamDisplayNames().team1}</p>
                  <p className="text-3xl font-bold">{game.scores.creator || game.scores.team1 || 0}</p>
                </div>
                
                <div className="text-xl font-bold mx-4">-</div>
                
                <div className="text-center px-6">
                  <p className="text-sm">{getTeamDisplayNames().team2}</p>
                  <p className="text-3xl font-bold">{game.scores.opponent || game.scores.team2 || 0}</p>
                </div>
              </div>
              
              <p className="text-center font-medium">
                {game.teams ? "Team game completed" : "Game completed"}
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
                ? `It's your turn to play and submit the final scores${game.teams ? " for your team" : ""}` 
                : `Waiting for ${getActivePlayerName()} to play and submit the final scores`}
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
const MemoizedGameDetail = memo(GameDetail);

export default MemoizedGameDetail;