import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, createGame, searchUsers, isPlayerInActiveGame, GameMode, UserProfile } from "../firebase";
import { ArrowLeftIcon, InformationCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";

const CreateGame: React.FC = () => {
  const navigate = useNavigate();
  
  // Game configuration state
  const [gameConfig, setGameConfig] = useState({
    gameMode: "teams" as GameMode,
    pointsToWin: 100,
    opponent: "",
    numberOfPlayers: 2,
    startingPlayer: "creator", // creator, opponent, or random
    useBoricuaRules: true
  });
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeStep, setActiveStep] = useState(1); // 1: Game settings, 2: Player selection
  const [isInActiveGame, setIsInActiveGame] = useState(false);
  const [isCheckingGameStatus, setIsCheckingGameStatus] = useState(true);
  
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
        const results = await searchUsers(searchTerm);
        setSearchResults(results);
      } catch (error) {
        console.error("Error searching opponents:", error);
      } finally {
        setIsSearching(false);
      }
    };
    
    const debounce = setTimeout(searchOpponents, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);
  
  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setGameConfig(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle radio/checkbox changes
  const handleOptionChange = (name: string, value: any) => {
    setGameConfig(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle opponent selection
  const handleSelectOpponent = (user: UserProfile) => {
    setGameConfig(prev => ({ ...prev, opponent: user.uid }));
    setSearchTerm(user.displayName);
  };
  
  // Navigate between steps
  const goToNextStep = () => {
    setActiveStep(2);
  };
  
  const goToPrevStep = () => {
    setActiveStep(1);
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!auth.currentUser) {
      setError("You must be logged in to create a game");
      return;
    }
    
    if (!gameConfig.opponent) {
      setError("Please select an opponent");
      return;
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
      
    const game = await createGame(gameConfig.opponent, {
      gameMode: gameConfig.gameMode,
      pointsToWin: parseInt(gameConfig.pointsToWin.toString()),
      numberOfPlayers: gameConfig.numberOfPlayers,
      startingPlayer: gameConfig.startingPlayer,
      useBoricuaRules: gameConfig.useBoricuaRules
    });
      
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
    <div className="p-6 max-w-2xl mx-auto text-zinc-900 dark:text-white">
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
      
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
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
              {/* Game Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Game Mode</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer ${
                      gameConfig.gameMode === "individual" 
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                        : "border-gray-300 dark:border-zinc-600"
                    }`}
                    onClick={() => handleOptionChange("gameMode", "individual")}
                  >
                    <div className="flex items-start">
                      <input
                        type="radio"
                        name="gameMode"
                        value="individual"
                        checked={gameConfig.gameMode === "individual"}
                        onChange={() => {}}
                        className="h-4 w-4 mt-1 text-blue-600"
                      />
                      <div className="ml-3">
                        <span className="block font-medium">Individual</span>
                        <span className="block text-sm text-gray-500 dark:text-zinc-400">
                          Each player competes on their own
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer ${
                      gameConfig.gameMode === "teams" 
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                        : "border-gray-300 dark:border-zinc-600"
                    }`}
                    onClick={() => handleOptionChange("gameMode", "teams")}
                  >
                    <div className="flex items-start">
                      <input
                        type="radio"
                        name="gameMode"
                        value="teams"
                        checked={gameConfig.gameMode === "teams"}
                        onChange={() => {}}
                        className="h-4 w-4 mt-1 text-blue-600"
                      />
                      <div className="ml-3">
                        <span className="block font-medium">Teams</span>
                        <span className="block text-sm text-gray-500 dark:text-zinc-400">
                          Traditional Boricua format (2 vs 2)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Number of Players */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Number of Players</label>
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
                    } ${gameConfig.gameMode === "individual" ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={() => gameConfig.gameMode === "teams" && handleOptionChange("numberOfPlayers", 4)}
                  >
                    <div className="flex items-start">
                      <input
                        type="radio"
                        name="numberOfPlayers"
                        checked={gameConfig.numberOfPlayers === 4}
                        disabled={gameConfig.gameMode === "individual"}
                        onChange={() => {}}
                        className="h-4 w-4 mt-1 text-blue-600"
                      />
                      <div className="ml-3">
                        <span className="block font-medium">4 Players</span>
                        <span className="block text-sm text-gray-500 dark:text-zinc-400">
                          Team play (requires Teams mode)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Points to Win */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Points to Win</label>
                <select
                  name="pointsToWin"
                  value={gameConfig.pointsToWin}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                >
                  <option value={100}>100 points (short game)</option>
                  <option value={150}>150 points (standard match)</option>
                  <option value={200}>200 points (formal match)</option>
                </select>
              </div>
              
              {/* Starting Player */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Starting Player</label>
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
              </div>
              
              {/* Rules Variant */}
              <div className="mb-6">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={gameConfig.useBoricuaRules}
                    onChange={(e) => handleOptionChange("useBoricuaRules", e.target.checked)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm font-medium">Use Boricua (Puerto Rican) Rules</span>
                </label>
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm flex items-start">
                  <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 dark:text-zinc-300">
                    Traditional Puerto Rican rules include scoring from the opponent's remaining tiles, 
                    and play proceeds counter-clockwise.
                  </span>
                </div>
              </div>
              
              {/* Continue Button */}
              <button
                type="button"
                onClick={goToNextStep}
                disabled={isInActiveGame}
                className={`w-full py-2 rounded-md font-medium ${
                  isInActiveGame
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
                <label className="block text-sm font-medium mb-2">Find Opponent</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by username or name (min 3 characters)"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                  />
                  
                  {/* Search Results Dropdown */}
                  {searchTerm.length >= 3 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md shadow-lg max-h-60 overflow-auto">
                      {isSearching ? (
                        <div className="p-3 text-center">
                          <span>Searching...</span>
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-3 text-center">
                          <span>No users found</span>
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
                
                {/* Selected Opponent */}
                {gameConfig.opponent && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-md">
                    <div className="font-medium">Selected opponent:</div>
                    <div className="flex items-center mt-1">
                      <span className="text-lg">{searchTerm}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Game Summary */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Game Summary</h3>
                <div className="bg-gray-50 dark:bg-zinc-700/50 rounded-md p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-sm text-gray-500 dark:text-zinc-400">Game Mode</span>
                      <span className="font-medium">{gameConfig.gameMode === "teams" ? "Teams" : "Individual"}</span>
                    </div>
                    <div>
                      <span className="block text-sm text-gray-500 dark:text-zinc-400">Players</span>
                      <span className="font-medium">{gameConfig.numberOfPlayers} players</span>
                    </div>
                    <div>
                      <span className="block text-sm text-gray-500 dark:text-zinc-400">Points to Win</span>
                      <span className="font-medium">{gameConfig.pointsToWin} points</span>
                    </div>
                    <div>
                      <span className="block text-sm text-gray-500 dark:text-zinc-400">Rules</span>
                      <span className="font-medium">{gameConfig.useBoricuaRules ? "Boricua Rules" : "Standard Rules"}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Submit Button */}
              <button
                type="submit"
                disabled={isCreating || !gameConfig.opponent}
                className={`w-full py-2 rounded-md font-medium ${
                  isCreating || !gameConfig.opponent
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {isCreating ? "Creating Game..." : "Create Game"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default CreateGame;