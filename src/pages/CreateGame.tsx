import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getGamePreferences, GamePreferences } from "../utils/gamePreferences";
import { useGameDefaults, useGameOptions } from "../hooks/useGameConfig";
import { useNavigate, Link } from "react-router-dom";
import { auth, createGame, createTeamGame, searchUsers, isPlayerInActiveGame, GameMode, UserProfile, getAllActiveLeagues } from "../firebase";
import { ArrowLeftIcon, InformationCircleIcon, ExclamationTriangleIcon, XMarkIcon, UserPlusIcon } from "@heroicons/react/24/solid";
import { Select } from "../components/select";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

const CreateGame: React.FC = () => {
  const navigate = useNavigate();
  
  // Dynamic game configuration hooks
  const { defaults: gameDefaults, loading: defaultsLoading } = useGameDefaults();
  const { options: gameOptions } = useGameOptions();
  
  // Game configuration state - completely dynamic, no hardcoded values
  const [gameConfig, setGameConfig] = useState<{
    gameMode: string;
    pointsToWin: number;
    numberOfPlayers: number;
    startingPlayer: string;
    ruleset: string;
    selectedLeague: string;
    timeLimit?: number; // Optional time limit from league settings
  } | null>(null);
  
  // Initialize game config with user defaults when they load
  useEffect(() => {
    if (gameDefaults && !defaultsLoading && !gameConfig) {
      // Calculate initial numberOfPlayers based on gameMode from config
      const initialPlayers = gameDefaults.gameMode === "double" ? 4 : 2;
      
      setGameConfig({
        gameMode: gameDefaults.gameMode,
        pointsToWin: gameDefaults.points,
        numberOfPlayers: initialPlayers,
        startingPlayer: "creator", // This could also come from config in the future
        ruleset: gameDefaults.ruleset,
        selectedLeague: ""
      });
    }
  }, [gameDefaults, defaultsLoading, gameConfig]);
  
  // League state
  const [availableLeagues, setAvailableLeagues] = useState<{id: string, name: string, settings: any}[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [leagueSettingsApplied, setLeagueSettingsApplied] = useState(false);
  
  // Selected opponents with full profile data - Enhanced for team support
  const [selectedOpponents, setSelectedOpponents] = useState<UserProfile[]>([]);
  
  // Team assignments for double mode (2 vs 2)
  const [teamAssignments, setTeamAssignments] = useState<{
    team1: UserProfile[]; // Current user + partner
    team2: UserProfile[]; // Opponents team
  }>({
    team1: [],
    team2: []
  });
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  
  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeStep, setActiveStep] = useState(1); // 1: Game settings, 2: Player selection
  const [isInActiveGame, setIsInActiveGame] = useState(false);
  const [isCheckingGameStatus, setIsCheckingGameStatus] = useState(true);
  
  // Calculate max opponents and team structure based on game mode and number of players
  const getGameStructure = () => {
    if (!gameConfig) return { maxOpponents: 1, isTeamGame: false, teamsNeeded: false };
    
    const isTeamGame = gameConfig.gameMode === "double" && gameConfig.numberOfPlayers === 4;
    
    if (isTeamGame) {
      // 2 vs 2: Need 3 other players (1 partner + 2 opponents)
      return { 
        maxOpponents: 3, 
        isTeamGame: true, 
        teamsNeeded: true,
        team1Size: 2, // Current user + 1 partner
        team2Size: 2  // 2 opponents
      };
    } else {
      // Head-to-head or other modes: numberOfPlayers - 1
      return { 
        maxOpponents: gameConfig.numberOfPlayers - 1, 
        isTeamGame: false, 
        teamsNeeded: false,
        team1Size: 1, // Just current user
        team2Size: gameConfig.numberOfPlayers - 1
      };
    }
  };
  
  // Helper function for backward compatibility
  const getMaxOpponents = () => {
    return getGameStructure().maxOpponents;
  };
  
  // Helper function to convert ruleset to boolean for backward compatibility
  const getUseBoricuaRules = useCallback(() => {
    if (!gameConfig) return false;
    return gameConfig.ruleset === "boricua";
  }, [gameConfig?.ruleset]);
  
  // Helper function to check if a specific setting is controlled by league
  const isLeagueControlled = useCallback((setting: string) => {
    if (!leagueSettingsApplied || !gameConfig?.selectedLeague) return false;
    
    const selectedLeague = availableLeagues.find(league => league.id === gameConfig.selectedLeague);
    if (!selectedLeague?.settings) return false;
    
    // Check which settings are controlled by the league
    const leagueControlledSettings = {
      gameMode: true, // League always controls game mode
      pointsToWin: true, // League always controls points to win
      ruleset: true, // League always controls ruleset
      timeLimit: selectedLeague.settings.timeLimit !== undefined, // Only if league has set a time limit
      maxPlayers: false, // This is typically not controlled by league in game creation
      numberOfPlayers: false // This is user choice within league constraints
    };
    
    return leagueControlledSettings[setting as keyof typeof leagueControlledSettings] || false;
  }, [leagueSettingsApplied, gameConfig?.selectedLeague, availableLeagues]);
  
  // Get constraints from selected league
  const getLeagueConstraints = useCallback(() => {
    if (!gameConfig?.selectedLeague) return null;
    
    const selectedLeague = availableLeagues.find(league => league.id === gameConfig.selectedLeague);
    if (!selectedLeague?.settings) return null;
    
    return {
      gameMode: selectedLeague.settings.gameMode,
      pointsToWin: selectedLeague.settings.pointsToWin,
      ruleset: selectedLeague.settings.ruleset || (selectedLeague.settings.useBoricuaRules ? "boricua" : "standard"),
      timeLimit: selectedLeague.settings.timeLimit,
      maxPlayers: selectedLeague.settings.maxPlayers,
      // Additional constraints that affect game creation
      requireConfirmation: selectedLeague.settings.requireConfirmation,
      penaltiesEnabled: selectedLeague.settings.penaltiesEnabled
    };
  }, [gameConfig?.selectedLeague, availableLeagues]);
  
  // Team management functions
  const assignPlayerToTeam = useCallback((player: UserProfile, team: 'team1' | 'team2') => {
    const gameStructure = getGameStructure();
    if (!gameStructure.teamsNeeded) return;
    
    setTeamAssignments(prev => {
      const newAssignments = { ...prev };
      
      // Remove player from both teams first
      newAssignments.team1 = newAssignments.team1.filter(p => p.uid !== player.uid);
      newAssignments.team2 = newAssignments.team2.filter(p => p.uid !== player.uid);
      
      // Add to specified team if there's space
      const targetTeam = newAssignments[team];
      const maxTeamSize = team === 'team1' ? gameStructure.team1Size - 1 : gameStructure.team2Size; // -1 for team1 because current user is implicit
      
      if (targetTeam.length < maxTeamSize) {
        targetTeam.push(player);
      }
      
      return newAssignments;
    });
  }, []);
  
  const removePlayerFromTeams = useCallback((playerId: string) => {
    setTeamAssignments(prev => ({
      team1: prev.team1.filter(p => p.uid !== playerId),
      team2: prev.team2.filter(p => p.uid !== playerId)
    }));
  }, []);
  
  const getPlayerTeam = useCallback((playerId: string): 'team1' | 'team2' | null => {
    if (teamAssignments.team1.some(p => p.uid === playerId)) return 'team1';
    if (teamAssignments.team2.some(p => p.uid === playerId)) return 'team2';
    return null;
  }, [teamAssignments]);
  
  const isTeamComplete = useCallback((team: 'team1' | 'team2'): boolean => {
    const gameStructure = getGameStructure();
    if (!gameStructure.teamsNeeded) return true;
    
    const requiredSize = team === 'team1' ? gameStructure.team1Size - 1 : gameStructure.team2Size; // -1 for team1 (current user)
    return teamAssignments[team].length === requiredSize;
  }, [teamAssignments]);
  
  // Memoized available game modes from dynamic config
  const availableGameModes = useMemo(() => {
    if (!gameOptions) return [];
    return gameOptions.gameModes.map(mode => ({
      value: mode.value,
      label: mode.label,
      description: mode.description
    }));
  }, [gameOptions]);
  
  // Memoized available points options from dynamic config
  const availablePointsOptions = useMemo(() => {
    if (!gameOptions) return [];
    return gameOptions.pointsOptions.map(option => ({
      value: option.value,
      label: option.label,
      description: option.description
    }));
  }, [gameOptions]);
  
  // Memoized available rulesets from dynamic config
  const availableRulesets = useMemo(() => {
    if (!gameOptions) return [];
    return gameOptions.rulesets.map(ruleset => ({
      value: ruleset.value,
      label: ruleset.label,
      description: ruleset.description
    }));
  }, [gameOptions]);
  
  // Load all active leagues on component mount
  useEffect(() => {
    const loadUserLeagues = async () => {
      try {
        // Only show leagues the user belongs to
        const { getUserLeagues } = await import("../firebase");
        const leagues = await getUserLeagues();
        setAvailableLeagues(leagues);
      } catch (error) {
        console.error('Error loading user leagues:', error);
      } finally {
        setLoadingLeagues(false);
      }
    };

    loadUserLeagues();
  }, []);

  // Apply league settings when a league is selected
  useEffect(() => {
    const selectedLeague = availableLeagues.find(league => league.id === gameConfig?.selectedLeague);
    if (selectedLeague && selectedLeague.settings && gameConfig) {
      // Create updated config object with league settings
      const leagueRuleset = selectedLeague.settings.ruleset || 
                           (selectedLeague.settings.useBoricuaRules ? "boricua" : "standard");
      
      setGameConfig(prev => prev ? {
        ...prev,
        // Apply core game settings from league
        gameMode: selectedLeague.settings.gameMode,
        pointsToWin: selectedLeague.settings.pointsToWin,
        ruleset: leagueRuleset,
        // Apply time limit if set in league
        ...(selectedLeague.settings.timeLimit && { timeLimit: selectedLeague.settings.timeLimit })
      } : prev);
      setLeagueSettingsApplied(true);
    } else {
      setLeagueSettingsApplied(false);
    }
    
    // Clear search results when league changes to avoid showing incorrect results
    setSearchResults([]);
    setSearchTerm("");
  }, [gameConfig?.selectedLeague, availableLeagues]);
  
  // Check if user is already in an active game
  useEffect(() => {
    const checkActiveGame = async () => {
      if (!auth.currentUser) return;
      
      setIsCheckingGameStatus(true);
      try {
        const hasActiveGame = await isPlayerInActiveGame(auth.currentUser.uid);
        setIsInActiveGame(hasActiveGame);
        
        if (hasActiveGame) {
          setError("You already have an active game. You must complete it before creating a new one.");
        }
      } catch (error) {
        console.error("Error checking active game status:", error);
      } finally {
        setIsCheckingGameStatus(false);
      }
    };
    
    checkActiveGame();
  }, []);
  
      // Handle opponent search
  useEffect(() => {
    const searchOpponents = async () => {
      if (searchTerm.length < 3) {
        setSearchResults([]);
        return;
      }
      
      setIsSearching(true);
      try {
        let results: UserProfile[] = [];
        
        if (gameConfig?.selectedLeague) {
          // League-specific search: only search among league members
          const db = getFirestore();
          
          // First, get all active members of the selected league
          const memberQuery = query(
            collection(db, "leagueMemberships"),
            where("leagueId", "==", gameConfig.selectedLeague),
            where("status", "==", "active")
          );
          
          const memberSnap = await getDocs(memberQuery);
          const leagueUserIds: string[] = [];
          
          memberSnap.forEach((doc) => {
            leagueUserIds.push(doc.data().userId);
          });
          
          // If no members found, return empty results
          if (leagueUserIds.length === 0) {
            setSearchResults([]);
            setIsSearching(false);
            return;
          }
          
          // Now search for users, but only include league members
          const allResults = await searchUsers(searchTerm);
          results = allResults.filter(user => leagueUserIds.includes(user.uid));
        } else {
          // Global search: search all users
          results = await searchUsers(searchTerm);
        }
        
        // Filter out already selected opponents and current user
        const filteredResults = results.filter(user => {
          const isCurrentUser = auth.currentUser && user.uid === auth.currentUser.uid;
          const isAlreadySelected = selectedOpponents.some(opponent => opponent.uid === user.uid);
          return !isCurrentUser && !isAlreadySelected;
        });
        
        setSearchResults(filteredResults);
      } catch (error) {
        console.error("Error searching opponents:", error);
      } finally {
        setIsSearching(false);
      }
    };
    
    const debounce = setTimeout(searchOpponents, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, selectedOpponents, gameConfig?.selectedLeague]);
  
  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!gameConfig) return;
    
    const { name, value } = e.target;
    setGameConfig(prev => prev ? { ...prev, [name]: value } : prev);
  };
  
  // Handle radio/checkbox changes - completely dynamic based on config
  const handleOptionChange = (name: string, value: any) => {
    if (!gameConfig) return;
    
    // If changing game mode, ensure numberOfPlayers is valid based on dynamic config
    if (name === "gameMode") {
      // Find the selected game mode to determine valid player counts
      const selectedMode = gameOptions?.gameModes.find(mode => mode.value === value);
      
      // Determine appropriate numberOfPlayers based on the new game mode
      let newNumberOfPlayers = gameConfig.numberOfPlayers;
      
      if (value === "double") {
        // For double mode, keep current if it's valid (2 or 4), otherwise default to 4
        newNumberOfPlayers = [2, 4].includes(gameConfig.numberOfPlayers) ? gameConfig.numberOfPlayers : 4;
      } else {
        // For single mode or other modes, default to 2 players
        newNumberOfPlayers = 2;
      }
      
      setGameConfig(prev => prev ? ({
        ...prev,
        gameMode: value,
        numberOfPlayers: newNumberOfPlayers
      }) : prev);
    } else {
      setGameConfig(prev => prev ? ({ ...prev, [name]: value }) : prev);
    }
    
    // If changing game mode or number of players, check if we need to adjust selected opponents
    if ((name === "gameMode" || name === "numberOfPlayers") && selectedOpponents.length > 0) {
      // Recalculate max opponents based on new settings
      const newGameConfig = { ...gameConfig, [name]: value };
      let newMaxOpponents = 1;
      
      if (name === "gameMode") {
        newMaxOpponents = value === "double" ? 
          (gameConfig.numberOfPlayers === 4 ? 3 : 1) : 
          (gameConfig.numberOfPlayers - 1);
      } else if (name === "numberOfPlayers") {
        newMaxOpponents = gameConfig.gameMode === "double" && value === 4 ? 3 : 1;
      }
      
      if (selectedOpponents.length > newMaxOpponents) {
        setSelectedOpponents(prev => prev.slice(0, newMaxOpponents));
        setError(`Game mode changed. Maximum number of opponents is now ${newMaxOpponents}.`);
      }
    }
  };
  
  // Handle opponent selection with team support
  const handleSelectOpponent = (user: UserProfile) => {
    // Check if opponent is already selected
    if (selectedOpponents.some(opponent => opponent.uid === user.uid)) {
      return;
    }
    
    // Check if we've reached the maximum number of opponents
    const maxOpponents = getMaxOpponents();
    
    if (selectedOpponents.length >= maxOpponents) {
      setError(`You can only select ${maxOpponents} opponent(s) for this game mode`);
      return;
    }
    
    // Add opponent to selectedOpponents
    setSelectedOpponents(prev => [...prev, user]);
    
    // For team games, automatically assign to a team if possible
    const gameStructure = getGameStructure();
    if (gameStructure.teamsNeeded) {
      // Try to assign to team2 first (opponents), then team1 (partner)
      if (!isTeamComplete('team2')) {
        assignPlayerToTeam(user, 'team2');
      } else if (!isTeamComplete('team1')) {
        assignPlayerToTeam(user, 'team1');
      }
    }
    
    // Clear search input and error
    setSearchTerm("");
    setError(null);
  };
  
  // Remove opponent from selection and teams
  const handleRemoveOpponent = (uid: string) => {
    setSelectedOpponents(prev => prev.filter(opponent => opponent.uid !== uid));
    removePlayerFromTeams(uid);
    setError(null);
  };
  
  // Navigate between steps
  const goToNextStep = () => {
    setActiveStep(2);
    setError(null);
  };
  
  const goToPrevStep = () => {
    setActiveStep(1);
  };
  
  // Handle form submission - completely dynamic
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!auth.currentUser) {
      setError("You must be logged in to create a game");
      return;
    }
    
    if (!gameConfig) {
      setError("Game configuration not loaded. Please try again.");
      return;
    }
    
    // Require league selection
    if (!gameConfig.selectedLeague) {
      setError("You must belong to a league to create a game. Please select a league.");
      return;
    }
    
    // Check if we have the correct number of opponents and proper team setup
    const requiredOpponents = getMaxOpponents();
    const gameStructure = getGameStructure();
    
    if (selectedOpponents.length !== requiredOpponents) {
      setError(`Please select ${requiredOpponents} ${gameStructure.teamsNeeded ? 'players' : 'opponent(s)'} for this game mode`);
      return;
    }
    
    // Additional validation for team games
    if (gameStructure.teamsNeeded) {
      if (!isTeamComplete('team1')) {
        setError('Please assign 1 partner to your team');
        return;
      }
      if (!isTeamComplete('team2')) {
        setError('Please assign 2 players to the opposing team');
        return;
      }
      
      // Verify no player is assigned to both teams (shouldn't happen, but safety check)
      const allAssignedPlayers = [...teamAssignments.team1, ...teamAssignments.team2];
      const uniquePlayerIds = new Set(allAssignedPlayers.map(p => p.uid));
      if (allAssignedPlayers.length !== uniquePlayerIds.size) {
        setError('A player cannot be on both teams. Please check team assignments.');
        return;
      }
      
      // Verify all selected opponents are assigned to teams
      const unassignedPlayers = selectedOpponents.filter(p => !getPlayerTeam(p.uid));
      if (unassignedPlayers.length > 0) {
        setError(`Please assign ${unassignedPlayers.length} unassigned player(s) to teams`);
        return;
      }
    }
    
    // Validate against league constraints
    const leagueConstraints = getLeagueConstraints();
    if (leagueConstraints) {
      // Ensure game configuration matches league settings
      if (gameConfig.gameMode !== leagueConstraints.gameMode) {
        setError(`Game mode must be "${leagueConstraints.gameMode}" as set by the league`);
        return;
      }
      
      if (gameConfig.pointsToWin !== leagueConstraints.pointsToWin) {
        setError(`Points to win must be ${leagueConstraints.pointsToWin} as set by the league`);
        return;
      }
      
      if (gameConfig.ruleset !== leagueConstraints.ruleset) {
        setError(`Game rules must follow "${leagueConstraints.ruleset}" as set by the league`);
        return;
      }
      
      // Check if number of players is within league limits
      if (gameConfig.numberOfPlayers > leagueConstraints.maxPlayers) {
        setError(`Number of players cannot exceed ${leagueConstraints.maxPlayers} as set by the league`);
        return;
      }
    }
    
    setIsCreating(true);
    setError(null);
    
    try {
      // Check if the user is in an active game before creating a new one
      const hasActiveGame = await isPlayerInActiveGame(auth.currentUser.uid);
      if (hasActiveGame) {
        setError("You already have an active game. You must complete it before creating a new one.");
        setIsCreating(false);
        return;
      }
      
      let game;
      
      // Use team-based game creation for team games, regular for head-to-head
      if (gameStructure.teamsNeeded) {
        // Extract opponent UIDs for team game
        const opponentIds = selectedOpponents.map(p => p.uid);
        
        // Prepare team structure
        const teams = {
          team1: teamAssignments.team1.map(p => p.uid), // Partners (excluding creator who is added automatically)
          team2: teamAssignments.team2.map(p => p.uid)  // Opponents
        };
        
        game = await createTeamGame(opponentIds, {
          gameMode: gameConfig.gameMode as GameMode,
          pointsToWin: parseInt(gameConfig.pointsToWin.toString()),
          numberOfPlayers: gameConfig.numberOfPlayers,
          startingPlayer: gameConfig.startingPlayer,
          useBoricuaRules: getUseBoricuaRules(),
          ruleset: gameConfig.ruleset,
          leagueId: gameConfig.selectedLeague || undefined
        }, teams);
      } else {
        // Traditional head-to-head game
        game = await createGame(selectedOpponents[0].uid, {
          gameMode: gameConfig.gameMode as GameMode,
          pointsToWin: parseInt(gameConfig.pointsToWin.toString()),
          numberOfPlayers: gameConfig.numberOfPlayers,
          startingPlayer: gameConfig.startingPlayer,
          useBoricuaRules: getUseBoricuaRules(),
          ruleset: gameConfig.ruleset,
          leagueId: gameConfig.selectedLeague || undefined
        });
      }
      
      if (game && game.id) {
        navigate(`/game/${game.id}`);
      } else {
        setError("Failed to create game");
      }
    } catch (error: any) {
      console.error("Error creating game:", error);
      setError(error.message || "An error occurred while creating the game");
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <div className="p-6 max-w-6xl mx-auto text-zinc-900 dark:text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Create New Game</h1>
        {activeStep === 2 && (
          <button 
            onClick={goToPrevStep}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Settings
          </button>
        )}
      </div>
      
      <Card>
        <CardContent className="pt-6">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded flex items-start">
            <ExclamationTriangleIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              {isInActiveGame && (
                <Link to="/games" className="underline font-medium block mt-1">
                  Go to My Games
                </Link>
              )}
            </div>
          </div>
        )}
        
        {isCheckingGameStatus && (
          <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded flex items-center">
            <div className="mr-2 h-4 w-4 border-2 border-t-transparent border-blue-600 rounded-full animate-spin"></div>
            <span>Checking your game status...</span>
          </div>
        )}
        
        {/* Step Indicator */}
        <div className="flex mb-6">
          <div className={`flex-1 text-center pb-2 ${activeStep === 1 ? 'border-b-2 border-blue-500 font-medium' : 'border-b border-gray-300'}`}>
            1. Game Settings
          </div>
          <div className={`flex-1 text-center pb-2 ${activeStep === 2 ? 'border-b-2 border-blue-500 font-medium' : 'border-b border-gray-300'}`}>
            2. Select Players
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className={isInActiveGame ? 'opacity-50 pointer-events-none' : ''}>
          {activeStep === 1 ? (
            <>
              {/* League Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  League
                </label>
                {loadingLeagues ? (
                  <div className="w-full h-10 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
                ) : (
                  <Select
                    value={gameConfig?.selectedLeague || ""}
                    onChange={(e) => setGameConfig(prev => prev ? ({ ...prev, selectedLeague: e.target.value }) : prev)}
                  >
                    <option value="">Select a league...</option>
                    {availableLeagues.map(league => (
                      <option key={league.id} value={league.id}>
                        {league.name}
                      </option>
                    ))}
                  </Select>
                )}
                {gameConfig?.selectedLeague && leagueSettingsApplied && (
                  <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                    ✓ League settings applied automatically
                  </p>
                )}
              </div>
              
              {/* Game Type Selection - Completely Dynamic */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Game Mode
                  {isLeagueControlled("gameMode") && (
                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Liga configuración)</span>
                  )}
                </label>
                {!gameConfig ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-20 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
                    <div className="h-20 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
                  </div>
                ) : (
                  <>
                    {isLeagueControlled("gameMode") && (
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-md">
                        <div className="flex items-center text-sm text-blue-700 dark:text-blue-300">
                          <InformationCircleIcon className="h-4 w-4 mr-1" />
                          <span>
                            Game mode is set by the league: {
                              availableGameModes.find(mode => mode.value === gameConfig.gameMode)?.label
                            }
                          </span>
                        </div>
                      </div>
                    )}
                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${
                      isLeagueControlled("gameMode") ? 'opacity-60 pointer-events-none' : ''
                    }`}>
                      {availableGameModes.map((mode) => (
                        <div 
                          key={mode.value}
                          className={`p-4 border rounded-lg cursor-pointer ${
                            gameConfig.gameMode === mode.value
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                              : "border-gray-300 dark:border-zinc-600"
                          }`}
                          onClick={() => !isLeagueControlled("gameMode") && handleOptionChange("gameMode", mode.value)}
                        >
                          <div className="flex items-start">
                            <input
                              type="radio"
                              name="gameMode"
                              value={mode.value}
                              checked={gameConfig.gameMode === mode.value}
                              onChange={() => {}}
                              disabled={isLeagueControlled("gameMode")}
                              className="h-4 w-4 mt-1 text-blue-600"
                            />
                            <div className="ml-3">
                              <span className="block font-medium">{mode.label}</span>
                              <span className="block text-sm text-gray-500 dark:text-zinc-400">
                                {mode.description}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              
              {/* Number of Players - Dynamic based on selected game mode */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Number of Players</label>
                {!gameConfig ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-20 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
                    <div className="h-20 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div 
                      className={`p-4 border rounded-lg cursor-pointer ${
                        gameConfig.numberOfPlayers === 2
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                          : "border-gray-300 dark:border-zinc-600"
                      }`}
                      onClick={() => handleOptionChange("numberOfPlayers", 2)}
                    >
                      <div className="flex items-start">
                        <input
                          type="radio"
                          name="numberOfPlayers"
                          checked={gameConfig.numberOfPlayers === 2}
                          onChange={() => {}}
                          className="h-4 w-4 mt-1 text-blue-600"
                        />
                        <div className="ml-3">
                          <span className="block font-medium">2 Players</span>
                          <span className="block text-sm text-gray-500 dark:text-zinc-400">
                            Head-to-head competition
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div 
                      className={`p-4 border rounded-lg cursor-pointer ${
                        gameConfig.numberOfPlayers === 4
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                          : "border-gray-300 dark:border-zinc-600"
                      } ${gameConfig.gameMode !== "double" ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => gameConfig.gameMode === "double" && handleOptionChange("numberOfPlayers", 4)}
                    >
                      <div className="flex items-start">
                        <input
                          type="radio"
                          name="numberOfPlayers"
                          checked={gameConfig.numberOfPlayers === 4}
                          disabled={gameConfig.gameMode !== "double"}
                          onChange={() => {}}
                          className="h-4 w-4 mt-1 text-blue-600"
                        />
                        <div className="ml-3">
                          <span className="block font-medium">4 Players</span>
                          <span className="block text-sm text-gray-500 dark:text-zinc-400">
                            {gameConfig.gameMode === "double" 
                              ? "Team play (2 vs 2)" 
                              : "Requires Double mode"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Points to Win - Completely Dynamic */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Points to Win
                  {isLeagueControlled("pointsToWin") && (
                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Liga configuración)</span>
                  )}
                </label>
                {!gameConfig ? (
                  <div className="w-full h-10 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
                ) : (
                  <>
                    {isLeagueControlled("pointsToWin") && (
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-md">
                        <div className="flex items-center text-sm text-blue-700 dark:text-blue-300">
                          <InformationCircleIcon className="h-4 w-4 mr-1" />
                          <span>
                            Points to win is set by the league: {
                              availablePointsOptions.find(option => option.value === gameConfig.pointsToWin)?.label || `${gameConfig.pointsToWin} points`
                            }
                          </span>
                        </div>
                      </div>
                    )}
                    <select
                      name="pointsToWin"
                      value={gameConfig.pointsToWin}
                      onChange={handleChange}
                      disabled={isLeagueControlled("pointsToWin")}
                      className={`w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600 ${
                        isLeagueControlled("pointsToWin") ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      {availablePointsOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} {option.description && `(${option.description})`}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              
              {/* Starting Player - Dynamic options */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Starting Player</label>
                {!gameConfig ? (
                  <div className="w-full h-10 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
                ) : (
                  <select
                    name="startingPlayer"
                    value={gameConfig.startingPlayer}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                  >
                    <option value="creator">Game creator</option>
                    <option value="opponent">Opponent</option>
                    <option value="random">Random selection</option>
                  </select>
                )}
              </div>
              
              {/* Rules Variant - Completely Dynamic */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Game Rules
                  {isLeagueControlled("ruleset") && (
                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Liga configuración)</span>
                  )}
                </label>
                {!gameConfig ? (
                  <div className="w-full h-10 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
                ) : (
                  <>
                    {isLeagueControlled("ruleset") && (
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-md">
                        <div className="flex items-center text-sm text-blue-700 dark:text-blue-300">
                          <InformationCircleIcon className="h-4 w-4 mr-1" />
                          <span>
                            Game rules are set by the league: {
                              availableRulesets.find(ruleset => ruleset.value === gameConfig.ruleset)?.label || gameConfig.ruleset
                            }
                          </span>
                        </div>
                      </div>
                    )}
                    <select
                      name="ruleset"
                      value={gameConfig.ruleset}
                      onChange={handleChange}
                      disabled={isLeagueControlled("ruleset")}
                      className={`w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600 ${
                        isLeagueControlled("ruleset") ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      {availableRulesets.map((ruleset) => (
                        <option key={ruleset.value} value={ruleset.value}>
                          {ruleset.label} {ruleset.description && `- ${ruleset.description}`}
                        </option>
                      ))}
                    </select>
                    
                    {/* Show current ruleset description - Dynamic content */}
                    {gameConfig && gameConfig.ruleset && (
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm flex items-start">
                        <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div className="text-gray-700 dark:text-zinc-300">
                          {availableRulesets.find(r => r.value === gameConfig.ruleset)?.description}
                          {isLeagueControlled("ruleset") && (
                            <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                              These rules are enforced by your selected league
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Continue Button - With dynamic validation */}
              <button
                type="button"
                onClick={goToNextStep}
                disabled={isInActiveGame || !gameConfig}
                className={`w-full py-2 rounded-md font-medium ${
                  isInActiveGame || !gameConfig
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                Continue to Player Selection
              </button>
            </>
          ) : (
            <>
              {/* Opponent Search */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Find Opponent
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-zinc-400">
                    ({selectedOpponents.length} of {getMaxOpponents()} selected)
                  </span>
                </label>
                
                {/* League search indicator - Dynamic league name */}
                {gameConfig?.selectedLeague && (
                  <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-md">
                    <div className="flex items-center text-sm text-blue-700 dark:text-blue-300">
                      <InformationCircleIcon className="h-4 w-4 mr-1" />
                      <span>
                        Search limited to members of: {
                          availableLeagues.find(league => league.id === gameConfig?.selectedLeague)?.name || "Selected league"
                        }
                      </span>
                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(League settings)</span>
                    </div>
                  </div>
                )}
                
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setTimeout(() => setInputFocused(false), 200)}
                    placeholder={
                      gameConfig.selectedLeague 
                        ? `Search league members (min 3 characters)` 
                        : "Search by username or name (min 3 characters)"
                    }
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                  />
                  
                  {/* Search Results Dropdown */}
                  {searchTerm.length >= 3 && inputFocused && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md shadow-lg max-h-60 overflow-auto">
                      {isSearching ? (
                        <div className="p-3 text-center">
                          <span>Searching...</span>
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-3 text-center">
                          <span>
                            {gameConfig.selectedLeague 
                              ? "No league members found with that name" 
                              : "No users found"
                            }
                          </span>
                        </div>
                      ) : (
                        <ul>
                          {searchResults.map(user => (
                            <li 
                              key={user.uid}
                              onClick={() => handleSelectOpponent(user)}
                              className="p-3 hover:bg-gray-100 dark:hover:bg-zinc-600 cursor-pointer"
                            >
                              <div className="flex items-center">
                                {user.photoURL && (
                                  <img 
                                    src={user.photoURL} 
                                    alt={user.displayName} 
                                    className="w-8 h-8 rounded-full mr-2"
                                  />
                                )}
                                <div>
                                  <span className="block font-medium">{user.displayName}</span>
                                  {user.username && (
                                    <span className="text-sm text-gray-500 dark:text-zinc-400">@{user.username}</span>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Selected Players - Enhanced for Teams */}
                {selectedOpponents.length > 0 && (
                  <div className="mt-4">
                    {getGameStructure().teamsNeeded ? (
                      // Team-based display (2 vs 2)
                      <div>
                        <h4 className="text-sm font-medium mb-3">Team Assignments (2 vs 2):</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Team 1 - Current User + Partner */}
                          <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50 dark:bg-blue-900/10">
                            <div className="flex items-center mb-2">
                              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                              <h5 className="font-medium text-blue-700 dark:text-blue-300">Your Team</h5>
                            </div>
                            
                            {/* Current User (always in team 1) */}
                            <div className="mb-2 p-2 bg-white dark:bg-zinc-700 rounded border border-blue-300 dark:border-blue-700">
                              <div className="flex items-center">
                                {auth.currentUser?.photoURL && (
                                  <img 
                                    src={auth.currentUser.photoURL} 
                                    alt="You" 
                                    className="w-6 h-6 rounded-full mr-2"
                                  />
                                )}
                                <div>
                                  <span className="block font-medium text-sm">You</span>
                                  <span className="text-xs text-gray-500 dark:text-zinc-400">Team Captain</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Partner slot */}
                            {teamAssignments.team1.length > 0 ? (
                              teamAssignments.team1.map(partner => (
                                <div key={partner.uid} className="p-2 bg-white dark:bg-zinc-700 rounded border border-blue-300 dark:border-blue-700">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      {partner.photoURL && (
                                        <img 
                                          src={partner.photoURL} 
                                          alt={partner.displayName} 
                                          className="w-6 h-6 rounded-full mr-2"
                                        />
                                      )}
                                      <div>
                                        <span className="block font-medium text-sm">{partner.displayName}</span>
                                        {partner.username && (
                                          <span className="text-xs text-gray-500 dark:text-zinc-400">@{partner.username}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex space-x-1">
                                      <button
                                        type="button"
                                        onClick={() => assignPlayerToTeam(partner, 'team2')}
                                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-600 dark:hover:bg-zinc-500 rounded"
                                        title="Move to opposing team"
                                      >
                                        ↔️
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveOpponent(partner.uid)}
                                        className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 rounded"
                                        title="Remove player"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-2 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded text-center text-sm text-gray-500 dark:text-zinc-400">
                                Need 1 partner
                              </div>
                            )}
                          </div>
                          
                          {/* Team 2 - Opponents */}
                          <div className="border border-red-200 dark:border-red-800 rounded-lg p-3 bg-red-50 dark:bg-red-900/10">
                            <div className="flex items-center mb-2">
                              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                              <h5 className="font-medium text-red-700 dark:text-red-300">Opposing Team</h5>
                            </div>
                            
                            {teamAssignments.team2.length > 0 ? (
                              teamAssignments.team2.map(opponent => (
                                <div key={opponent.uid} className="mb-2 p-2 bg-white dark:bg-zinc-700 rounded border border-red-300 dark:border-red-700">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      {opponent.photoURL && (
                                        <img 
                                          src={opponent.photoURL} 
                                          alt={opponent.displayName} 
                                          className="w-6 h-6 rounded-full mr-2"
                                        />
                                      )}
                                      <div>
                                        <span className="block font-medium text-sm">{opponent.displayName}</span>
                                        {opponent.username && (
                                          <span className="text-xs text-gray-500 dark:text-zinc-400">@{opponent.username}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex space-x-1">
                                      <button
                                        type="button"
                                        onClick={() => assignPlayerToTeam(opponent, 'team1')}
                                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-600 dark:hover:bg-zinc-500 rounded"
                                        title="Move to your team"
                                      >
                                        ↔️
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveOpponent(opponent.uid)}
                                        className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 rounded"
                                        title="Remove player"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-2 border-2 border-dashed border-red-300 dark:border-red-700 rounded text-center text-sm text-gray-500 dark:text-zinc-400">
                                Need 2 opponents
                              </div>
                            )}
                            
                            {/* Show remaining slots for team 2 */}
                            {teamAssignments.team2.length === 1 && (
                              <div className="p-2 border-2 border-dashed border-red-300 dark:border-red-700 rounded text-center text-sm text-gray-500 dark:text-zinc-400">
                                Need 1 more opponent
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Unassigned players (if any) */}
                        {selectedOpponents.filter(p => !getPlayerTeam(p.uid)).length > 0 && (
                          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
                            <h5 className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2">
                              Unassigned Players (click to assign to a team):
                            </h5>
                            <div className="space-y-2">
                              {selectedOpponents.filter(p => !getPlayerTeam(p.uid)).map(player => (
                                <div key={player.uid} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-700 rounded border">
                                  <div className="flex items-center">
                                    {player.photoURL && (
                                      <img 
                                        src={player.photoURL} 
                                        alt={player.displayName} 
                                        className="w-6 h-6 rounded-full mr-2"
                                      />
                                    )}
                                    <div>
                                      <span className="block font-medium text-sm">{player.displayName}</span>
                                      {player.username && (
                                        <span className="text-xs text-gray-500 dark:text-zinc-400">@{player.username}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => assignPlayerToTeam(player, 'team1')}
                                      disabled={isTeamComplete('team1')}
                                      className="text-xs px-3 py-1 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 disabled:cursor-not-allowed text-blue-700 disabled:text-gray-500 rounded"
                                    >
                                      Your Team
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => assignPlayerToTeam(player, 'team2')}
                                      disabled={isTeamComplete('team2')}
                                      className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 disabled:bg-gray-100 disabled:cursor-not-allowed text-red-700 disabled:text-gray-500 rounded"
                                    >
                                      Opponents
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      // Simple list for head-to-head games
                      <div>
                        <h4 className="text-sm font-medium mb-2">Selected Opponents:</h4>
                        <div className="space-y-2">
                          {selectedOpponents.map(opponent => (
                            <div 
                              key={opponent.uid} 
                              className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-md"
                            >
                              <div className="flex items-center">
                                {opponent.photoURL && (
                                  <img 
                                    src={opponent.photoURL} 
                                    alt={opponent.displayName} 
                                    className="w-8 h-8 rounded-full mr-2"
                                  />
                                )}
                                <div>
                                  <span className="block font-medium">{opponent.displayName}</span>
                                  {opponent.username && (
                                    <span className="text-sm text-gray-500 dark:text-zinc-400">@{opponent.username}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveOpponent(opponent.uid)}
                                className="p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 dark:hover:bg-red-900/20"
                                aria-label="Remove opponent"
                              >
                                <XMarkIcon className="h-5 w-5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Players needed info - Enhanced for teams */}
                {selectedOpponents.length < getMaxOpponents() && (
                  <div className="mt-3 flex items-center text-blue-600 dark:text-blue-400 text-sm">
                    <UserPlusIcon className="h-4 w-4 mr-1" />
                    <span>
                      {getGameStructure().teamsNeeded ? (
                        <>
                          {getMaxOpponents() - selectedOpponents.length} more player{getMaxOpponents() - selectedOpponents.length > 1 ? 's' : ''} needed 
                          {selectedOpponents.length > 0 && (
                            <span className="ml-1 text-xs">
                              (1 partner + {2 - teamAssignments.team2.length} opponent{2 - teamAssignments.team2.length !== 1 ? 's' : ''})
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {getMaxOpponents() - selectedOpponents.length} more opponent{getMaxOpponents() - selectedOpponents.length > 1 ? 's' : ''} needed
                        </>
                      )}
                    </span>
                  </div>
                )}
                
                {/* Team validation messages */}
                {getGameStructure().teamsNeeded && selectedOpponents.length === getMaxOpponents() && (
                  <div className="mt-3">
                    {!isTeamComplete('team1') && (
                      <div className="flex items-center text-yellow-600 dark:text-yellow-400 text-sm mb-1">
                        <InformationCircleIcon className="h-4 w-4 mr-1" />
                        <span>Please assign 1 partner to your team</span>
                      </div>
                    )}
                    {!isTeamComplete('team2') && (
                      <div className="flex items-center text-yellow-600 dark:text-yellow-400 text-sm mb-1">
                        <InformationCircleIcon className="h-4 w-4 mr-1" />
                        <span>Please assign 2 players to the opposing team</span>
                      </div>
                    )}
                    {isTeamComplete('team1') && isTeamComplete('team2') && (
                      <div className="flex items-center text-green-600 dark:text-green-400 text-sm">
                        <InformationCircleIcon className="h-4 w-4 mr-1" />
                        <span>✓ Teams are ready! You can create the game.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Game Summary - Dynamic display */}
              {gameConfig && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-3">Game Summary</h3>
                  {/* League Settings Banner */}
                  {leagueSettingsApplied && (
                    <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-md">
                      <div className="flex items-center text-sm text-blue-700 dark:text-blue-300 mb-2">
                        <InformationCircleIcon className="h-4 w-4 mr-1" />
                        <span className="font-medium">League Configuration Applied</span>
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        The following settings are enforced by your selected league and cannot be modified:
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-gray-50 dark:bg-zinc-700/50 rounded-md p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-sm text-gray-500 dark:text-zinc-400">
                          Game Mode
                          {isLeagueControlled("gameMode") && (
                            <span className="ml-1 text-xs text-blue-500">✓ Liga</span>
                          )}
                        </span>
                        <span className="font-medium">
                          {availableGameModes.find(m => m.value === gameConfig.gameMode)?.label || gameConfig.gameMode}
                        </span>
                      </div>
                      <div>
                        <span className="block text-sm text-gray-500 dark:text-zinc-400">Players</span>
                        <span className="font-medium">{gameConfig.numberOfPlayers}</span>
                      </div>
                      <div>
                        <span className="block text-sm text-gray-500 dark:text-zinc-400">
                          Points to Win
                          {isLeagueControlled("pointsToWin") && (
                            <span className="ml-1 text-xs text-blue-500">✓ Liga</span>
                          )}
                        </span>
                        <span className="font-medium">
                          {availablePointsOptions.find(p => p.value === gameConfig.pointsToWin)?.label || gameConfig.pointsToWin}
                        </span>
                      </div>
                      <div>
                        <span className="block text-sm text-gray-500 dark:text-zinc-400">Starting Player</span>
                        <span className="font-medium">
                          {gameConfig.startingPlayer === "creator" 
                            ? "Game Creator" 
                            : gameConfig.startingPlayer === "opponent" 
                              ? "Opponent" 
                              : "Random Selection"}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-sm text-gray-500 dark:text-zinc-400">
                          Rules
                          {isLeagueControlled("ruleset") && (
                            <span className="ml-1 text-xs text-blue-500">✓ Liga</span>
                          )}
                        </span>
                        <span className="font-medium">
                          {availableRulesets.find(r => r.value === gameConfig.ruleset)?.label || gameConfig.ruleset}
                        </span>
                      </div>
                      
                      {/* Team composition for 2v2 games */}
                      {getGameStructure().teamsNeeded && selectedOpponents.length === getMaxOpponents() && (
                        <div className="col-span-2 mt-3 pt-3 border-t border-gray-200 dark:border-zinc-600">
                          <span className="block text-sm text-gray-500 dark:text-zinc-400 mb-2">Team Composition</span>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                              <div className="font-medium text-blue-700 dark:text-blue-300 mb-1">Your Team</div>
                              <div className="text-xs space-y-1">
                                <div>• You (Captain)</div>
                                {teamAssignments.team1.map(partner => (
                                  <div key={partner.uid}>• {partner.displayName}</div>
                                ))}
                              </div>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                              <div className="font-medium text-red-700 dark:text-red-300 mb-1">Opposing Team</div>
                              <div className="text-xs space-y-1">
                                {teamAssignments.team2.map(opponent => (
                                  <div key={opponent.uid}>• {opponent.displayName}</div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Show additional league constraints if applicable */}
                      {getLeagueConstraints() && (
                        <div className="col-span-2 mt-3 pt-3 border-t border-gray-200 dark:border-zinc-600">
                          <span className="block text-sm text-gray-500 dark:text-zinc-400 mb-2">League Information</span>
                          <div className="text-sm text-gray-600 dark:text-zinc-400 space-y-1">
                            <div>Selected League: {availableLeagues.find(l => l.id === gameConfig.selectedLeague)?.name}</div>
                            {getLeagueConstraints()?.timeLimit && (
                              <div>Time Limit: {getLeagueConstraints()?.timeLimit} minutes per game</div>
                            )}
                            {getLeagueConstraints()?.maxPlayers && (
                              <div>Maximum Players in League: {getLeagueConstraints()?.maxPlayers}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Submit Button */}
              <button
                type="submit"
                disabled={isCreating || selectedOpponents.length !== getMaxOpponents() || isInActiveGame || !gameConfig}
                className={`w-full py-2 rounded-md font-medium ${
                  isCreating || selectedOpponents.length !== getMaxOpponents() || isInActiveGame || !gameConfig
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {isCreating ? "Creating Game..." : "Create Game"}
              </button>
            </>
          )}
        </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateGame;