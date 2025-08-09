// Firebase configuration and initialization
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, User, signInWithPopup, updateProfile } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  query, 
  orderBy, 
  getDocs,
  where,
  Timestamp,
  serverTimestamp,
  addDoc,
  limit,
  deleteDoc
} from "firebase/firestore";
// Firebase Storage imports - ENABLED
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from "firebase/storage";
// Firebase Functions
import { getFunctions } from "firebase/functions";
import { Season } from './models/league';
import config from './config';

// Initialize Firebase with secure configuration
const app = initializeApp(config.firebase);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Firebase Storage ENABLED
const functions = getFunctions(app);
const googleProvider = new GoogleAuthProvider();

// Query limit from configuration
const DEFAULT_QUERY_LIMIT = config.maxQueryLimit;

// Collection references
const usersCollection = collection(db, "users");
const gamesCollection = collection(db, "games");

// Type definitions
export type GameMode = "single" | "double";
export type GameStatus = "invited" | "accepted" | "rejected" | "in_progress" | "waiting_confirmation" | "completed";

// User profile interface
export interface UserProfile {
  uid: string;
  displayName: string;
  username?: string;
  email: string;
  photoURL?: string;
  createdAt: Timestamp;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    totalPoints: number;
    globalRank?: number;
    lastRankUpdate?: Timestamp;
    lastGameAt?: Timestamp;
    winStreak?: number;
    maxWinStreak?: number;
  };
  hasSetUsername?: boolean;
}

// Game interface
export interface Game {
  id?: string;
  createdBy: string;
  opponent: string; // For backward compatibility - in team games, this is the first opponent
  opponents?: string[]; // For multi-player support
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp; // When the game was completed (for ranking timeframes)
  status: GameStatus;
  leagueId?: string; // Optional: if game is part of a league
  teams?: {
    team1: string[]; // Array of player IDs (includes creator)
    team2: string[]; // Array of opponent IDs
  };
  settings: {
    gameMode: GameMode;
    pointsToWin: number;
    numberOfPlayers?: number;
    startingPlayer?: string;
    useBoricuaRules?: boolean;
    ruleset?: string; // New dynamic ruleset field
  };
  scores?: {
    creator: number;
    opponent: number;
    team1?: number; // Team-based scoring
    team2?: number; // Team-based scoring
  };
  confirmedBy?: string;
  winner?: string;
  winningTeam?: 'team1' | 'team2'; // For team-based games
  activePlayer?: string; // Tracks which player's turn it is
  rejectionReason?: string; // Optional reason for rejection
}

// Authentication functions
export const loginWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserProfile(result.user);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    return null;
  }
};

// User profile functions
export const ensureUserProfile = async (user: User): Promise<UserProfile> => {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    // Create new user profile
    const newUser: UserProfile = {
      uid: user.uid,
      displayName: user.displayName || "Anonymous Player",
      email: user.email || "",
      photoURL: user.photoURL || undefined,
      createdAt: Timestamp.now(),
      stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        totalPoints: 0
      },
      hasSetUsername: false,
      // Username will be set during the setup process
      // Once set, it cannot be changed
    };
    
    await setDoc(userRef, newUser);
    return newUser;
  }
  
  return userSnap.data() as UserProfile;
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
};

export const searchUsers = async (searchTerm: string): Promise<UserProfile[]> => {
  try {
    // Skip search if term is too short
    if (searchTerm.length < 3) return [];
    
    // Try to search by username first
    const usernameQuery = query(
      usersCollection,
      where("username", ">=", searchTerm.toLowerCase()),
      where("username", "<=", searchTerm.toLowerCase() + '\uf8ff'),
      limit(DEFAULT_QUERY_LIMIT)
    );
    
    // Then by display name as fallback
    const displayNameQuery = query(
      usersCollection,
      where("displayName", ">=", searchTerm),
      where("displayName", "<=", searchTerm + '\uf8ff'),
      limit(DEFAULT_QUERY_LIMIT)
    );
    
    const [usernameSnapshot, displayNameSnapshot] = await Promise.all([
      getDocs(usernameQuery),
      getDocs(displayNameQuery)
    ]);
    
    // Combine results, removing duplicates
    const results = new Map<string, UserProfile>();
    
    usernameSnapshot.docs.forEach(doc => {
      const data = doc.data() as UserProfile;
      results.set(data.uid, data);
    });
    
    displayNameSnapshot.docs.forEach(doc => {
      const data = doc.data() as UserProfile;
      results.set(data.uid, data);
    });
    
    // Convert to array and filter out current user
    return Array.from(results.values())
      .filter(user => user.uid !== auth.currentUser?.uid)
      .slice(0, DEFAULT_QUERY_LIMIT); // Additional safety limit
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
};

// Game functions
export const createGame = async (
  opponentId: string, 
  settings: { 
    gameMode: GameMode, 
    pointsToWin: number,
    numberOfPlayers?: number,
    startingPlayer?: string,
    useBoricuaRules?: boolean,
    ruleset?: string,
    leagueId?: string
  }
): Promise<Game | null> => {
  try {
    if (!auth.currentUser) throw new Error("You must be logged in to create a game");
    
    // Check if creator is already in an active game
    const isCreatorInGame = await isPlayerInActiveGame(auth.currentUser.uid);
    if (isCreatorInGame) {
      throw new Error("You cannot create a new game while you have an active game");
    }
    
    // Check if opponent is already in an active game
    const isOpponentInGame = await isPlayerInActiveGame(opponentId);
    if (isOpponentInGame) {
      throw new Error("This player is already in an active game");
    }
    
    const newGame: Omit<Game, "id"> = {
      createdBy: auth.currentUser.uid,
      opponent: opponentId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: "invited", // Start as an invitation
      leagueId: settings.leagueId,
      settings: {
        gameMode: settings.gameMode,
        pointsToWin: settings.pointsToWin,
        numberOfPlayers: settings.numberOfPlayers,
        startingPlayer: settings.startingPlayer,
        useBoricuaRules: settings.useBoricuaRules,
        ruleset: settings.ruleset
      }
    };
    
    const gameRef = await addDoc(gamesCollection, newGame);
    return { ...newGame, id: gameRef.id };
  } catch (error) {
    console.error("Error creating game:", error);
    throw error; // Re-throw the error for better handling in UI
  }
};

// Enhanced function for creating team-based games
export const createTeamGame = async (
  opponents: string[], 
  settings: { 
    gameMode: GameMode, 
    pointsToWin: number,
    numberOfPlayers?: number,
    startingPlayer?: string,
    useBoricuaRules?: boolean,
    ruleset?: string,
    leagueId?: string
  },
  teams?: {
    team1: string[], // Partners (excluding creator)
    team2: string[]  // Opponents
  }
): Promise<Game | null> => {
  try {
    if (!auth.currentUser) throw new Error("You must be logged in to create a game");
    
    // Check if creator is already in an active game
    const isCreatorInGame = await isPlayerInActiveGame(auth.currentUser.uid);
    if (isCreatorInGame) {
      throw new Error("You cannot create a new game while you have an active game");
    }
    
    // Check if any opponents are already in active games
    for (const opponentId of opponents) {
      const isOpponentInGame = await isPlayerInActiveGame(opponentId);
      if (isOpponentInGame) {
        throw new Error(`Player is already in an active game`);
      }
    }
    
    // If teams are provided, validate all partners as well
    if (teams?.team1) {
      for (const partnerId of teams.team1) {
        const isPartnerInGame = await isPlayerInActiveGame(partnerId);
        if (isPartnerInGame) {
          throw new Error(`Partner is already in an active game`);
        }
      }
    }
    
    const newGame: Omit<Game, "id"> = {
      createdBy: auth.currentUser.uid,
      opponent: opponents[0], // First opponent for backward compatibility
      opponents: opponents,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: "invited",
      leagueId: settings.leagueId,
      teams: teams ? {
        team1: [auth.currentUser.uid, ...teams.team1],
        team2: teams.team2
      } : undefined,
      settings: {
        gameMode: settings.gameMode,
        pointsToWin: settings.pointsToWin,
        numberOfPlayers: settings.numberOfPlayers,
        startingPlayer: settings.startingPlayer,
        useBoricuaRules: settings.useBoricuaRules,
        ruleset: settings.ruleset
      }
    };
    
    const gameRef = await addDoc(gamesCollection, newGame);
    return { ...newGame, id: gameRef.id };
  } catch (error) {
    console.error("Error creating team game:", error);
    throw error;
  }
};

export const getGameById = async (gameId: string): Promise<Game | null> => {
  try {
    const gameRef = doc(db, "games", gameId);
    const gameSnap = await getDoc(gameRef);
    
    if (gameSnap.exists()) {
      return { id: gameSnap.id, ...gameSnap.data() } as Game;
    }
    return null;
  } catch (error) {
    console.error("Error getting game:", error);
    return null;
  }
};

export const getUserGames = async (): Promise<Game[]> => {
  try {
    if (!auth.currentUser) return [];
    
    const userId = auth.currentUser.uid;
    
    // Get games where user is creator or opponent (traditional structure)
    const creatorQuery = query(
      gamesCollection,
      where("createdBy", "==", userId),
      orderBy("updatedAt", "desc"),
      limit(DEFAULT_QUERY_LIMIT)
    );
    
    const opponentQuery = query(
      gamesCollection,
      where("opponent", "==", userId),
      orderBy("updatedAt", "desc"),
      limit(DEFAULT_QUERY_LIMIT)
    );
    
    // First get basic games (these should always work)
    const [creatorSnap, opponentSnap] = await Promise.all([
      getDocs(creatorQuery),
      getDocs(opponentQuery)
    ]);
    
    const allGames = new Map<string, Game>();
    
    // Add basic games
    [...creatorSnap.docs, ...opponentSnap.docs].forEach(doc => {
      const game = { id: doc.id, ...doc.data() } as Game;
      allGames.set(doc.id, game);
    });
    
    // Try to get team-based games (but don't fail if these fields don't exist)
    try {
      // Get games where user is in the opponents array (multi-player support)
      const opponentsArrayQuery = query(
        gamesCollection,
        where("opponents", "array-contains", userId),
        orderBy("updatedAt", "desc"),
        limit(DEFAULT_QUERY_LIMIT)
      );
      
      const opponentsArraySnap = await getDocs(opponentsArrayQuery);
      opponentsArraySnap.docs.forEach(doc => {
        const game = { id: doc.id, ...doc.data() } as Game;
        allGames.set(doc.id, game);
      });
    } catch (error) {
      // Skip silently - opponents array field not found
    }
    
    try {
      // Get games where user is in team1 (team-based games)
      const team1Query = query(
        gamesCollection,
        where("teams.team1", "array-contains", userId),
        orderBy("updatedAt", "desc"),
        limit(DEFAULT_QUERY_LIMIT)
      );
      
      const team1Snap = await getDocs(team1Query);
      team1Snap.docs.forEach(doc => {
        const game = { id: doc.id, ...doc.data() } as Game;
        allGames.set(doc.id, game);
      });
    } catch (error) {
      // Skip silently - teams.team1 field not found
    }
    
    try {
      // Get games where user is in team2 (team-based games)
      const team2Query = query(
        gamesCollection,
        where("teams.team2", "array-contains", userId),
        orderBy("updatedAt", "desc"),
        limit(DEFAULT_QUERY_LIMIT)
      );
      
      const team2Snap = await getDocs(team2Query);
      team2Snap.docs.forEach(doc => {
        const game = { id: doc.id, ...doc.data() } as Game;
        allGames.set(doc.id, game);
      });
    } catch (error) {
      // Skip silently - teams.team2 field not found
    }
    
    // Convert to array, sort by updatedAt, and limit
    return Array.from(allGames.values())
      .sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis())
      .slice(0, DEFAULT_QUERY_LIMIT);
  } catch (error) {
    console.error("Error getting user games:", error);
    return [];
  }
};

// Check if a player is already in an active game
export const isPlayerInActiveGame = async (userId: string): Promise<boolean> => {
  try {
    // Active game statuses (only statuses that indicate actual active gameplay)
    // Invitations don't count as active games
    const activeStatuses = ["accepted", "in_progress", "waiting_confirmation"];
    
    // Check games where user is creator
    const creatorQuery = query(
      gamesCollection,
      where("createdBy", "==", userId),
      where("status", "in", activeStatuses),
      limit(1) // Only need to know if any exist
    );
    
    // Check games where user is opponent
    const opponentQuery = query(
      gamesCollection,
      where("opponent", "==", userId),
      where("status", "in", activeStatuses),
      limit(1) // Only need to know if any exist
    );
    
    const [creatorSnap, opponentSnap] = await Promise.all([
      getDocs(creatorQuery),
      getDocs(opponentQuery)
    ]);
    
    // If either query returns results, the player is in an active game
    if (!creatorSnap.empty || !opponentSnap.empty) {
      return true;
    }
    
    // Try to check team-based games (but don't fail if these fields don't exist)
    try {
      // Check games where user is in opponents array (multi-player support)
      const opponentsArrayQuery = query(
        gamesCollection,
        where("opponents", "array-contains", userId),
        where("status", "in", activeStatuses),
        limit(1)
      );
      
      const opponentsArraySnap = await getDocs(opponentsArrayQuery);
      if (!opponentsArraySnap.empty) {
        return true;
      }
    } catch (error) {
      // Skip silently - opponents array field not found
    }
    
    try {
      // Check games where user is in team1 (team-based games)
      const team1Query = query(
        gamesCollection,
        where("teams.team1", "array-contains", userId),
        where("status", "in", activeStatuses),
        limit(1)
      );
      
      const team1Snap = await getDocs(team1Query);
      if (!team1Snap.empty) {
        return true;
      }
    } catch (error) {
      // Skip silently - teams.team1 field not found
    }
    
    try {
      // Check games where user is in team2 (team-based games)
      const team2Query = query(
        gamesCollection,
        where("teams.team2", "array-contains", userId),
        where("status", "in", activeStatuses),
        limit(1)
      );
      
      const team2Snap = await getDocs(team2Query);
      if (!team2Snap.empty) {
        return true;
      }
    } catch (error) {
      // Skip silently - teams.team2 field not found
    }
    
    return false;
  } catch (error) {
    console.error("Error checking active games:", error);
    return false;
  }
};

// Get new game invitations for a user
export const getNewInvitations = async (): Promise<Game[]> => {
  try {
    if (!auth.currentUser) return [];
    
    const userId = auth.currentUser.uid;
    
    // Query games where current user is the opponent and status is "invited"
    const invitationsQuery = query(
      gamesCollection,
      where("opponent", "==", userId),
      where("status", "==", "invited"),
      orderBy("createdAt", "desc"),
      limit(DEFAULT_QUERY_LIMIT)
    );
    
    const invitationsSnap = await getDocs(invitationsQuery);
    const allInvitations = new Map<string, Game>();
    
    // Add basic invitations
    invitationsSnap.docs.forEach(doc => {
      const game = { id: doc.id, ...doc.data() } as Game;
      allInvitations.set(doc.id, game);
    });
    
    // Try to get team-based invitations (but don't fail if these fields don't exist)
    try {
      // Query games where current user is in opponents array and status is "invited" (multi-player support)
      const opponentsArrayQuery = query(
        gamesCollection,
        where("opponents", "array-contains", userId),
        where("status", "==", "invited"),
        orderBy("createdAt", "desc"),
        limit(DEFAULT_QUERY_LIMIT)
      );
      
      const opponentsArraySnap = await getDocs(opponentsArrayQuery);
      opponentsArraySnap.docs.forEach(doc => {
        const game = { id: doc.id, ...doc.data() } as Game;
        allInvitations.set(doc.id, game);
      });
    } catch (error) {
      // Skip silently - opponents array field not found
    }
    
    try {
      // Query games where current user is in team1 and status is "invited" (team-based games)
      const team1Query = query(
        gamesCollection,
        where("teams.team1", "array-contains", userId),
        where("status", "==", "invited"),
        orderBy("createdAt", "desc"),
        limit(DEFAULT_QUERY_LIMIT)
      );
      
      const team1Snap = await getDocs(team1Query);
      team1Snap.docs.forEach(doc => {
        const game = { id: doc.id, ...doc.data() } as Game;
        allInvitations.set(doc.id, game);
      });
    } catch (error) {
      // Skip silently - teams.team1 field not found
    }
    
    try {
      // Query games where current user is in team2 and status is "invited" (team-based games)
      const team2Query = query(
        gamesCollection,
        where("teams.team2", "array-contains", userId),
        where("status", "==", "invited"),
        orderBy("createdAt", "desc"),
        limit(DEFAULT_QUERY_LIMIT)
      );
      
      const team2Snap = await getDocs(team2Query);
      team2Snap.docs.forEach(doc => {
        const game = { id: doc.id, ...doc.data() } as Game;
        allInvitations.set(doc.id, game);
      });
    } catch (error) {
      // Skip silently - teams.team2 field not found
    }
    
    // Convert to array and sort by createdAt
    return Array.from(allInvitations.values())
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
      .slice(0, DEFAULT_QUERY_LIMIT);
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return [];
  }
};

// Accept a game invitation
export const acceptGameInvitation = async (gameId: string): Promise<Game | null> => {
  try {
    if (!auth.currentUser) throw new Error("You must be logged in to accept a game");
    
    const gameRef = doc(db, "games", gameId);
    const gameSnap = await getDoc(gameRef);
    
    if (!gameSnap.exists()) throw new Error("Game not found");
    
    const game = gameSnap.data() as Game;
    
    // Verify user is the opponent (only opponents can accept invitations)
    if (game.opponent !== auth.currentUser.uid) {
      throw new Error("You are not authorized to accept this invitation");
    }
    
    // Verify game is in invited status
    if (game.status !== "invited") {
      throw new Error("This game is not in invitation status");
    }
    
    // Check if opponent (current user) is already in an active game - this should prevent
    // the user from accepting multiple games
    const isOpponentInGame = await isPlayerInActiveGame(game.opponent);
    
    if (isOpponentInGame) {
      // Don't auto-reject, just prevent acceptance with clear error
      throw new Error("You are already in an active game. Please finish that game before accepting a new invitation.");
    }
    
    // Check if creator is in an active game
    const isCreatorInGame = await isPlayerInActiveGame(game.createdBy);
    
    if (isCreatorInGame) {
      // If creator is in another active game, auto-reject this one
      await updateDoc(gameRef, {
        status: "rejected",
        updatedAt: serverTimestamp(),
        rejectionReason: "The game creator is already in an active game"
      });
      
      throw new Error("Cannot accept: The game creator is already in an active game");
    }
    
    // Update game status to accepted and set initial activePlayer
    await updateDoc(gameRef, {
      status: "accepted",
      updatedAt: serverTimestamp(),
      activePlayer: game.settings.startingPlayer === "creator" ? game.createdBy : 
                   game.settings.startingPlayer === "opponent" ? game.opponent : 
                   Math.random() < 0.5 ? game.createdBy : game.opponent // Random if not specified
    });
    
    // Get updated game
    const updatedGameSnap = await getDoc(gameRef);
    return { id: updatedGameSnap.id, ...updatedGameSnap.data() } as Game;
  } catch (error) {
    console.error("Error accepting game invitation:", error);
    throw error; // Re-throw error to properly handle it in the UI
  }
};

// Reject a game invitation
export const rejectGameInvitation = async (gameId: string, reason?: string): Promise<Game | null> => {
  try {
    if (!auth.currentUser) throw new Error("You must be logged in to reject a game");
    
    const gameRef = doc(db, "games", gameId);
    const gameSnap = await getDoc(gameRef);
    
    if (!gameSnap.exists()) throw new Error("Game not found");
    
    const game = gameSnap.data() as Game;
    
    // Verify user is the opponent (only opponents can reject invitations)
    if (game.opponent !== auth.currentUser.uid) {
      throw new Error("You are not authorized to reject this invitation");
    }
    
    // Verify game is in invited status
    if (game.status !== "invited") {
      throw new Error("This game is not in invitation status");
    }
    
    // Update game status to rejected
    await updateDoc(gameRef, {
      status: "rejected",
      updatedAt: serverTimestamp(),
      rejectionReason: reason || "Invitation declined by opponent"
    });
    
    // Get updated game
    const updatedGameSnap = await getDoc(gameRef);
    return { id: updatedGameSnap.id, ...updatedGameSnap.data() } as Game;
  } catch (error) {
    console.error("Error rejecting game invitation:", error);
    return null;
  }
};

// Start a game (transition from accepted to in_progress)
export const startGame = async (gameId: string): Promise<Game | null> => {
  try {
    if (!auth.currentUser) throw new Error("You must be logged in to start a game");
    
    const gameRef = doc(db, "games", gameId);
    const gameSnap = await getDoc(gameRef);
    
    if (!gameSnap.exists()) throw new Error("Game not found");
    
    const game = gameSnap.data() as Game;
    
    // Verify user is part of this game
    const userId = auth.currentUser.uid;
    if (game.createdBy !== userId && game.opponent !== userId) {
      throw new Error("You are not authorized to start this game");
    }
    
    // Verify game is in accepted status
    if (game.status !== "accepted") {
      throw new Error("This game is not ready to start");
    }
    
    // Determine who goes first (use settings or random if not specified)
    const firstPlayer = game.settings.startingPlayer === "creator" ? game.createdBy :
                       game.settings.startingPlayer === "opponent" ? game.opponent :
                       Math.random() < 0.5 ? game.createdBy : game.opponent;
    
    // Update game status to in_progress and set activePlayer
    await updateDoc(gameRef, {
      status: "in_progress",
      updatedAt: serverTimestamp(),
      activePlayer: firstPlayer
    });
    
    // Get updated game
    const updatedGameSnap = await getDoc(gameRef);
    return { id: updatedGameSnap.id, ...updatedGameSnap.data() } as Game;
  } catch (error) {
    console.error("Error starting game:", error);
    throw error; // Re-throw error for better UI handling
  }
};

export const submitGameScore = async (gameId: string, creatorScore: number, opponentScore: number): Promise<Game | null> => {
  try {
    if (!auth.currentUser) throw new Error("You must be logged in to submit a score");
    
    const gameRef = doc(db, "games", gameId);
    const gameSnap = await getDoc(gameRef);
    
    if (!gameSnap.exists()) throw new Error("Game not found");
    
    const game = gameSnap.data() as Game;
    
    // Verify user is part of this game
    const userId = auth.currentUser.uid;
    if (game.createdBy !== userId && game.opponent !== userId) {
      throw new Error("You are not authorized to update this game");
    }
    
    // Verify game is in active play status
    if (game.status !== "in_progress" && game.status !== "accepted") {
      throw new Error("This game is not in progress");
    }
    
    // Verify this is the active player's turn to submit scores
    if (game.activePlayer && game.activePlayer !== userId) {
      throw new Error("It's not your turn to submit scores");
    }
    
    // Validate scores
    if (creatorScore < 0 || opponentScore < 0) {
      throw new Error("Scores cannot be negative");
    }
    
    // Ensure at least one player has reached the winning score
    const maxScore = Math.max(creatorScore, opponentScore);
    if (maxScore < game.settings.pointsToWin) {
      throw new Error(`At least one player must reach ${game.settings.pointsToWin} points to end the game`);
    }
    
    // Determine winner
    const winner = creatorScore > opponentScore ? game.createdBy : opponentScore > creatorScore ? game.opponent : undefined;
    
    // Update game with scores
    const updates = {
      scores: {
        creator: creatorScore,
        opponent: opponentScore
      },
      status: "waiting_confirmation" as GameStatus,
      updatedAt: serverTimestamp(),
      winner: winner,
      // Set the user who needs to confirm (the other player)
      confirmedBy: userId === game.createdBy ? game.opponent : game.createdBy,
      // Clear activePlayer during confirmation phase
      activePlayer: null
    };
    
    await updateDoc(gameRef, updates);
    
    // Get updated game
    const updatedGameSnap = await getDoc(gameRef);
    return { id: updatedGameSnap.id, ...updatedGameSnap.data() } as Game;
  } catch (error) {
    console.error("Error submitting score:", error);
    throw error; // Re-throw error for better UI handling
  }
};

export const confirmGameResult = async (gameId: string, isConfirmed: boolean): Promise<Game | null> => {
  try {
    if (!auth.currentUser) throw new Error("You must be logged in to confirm a game");
    
    const gameRef = doc(db, "games", gameId);
    const gameSnap = await getDoc(gameRef);
    
    if (!gameSnap.exists()) throw new Error("Game not found");
    
    const game = gameSnap.data() as Game;
    
    // Verify this user is the one who needs to confirm
    const userId = auth.currentUser.uid;
    if (game.confirmedBy !== userId) {
      throw new Error("You are not authorized to confirm this game");
    }
    
    if (!isConfirmed) {
      // User rejected the result - reset scores and status
      // Set activePlayer to the user who submitted the original scores
      const submittedBy = userId === game.createdBy ? game.opponent : game.createdBy;
      
      await updateDoc(gameRef, {
        status: "in_progress" as GameStatus,
        scores: {},
        winner: null,
        confirmedBy: null,
        activePlayer: submittedBy, // Set the active player to the one who submitted the rejected scores
        updatedAt: serverTimestamp()
      });
    } else {
      // User confirmed the result - finalize game and update user stats
      await updateDoc(gameRef, {
        status: "completed" as GameStatus,
        updatedAt: serverTimestamp(),
        confirmedBy: null,
        activePlayer: null, // Clear active player on completion
        completedAt: serverTimestamp() // Add completion timestamp for ranking purposes
      });
      
      // Update stats for both players
      if (game.scores && game.winner) {
        // Update stats in parallel for better performance
        await Promise.all([
          updateUserStats(game.createdBy, game.scores.creator, game.winner === game.createdBy),
          updateUserStats(game.opponent, game.scores.opponent, game.winner === game.opponent)
        ]);
      }
    }
    
    // Get updated game
    const updatedGameSnap = await getDoc(gameRef);
    return { id: updatedGameSnap.id, ...updatedGameSnap.data() } as Game;
  } catch (error) {
    console.error("Error confirming game result:", error);
    throw error; // Re-throw error for better UI handling
  }
};

// Helper to update user stats after a game
const updateUserStats = async (userId: string, points: number, isWinner: boolean): Promise<void> => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return;
    
    const user = userSnap.data() as UserProfile;
    
    const updatedStats = {
      gamesPlayed: (user.stats?.gamesPlayed || 0) + 1,
      gamesWon: (user.stats?.gamesWon || 0) + (isWinner ? 1 : 0),
      totalPoints: (user.stats?.totalPoints || 0) + points,
      lastGameAt: serverTimestamp(),
      winStreak: isWinner ? (user.stats?.winStreak || 0) + 1 : 0,
      maxWinStreak: isWinner ? 
        Math.max((user.stats?.winStreak || 0) + 1, (user.stats?.maxWinStreak || 0)) : 
        (user.stats?.maxWinStreak || 0)
    };
    
    await updateDoc(userRef, { stats: updatedStats });
    
    // Always update rankings when any game is completed
    await updateGlobalRankings();
  } catch (error) {
    console.error("Error updating user stats:", error);
  }
};

// Helper to calculate player title based on wins
export const calculateTitle = (wins: number): string => {
  if (wins >= 25) return "Duro del 6";
  if (wins >= 15) return "Tranquero";
  if (wins >= 8) return "Matador";
  return "Novice";
};

// Rankings functions
export interface RankingEntry {
  userId: string;
  username: string;
  displayName: string;
  photoURL?: string;
  gamesPlayed: number;
  gamesWon: number;
  totalPoints: number;
  winRate: number;
  rank: number;
}

// Get global rankings of all players
export const getGlobalRankings = async (): Promise<RankingEntry[]> => {
  try {
    const usersQuery = query(
      usersCollection,
      where("stats.gamesPlayed", ">", 0),
      orderBy("stats.gamesPlayed", "desc"),
      limit(DEFAULT_QUERY_LIMIT)
    );
    
    const querySnapshot = await getDocs(usersQuery);
    const rankingData: RankingEntry[] = [];
    
    querySnapshot.forEach((doc) => {
      const userData = doc.data() as UserProfile;
      
      const winRate = userData.stats.gamesPlayed > 0 
        ? (userData.stats.gamesWon / userData.stats.gamesPlayed) * 100 
        : 0;
        
      rankingData.push({
        userId: userData.uid,
        username: userData.username || userData.displayName,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        gamesPlayed: userData.stats.gamesPlayed,
        gamesWon: userData.stats.gamesWon,
        totalPoints: userData.stats.totalPoints,
        winRate: winRate,
        rank: 0, // Will be calculated after sorting
      });
    });
    
    // Sort by classification criteria:
    // 1. Games won (descending)
    // 2. Total points (descending)
    // 3. Win rate (descending)
    rankingData.sort((a, b) => {
      // First by games won
      if (b.gamesWon !== a.gamesWon) {
        return b.gamesWon - a.gamesWon;
      }
      
      // Then by total points
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      
      // Finally by win rate
      return b.winRate - a.winRate;
    });
    
    // Assign ranks
    rankingData.forEach((entry, index) => {
      entry.rank = index + 1;
    });
    
    return rankingData;
  } catch (error) {
    console.error("Error getting global rankings:", error);
    return [];
  }
};

// Get rankings filtered by time period
export const getRankingsByTimePeriod = async (period: 'week' | 'month' | 'all'): Promise<RankingEntry[]> => {
  try {
    if (period === 'all') {
      return getGlobalRankings();
    }
    
    const db = getFirestore();
    
    // Calculate the start date for the period
    const now = new Date();
    let startDate: Date;
    
    if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else { // month
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
    }
    
    // Convert to Firestore timestamp
    const startTimestamp = Timestamp.fromDate(startDate);
    
    // Find games within the time period
    const gamesQuery = query(
      collection(db, "games"),
      where("completedAt", ">=", startTimestamp),
      where("status", "==", "completed"),
      limit(DEFAULT_QUERY_LIMIT)
    );
    
    const gamesSnapshot = await getDocs(gamesQuery);
    
    // Count wins and points for each player in this period
    const playerStats: Record<string, { wins: number, played: number, points: number }> = {};
    
    gamesSnapshot.forEach(doc => {
      const game = doc.data() as Game;
      
      // Creator stats
      if (!playerStats[game.createdBy]) {
        playerStats[game.createdBy] = { wins: 0, played: 0, points: 0 };
      }
      playerStats[game.createdBy].played++;
      if (game.winner === game.createdBy) {
        playerStats[game.createdBy].wins++;
      }
      if (game.scores) {
        playerStats[game.createdBy].points += game.scores.creator;
      }
      
      // Opponent stats
      if (!playerStats[game.opponent]) {
        playerStats[game.opponent] = { wins: 0, played: 0, points: 0 };
      }
      playerStats[game.opponent].played++;
      if (game.winner === game.opponent) {
        playerStats[game.opponent].wins++;
      }
      if (game.scores) {
        playerStats[game.opponent].points += game.scores.opponent;
      }
    });
    
    // Get user details for all players with stats in this period
    const playerIds = Object.keys(playerStats);
    if (playerIds.length === 0) return [];
    
    const usersQuery = query(
      usersCollection,
      where("uid", "in", playerIds)
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    
    // Build ranking entries
    const rankingData: RankingEntry[] = [];
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data() as UserProfile;
      const uid = userData.uid;
      const stats = playerStats[uid];
      
      if (stats && stats.played > 0) {
        const winRate = stats.played > 0 ? (stats.wins / stats.played) * 100 : 0;
        
        rankingData.push({
          userId: uid,
          username: userData.username || userData.displayName,
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          gamesPlayed: stats.played,
          gamesWon: stats.wins,
          totalPoints: stats.points,
          winRate: winRate,
          rank: 0 // Will be calculated after sorting
        });
      }
    });
    
    // Sort and assign ranks
    rankingData.sort((a, b) => {
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.winRate - a.winRate;
    });
    
    rankingData.forEach((entry, index) => {
      entry.rank = index + 1;
    });
    
    return rankingData;
  } catch (error) {
    console.error("Error getting rankings by time period:", error);
    return [];
  }
};

// Get player's rank in global rankings
export const getPlayerRank = async (userId: string): Promise<number> => {
  try {
    const rankings = await getGlobalRankings();
    const playerRanking = rankings.find(rank => rank.userId === userId);
    return playerRanking?.rank || 0;
  } catch (error) {
    console.error("Error getting player rank:", error);
    return 0;
  }
};

// Update global rankings for all players
export const updateGlobalRankings = async (): Promise<boolean> => {
  try {
    // Get all users with at least one game played
    const usersQuery = query(
      usersCollection,
      where("stats.gamesPlayed", ">", 0),
      limit(DEFAULT_QUERY_LIMIT)
    );
    
    const querySnapshot = await getDocs(usersQuery);
    const users = querySnapshot.docs.map(doc => ({
      ...doc.data() as UserProfile,
      ref: doc.ref
    }));
    
    // Sort users by ranking criteria
    users.sort((a, b) => {
      // First by games won
      if (b.stats.gamesWon !== a.stats.gamesWon) {
        return b.stats.gamesWon - a.stats.gamesWon;
      }
      
      // Then by total points
      if (b.stats.totalPoints !== a.stats.totalPoints) {
        return b.stats.totalPoints - a.stats.totalPoints;
      }
      
      // Finally by win rate
      const aWinRate = a.stats.gamesPlayed > 0 ? (a.stats.gamesWon / a.stats.gamesPlayed) : 0;
      const bWinRate = b.stats.gamesPlayed > 0 ? (b.stats.gamesWon / b.stats.gamesPlayed) : 0;
      return bWinRate - aWinRate;
    });
    
    // Update rank for each user
    const updatePromises = users.map((user, index) => {
      return updateDoc(user.ref, {
        "stats.globalRank": index + 1,
        "stats.lastRankUpdate": serverTimestamp()
      });
    });
    
    await Promise.all(updatePromises);
    return true;
  } catch (error) {
    console.error("Error updating global rankings:", error);
    return false;
  }
};

// Username management functions
export const checkUsernameExists = async (username: string): Promise<boolean> => {
  try {
    const q = query(
      usersCollection,
      where("username", "==", username.toLowerCase())
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error checking username:", error);
    return false;
  }
};

export const updateUsername = async (userId: string, username: string): Promise<boolean> => {
  try {
    // First check if user already has a username set
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      // If username is already set, don't allow changes
      if (userData.hasSetUsername === true || userData.username) {
        console.log("Username already set and cannot be changed");
        return false;
      }
    }
    
    // Check if username exists
    const exists = await checkUsernameExists(username);
    if (exists) {
      return false;
    }
    
        // Update user profile
        await updateDoc(userRef, {
          username: username.toLowerCase(),
          displayName: username,
          hasSetUsername: true,
          // Initialize stats if not already set
          stats: {
            gamesPlayed: 0,
            gamesWon: 0,
            totalPoints: 0
          }
        });
    
    return true;
  } catch (error) {
    console.error("Error updating username:", error);
    return false;
  }
};

// Get all active leagues with their rankings - OPTIMIZED VERSION
export const getAllLeaguesWithRankings = async (): Promise<{
  id: string;
  name: string;
  description?: string;
  photoURL?: string;
  createdAt: Timestamp;
  status: string;
  currentSeason?: string;
  seasonIds?: string[]; // Array of associated season IDs
  rankings: RankingEntry[];
}[]> => {
  try {
    // Get all active leagues first
    const leaguesQuery = query(
      collection(db, "leagues"),
      where("status", "==", "active"),
      orderBy("name", "asc"),
      limit(DEFAULT_QUERY_LIMIT)
    );
    
    const leaguesSnapshot = await getDocs(leaguesQuery);
    
    if (leaguesSnapshot.empty) {
      return [];
    }
    
    const leagueIds = leaguesSnapshot.docs.map(doc => doc.id);
    
    // Fetch all league-season associations in parallel
    const leagueSeasonsPromise = Promise.all(
      leagueIds.map(async (leagueId) => {
        try {
          const leagueSeasonsQuery = query(
            collection(db, "leagueSeasons"),
            where("leagueId", "==", leagueId),
            where("status", "==", "active")
          );
          const leagueSeasonsSnap = await getDocs(leagueSeasonsQuery);
          return {
            leagueId,
            seasonIds: leagueSeasonsSnap.docs.map(doc => doc.data().seasonId)
          };
        } catch (error) {
          console.warn(`Error fetching seasons for league ${leagueId}:`, error);
          return { leagueId, seasonIds: [] };
        }
      })
    );
    
    // Fetch all league rankings in parallel
    const rankingsPromise = Promise.all(
      leagueIds.map(async (leagueId) => {
        try {
          const rankings = await getLeagueRankings(leagueId);
          return { leagueId, rankings };
        } catch (error) {
          console.warn(`Error fetching rankings for league ${leagueId}:`, error);
          return { leagueId, rankings: [] };
        }
      })
    );
    
    // Wait for all data to be fetched in parallel
    const [leagueSeasons, leagueRankings] = await Promise.all([
      leagueSeasonsPromise,
      rankingsPromise
    ]);
    
    // Create lookup maps for better performance
    const seasonsMap = new Map(leagueSeasons.map(ls => [ls.leagueId, ls.seasonIds]));
    const rankingsMap = new Map(leagueRankings.map(lr => [lr.leagueId, lr.rankings]));
    
    // Build final result array
    const leagues = leaguesSnapshot.docs.map(leagueDoc => {
      const leagueData = leagueDoc.data();
      return {
        id: leagueDoc.id,
        name: leagueData.name,
        description: leagueData.description,
        photoURL: leagueData.photoURL,
        createdAt: leagueData.createdAt,
        status: leagueData.status,
        currentSeason: leagueData.currentSeason || "2024",
        seasonIds: seasonsMap.get(leagueDoc.id) || [],
        rankings: rankingsMap.get(leagueDoc.id) || []
      };
    });
    
    return leagues;
  } catch (error) {
    console.error("Error getting leagues with rankings:", error);
    return [];
  }
};

// Get rankings for a specific league - OPTIMIZED VERSION
export const getLeagueRankings = async (leagueId: string): Promise<RankingEntry[]> => {
  try {
    const db = getFirestore();
    
    // Get all members and games in parallel for better performance
    const [allMemberSnap, gamesSnapshot] = await Promise.all([
      // Get all league members (active and inactive for complete stats)
      getDocs(query(
        collection(db, "leagueMemberships"),
        where("leagueId", "==", leagueId),
        where("status", "in", ["active", "inactive"]),
        limit(DEFAULT_QUERY_LIMIT)
      )),
      // Get all completed league games
      getDocs(query(
        collection(db, "games"),
        where("leagueId", "==", leagueId),
        where("status", "==", "completed"),
        limit(DEFAULT_QUERY_LIMIT)
      ))
    ]);

    const allLeagueUserIds: string[] = [];
    const activeMemberIds: string[] = [];
    
    allMemberSnap.forEach((doc) => {
      const memberData = doc.data();
      allLeagueUserIds.push(memberData.userId);
      
      if (memberData.status === "active") {
        activeMemberIds.push(memberData.userId);
      }
    });

    if (allLeagueUserIds.length === 0) {
      return [];
    }

    // Initialize player stats more efficiently
    const playerStats = Object.fromEntries(
      allLeagueUserIds.map(userId => [
        userId,
        {
          gamesPlayed: 0,
          gamesWon: 0,
          totalPoints: 0,
          userId
        }
      ])
    );

    // Process games to calculate stats efficiently
    gamesSnapshot.forEach((doc) => {
      const game = doc.data() as {
        createdBy: string;
        opponent: string;
        winner?: string;
        scores?: { creator: number; opponent: number };
      };

      // Only count games where both players are league members
      const creatorStats = playerStats[game.createdBy];
      const opponentStats = playerStats[game.opponent];
      
      if (creatorStats && opponentStats) {
        // Update games played
        creatorStats.gamesPlayed++;
        opponentStats.gamesPlayed++;

        // Update wins and points based on winner
        if (game.winner === game.createdBy) {
          creatorStats.gamesWon++;
          creatorStats.totalPoints += 3; // Points for win
          // opponentStats gets 0 points (default)
        } else if (game.winner === game.opponent) {
          opponentStats.gamesWon++;
          opponentStats.totalPoints += 3; // Points for win
          // creatorStats gets 0 points (default)
        } else {
          // Draw or no winner - give 1 point each
          creatorStats.totalPoints += 1;
          opponentStats.totalPoints += 1;
        }
      }
    });

    // Batch user data fetching for better performance
    const activeUserIds = activeMemberIds.filter(userId => playerStats[userId]);
    
    if (activeUserIds.length === 0) {
      return [];
    }

    // Use batch size for user fetching to avoid hitting Firestore limits
    const BATCH_SIZE = 10;
    const userDetailsBatches = [];
    
    for (let i = 0; i < activeUserIds.length; i += BATCH_SIZE) {
      const batch = activeUserIds.slice(i, i + BATCH_SIZE);
      userDetailsBatches.push(
        Promise.all(batch.map(async (userId) => {
          try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                userId,
                displayName: userData.displayName || userData.username || userId,
                username: userData.username,
                photoURL: userData.photoURL
              };
            }
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error);
          }
          return {
            userId,
            displayName: userId,
            username: userId,
            photoURL: undefined
          };
        }))
      );
    }

    // Await all user detail batches
    const userDetailsBatchResults = await Promise.all(userDetailsBatches);
    const userDetails = userDetailsBatchResults.flat();
    
    // Create user map for O(1) lookup
    const userMap = new Map(userDetails.map(user => [user.userId, user]));

    // Build and sort rankings for active members only
    const rankings = activeUserIds
      .map(userId => {
        const stats = playerStats[userId];
        const userDetail = userMap.get(userId);
        const winRate = stats.gamesPlayed > 0 ? (stats.gamesWon / stats.gamesPlayed) * 100 : 0;
        
        return {
          userId: stats.userId,
          displayName: userDetail?.displayName || stats.userId,
          username: userDetail?.username || stats.userId,
          photoURL: userDetail?.photoURL,
          gamesPlayed: stats.gamesPlayed,
          gamesWon: stats.gamesWon,
          totalPoints: stats.totalPoints,
          winRate: winRate,
          rank: 0 // Will be set after sorting
        } as RankingEntry;
      })
      .sort((a, b) => {
        // Optimized sorting: total points first, then win rate, then games won
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.gamesWon - a.gamesWon;
      })
      .map((player, index) => ({
        ...player,
        rank: index + 1
      }));

    return rankings;
  } catch (error) {
    console.error("Error getting league rankings:", error);
    return [];
  }
};

// Get user's leagues for game creation
export const getUserLeagues = async (): Promise<{id: string, name: string, settings: any}[]> => {
  try {
    if (!auth.currentUser) return [];
    
    // Get user's league memberships
    const membershipsQuery = query(
      collection(db, "leagueMemberships"),
      where("userId", "==", auth.currentUser.uid),
      where("status", "==", "active"),
      limit(DEFAULT_QUERY_LIMIT)
    );
    
    const membershipsSnap = await getDocs(membershipsQuery);
    const leagueIds = membershipsSnap.docs.map(doc => doc.data().leagueId);
    
    if (leagueIds.length === 0) return [];
    
    // Get all active leagues, then filter by IDs
    const leaguesQuery = query(
      collection(db, "leagues"),
      where("status", "==", "active"),
      limit(DEFAULT_QUERY_LIMIT)
    );
    const leaguesSnap = await getDocs(leaguesQuery);
    return leaguesSnap.docs
      .filter(doc => leagueIds.includes(doc.id))
      .map(doc => ({
        id: doc.id,
        name: doc.data().name,
        settings: doc.data().settings,
        photoURL: doc.data().photoURL || null,
        description: doc.data().description || ""
      }));
  } catch (error) {
    console.error("Error getting user leagues:", error);
    return [];
  }
};

// Get leagues for any user with ranking information
export const getUserLeaguesWithRanking = async (userId: string): Promise<{
  id: string; 
  name: string; 
  settings: any;
  photoURL?: string;
  description?: string;
  rank?: number;
  totalMembers?: number;
}[]> => {
  try {
    // Get user's league memberships
    const membershipsQuery = query(
      collection(db, "leagueMemberships"),
      where("userId", "==", userId),
      where("status", "==", "active"),
      limit(DEFAULT_QUERY_LIMIT)
    );
    
    const membershipsSnap = await getDocs(membershipsQuery);
    const leagueIds = membershipsSnap.docs.map(doc => doc.data().leagueId);
    
    if (leagueIds.length === 0) return [];
    
    // Get league details and rankings in parallel
    const leaguePromises = leagueIds.map(async (leagueId) => {
      try {
        // Get league details
        const leagueDoc = await getDoc(doc(db, "leagues", leagueId));
        if (!leagueDoc.exists() || leagueDoc.data().status !== "active") {
          return null;
        }

        const leagueData = leagueDoc.data();
        
        // Get league rankings to find user's position
        const rankings = await getLeagueRankings(leagueId);
        const userRanking = rankings.find(r => r.userId === userId);
        
        return {
          id: leagueId,
          name: leagueData.name,
          settings: leagueData.settings,
          photoURL: leagueData.photoURL || null,
          description: leagueData.description || null,
          rank: userRanking?.rank,
          totalMembers: rankings.length
        };
      } catch (error) {
        console.error(`Error getting league ${leagueId}:`, error);
        return null;
      }
    });

    const leagues = (await Promise.all(leaguePromises)).filter(Boolean);
    return leagues as any[];
  } catch (error) {
    console.error("Error getting user leagues with ranking:", error);
    return [];
  }
};

// Get all active leagues (for game creation dropdown)
export const getAllActiveLeagues = async (): Promise<{id: string, name: string, settings: any}[]> => {
  try {
    const leaguesQuery = query(
      collection(db, "leagues"),
      where("status", "==", "active"),
      orderBy("name", "asc"),
      limit(DEFAULT_QUERY_LIMIT)
    );
    
    const leaguesSnap = await getDocs(leaguesQuery);
    return leaguesSnap.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      settings: doc.data().settings
    }));
  } catch (error) {
    console.error("Error getting all active leagues:", error);
    return [];
  }
};

// Get league by ID
export const getLeagueById = async (leagueId: string): Promise<{id: string, name: string, photoURL?: string} | null> => {
  try {
    const leagueDoc = doc(db, "leagues", leagueId);
    const leagueSnap = await getDoc(leagueDoc);
    
    if (leagueSnap.exists()) {
      const data = leagueSnap.data();
      return {
        id: leagueSnap.id,
        name: data.name,
        photoURL: data.photoURL
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error getting league by ID:", error);
    return null;
  }
};

// Season functions
export const getAllSeasons = async (leagueId?: string): Promise<Season[]> => {
  try {
    let seasonsQuery;
    
    if (leagueId) {
      // Get seasons for specific league
      seasonsQuery = query(
        collection(db, "seasons"),
        where("leagueId", "==", leagueId),
        orderBy("startDate", "desc")
      );
    } else {
      // Get global seasons (leagueId is null)
      seasonsQuery = query(
        collection(db, "seasons"),
        where("leagueId", "==", null),
        orderBy("startDate", "desc")
      );
    }
    
    const seasonsSnap = await getDocs(seasonsQuery);
    return seasonsSnap.docs.map(doc => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        ...data
      } as Season;
    });
  } catch (error) {
    console.error("Error getting seasons:", error);
    return [];
  }
};

export const getCurrentSeason = async (leagueId?: string): Promise<Season | null> => {
  try {
    let seasonQuery;
    
    if (leagueId) {
      // Get current season for specific league
      seasonQuery = query(
        collection(db, "seasons"),
        where("leagueId", "==", leagueId),
        where("status", "==", "active"),
        orderBy("startDate", "desc"),
        limit(1)
      );
    } else {
      // Get current global season
      seasonQuery = query(
        collection(db, "seasons"),
        where("leagueId", "==", null),
        where("status", "==", "active"),
        orderBy("startDate", "desc"),
        limit(1)
      );
    }
    
    const seasonSnap = await getDocs(seasonQuery);
    
    if (!seasonSnap.empty) {
      const data = seasonSnap.docs[0].data() as any;
      return {
        id: seasonSnap.docs[0].id,
        ...data
      } as Season;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting current season:", error);
    return null;
  }
};

export const getDefaultSeason = async (leagueId?: string): Promise<Season | null> => {
  try {
    let seasonQuery;
    
    if (leagueId) {
      // Get default season for specific league
      seasonQuery = query(
        collection(db, "seasons"),
        where("leagueId", "==", leagueId),
        where("isDefault", "==", true),
        limit(1)
      );
    } else {
      // Get default global season
      seasonQuery = query(
        collection(db, "seasons"),
        where("leagueId", "==", null),
        where("isDefault", "==", true),
        limit(1)
      );
    }
    
    const seasonSnap = await getDocs(seasonQuery);
    
    if (!seasonSnap.empty) {
      const data = seasonSnap.docs[0].data() as any;
      return {
        id: seasonSnap.docs[0].id,
        ...data
      } as Season;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting default season:", error);
    return null;
  }
};

export const createSeason = async (seasonData: Omit<Season, 'id' | 'stats'>): Promise<string> => {
  try {
    const seasonsRef = collection(db, "seasons");
    const docRef = await addDoc(seasonsRef, {
      ...seasonData,
      stats: {
        totalGames: 0,
        totalPlayers: 0,
        completedGames: 0
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return docRef.id;
  } catch (error) {
    console.error("Error creating season:", error);
    throw error;
  }
};

export const updateSeasonStatus = async (seasonId: string, status: Season['status']): Promise<void> => {
  try {
    const seasonRef = doc(db, "seasons", seasonId);
    await updateDoc(seasonRef, {
      status,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating season status:", error);
    throw error;
  }
};

export const updateSeasonStats = async (seasonId: string, stats: Partial<Season['stats']>): Promise<void> => {
  try {
    const seasonRef = doc(db, "seasons", seasonId);
    const seasonDoc = await getDoc(seasonRef);
    
    if (seasonDoc.exists()) {
      const currentStats = seasonDoc.data().stats || {};
      await updateDoc(seasonRef, {
        stats: {
          ...currentStats,
          ...stats
        },
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Error updating season stats:", error);
    throw error;
  }
};

// Get seasons associated with a specific league
export const getLeagueSeasons = async (leagueId: string): Promise<Season[]> => {
  try {
    // Get league-season associations
    const leagueSeasonsQuery = query(
      collection(db, "leagueSeasons"),
      where("leagueId", "==", leagueId)
    );
    
    const leagueSeasonsSnap = await getDocs(leagueSeasonsQuery);
    const seasonIds = leagueSeasonsSnap.docs.map(doc => doc.data().seasonId);
    
    if (seasonIds.length === 0) {
      return [];
    }
    
    // Get the actual season documents
    const seasonsPromises = seasonIds.map(async (seasonId) => {
      const seasonDoc = await getDoc(doc(db, "seasons", seasonId));
      if (seasonDoc.exists()) {
        return {
          id: seasonDoc.id,
          ...seasonDoc.data()
        } as Season;
      }
      return null;
    });
    
    const seasons = await Promise.all(seasonsPromises);
    return seasons.filter(season => season !== null) as Season[];
  } catch (error) {
    console.error("Error getting league seasons:", error);
    return [];
  }
};

// Update league status based on season dates
export const updateLeagueStatusBySeason = async (leagueId: string): Promise<boolean> => {
  try {
    // Get league data
    const leagueRef = doc(db, "leagues", leagueId);
    const leagueDoc = await getDoc(leagueRef);
    
    if (!leagueDoc.exists()) {
      // Only log in development mode since this is handled upstream now
      if (import.meta.env.DEV) {
        console.warn(`League ${leagueId} not found during status update`);
      }
      return false;
    }
    
    const currentLeagueData = leagueDoc.data();
    const currentStatus = currentLeagueData.status;
    
    // Get associated seasons
    const seasons = await getLeagueSeasons(leagueId);
    
    if (seasons.length === 0) {
      // No seasons associated, don't auto-update
      return false;
    }
    
    // Determine new status based on season dates
    const now = new Date();
    let newStatus = currentStatus;
    
    // Find active seasons
    const activeSeasons = seasons.filter(season => {
      const start = season.startDate.toDate();
      const end = season.endDate.toDate();
      return start <= now && now <= end;
    });
    
    if (activeSeasons.length > 0) {
      newStatus = "active";
    } else {
      // Check for upcoming seasons
      const upcomingSeasons = seasons.filter(season => {
        const start = season.startDate.toDate();
        return start > now;
      }).sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());
      
      if (upcomingSeasons.length > 0) {
        newStatus = "upcoming";
      } else {
        // All seasons are completed
        newStatus = "completed";
      }
    }
    
    // Update if status has changed
    if (newStatus !== currentStatus) {
      await updateDoc(leagueRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
        lastStatusUpdate: serverTimestamp(),
        statusUpdateReason: "automatic_season_based_update"
      });
      
      console.log(`League ${leagueId} status updated from ${currentStatus} to ${newStatus}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error updating league status for ${leagueId}:`, error);
    return false;
  }
};

// Batch update all league statuses
export const updateAllLeagueStatusesBySeasons = async (): Promise<{
  updated: number;
  errors: number;
  total: number;
}> => {
  try {
    // Get all leagues with season associations
    const leagueSeasonsQuery = query(
      collection(db, "leagueSeasons"),
      where("status", "==", "active")
    );
    
    const leagueSeasonsSnap = await getDocs(leagueSeasonsQuery);
    const uniqueLeagueIds = [...new Set(leagueSeasonsSnap.docs.map(doc => doc.data().leagueId))];
    
    // First, verify which leagues actually exist to avoid repeated "not found" errors
    const existingLeagueIds = new Set<string>();
    const verificationPromises = uniqueLeagueIds.map(async (leagueId) => {
      try {
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueDoc = await getDoc(leagueRef);
        if (leagueDoc.exists()) {
          existingLeagueIds.add(leagueId);
        } else {
          // Silently log only in development mode
          if (import.meta.env.DEV) {
            console.warn(`League ${leagueId} referenced in leagueSeasons but doesn't exist`);
          }
        }
      } catch (error) {
        // Silently handle verification errors
        if (import.meta.env.DEV) {
          console.warn(`Error verifying league ${leagueId}:`, error);
        }
      }
    });
    
    await Promise.all(verificationPromises);
    const validLeagueIds = Array.from(existingLeagueIds);
    
    let updated = 0;
    let errors = 0;
    
    // Process only existing leagues in batches
    const batchSize = 10;
    for (let i = 0; i < validLeagueIds.length; i += batchSize) {
      const batch = validLeagueIds.slice(i, i + batchSize);
      
      const updatePromises = batch.map(async (leagueId) => {
        try {
          const wasUpdated = await updateLeagueStatusBySeason(leagueId);
          if (wasUpdated) updated++;
        } catch (error) {
          // Only log errors in development mode
          if (import.meta.env.DEV) {
            console.error(`Error updating league ${leagueId}:`, error);
          }
          errors++;
        }
      });
      
      await Promise.all(updatePromises);
      
      // Small delay between batches to avoid overwhelming Firebase
      if (i + batchSize < validLeagueIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return {
      updated,
      errors,
      total: validLeagueIds.length
    };
  } catch (error) {
    console.error("Error in updateAllLeagueStatusesBySeasons:", error);
    return { updated: 0, errors: 1, total: 0 };
  }
};

// Clean up orphaned leagueSeasons references
export const cleanupOrphanedLeagueSeasons = async (): Promise<{ removed: number; errors: number }> => {
  try {
    // Get all leagueSeasons
    const leagueSeasonsQuery = query(collection(db, "leagueSeasons"));
    const leagueSeasonsSnap = await getDocs(leagueSeasonsQuery);
    
    let removed = 0;
    let errors = 0;
    
    const batchSize = 10;
    for (let i = 0; i < leagueSeasonsSnap.docs.length; i += batchSize) {
      const batch = leagueSeasonsSnap.docs.slice(i, i + batchSize);
      
      const cleanupPromises = batch.map(async (leagueSeasonDoc) => {
        try {
          const data = leagueSeasonDoc.data();
          const leagueId = data.leagueId;
          
          // Check if league exists
          const leagueRef = doc(db, "leagues", leagueId);
          const leagueDoc = await getDoc(leagueRef);
          
          if (!leagueDoc.exists()) {
            // Delete orphaned leagueSeason
            await deleteDoc(leagueSeasonDoc.ref);
            removed++;
            if (import.meta.env.DEV) {
              console.log(`Removed orphaned leagueSeason ${leagueSeasonDoc.id} for non-existent league ${leagueId}`);
            }
          }
        } catch (error) {
          console.error(`Error cleaning up leagueSeason ${leagueSeasonDoc.id}:`, error);
          errors++;
        }
      });
      
      await Promise.all(cleanupPromises);
      
      // Small delay between batches
      if (i + batchSize < leagueSeasonsSnap.docs.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return { removed, errors };
  } catch (error) {
    console.error("Error in cleanupOrphanedLeagueSeasons:", error);
    return { removed: 0, errors: 1 };
  }
};

// Validate league status and update if necessary
export const validateAndUpdateLeagueStatus = async (leagueId: string): Promise<string> => {
  try {
    const leagueRef = doc(db, "leagues", leagueId);
    const leagueDoc = await getDoc(leagueRef);
    
    if (!leagueDoc.exists()) {
      throw new Error(`League ${leagueId} not found`);
    }
    
    const leagueData = leagueDoc.data();
    const currentStatus = leagueData.status;
    
    // Check if status was recently updated (within 6 hours)
    const lastUpdate = leagueData.lastStatusUpdate || leagueData.updatedAt;
    if (lastUpdate) {
      const lastUpdateTime = lastUpdate.toDate();
      const now = new Date();
      const hoursSinceUpdate = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60 * 60);
      
      // If updated recently, trust the current status
      if (hoursSinceUpdate < 6) {
        return currentStatus;
      }
    }
    
    // Update status based on seasons
    await updateLeagueStatusBySeason(leagueId);
    
    // Return the potentially updated status
    const updatedLeagueDoc = await getDoc(leagueRef);
    return updatedLeagueDoc.data()?.status || currentStatus;
  } catch (error) {
    console.error(`Error validating league status for ${leagueId}:`, error);
    return "active"; // Default fallback
  }
};

// Profile image management functions
export const uploadProfileImage = async (file: File, userId: string): Promise<string> => {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Please select a valid image file (JPG, PNG, GIF, WebP)');
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size must be less than 5MB');
    }

    // Create a reference to the user's profile image
    const imageRef = ref(storage, `profile-images/${userId}`);

    // Upload the file
    const snapshot = await uploadBytes(imageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    // Update user's auth profile
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        photoURL: downloadURL
      });
    }

    // Update user document in Firestore
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      photoURL: downloadURL,
      updatedAt: serverTimestamp()
    });

    return downloadURL;
  } catch (error: any) {
    console.error("Error uploading profile image:", error);
    
    // Provide more specific error messages
    if (error.code === 'storage/unauthorized') {
      throw new Error('Firebase Storage is not enabled or rules are not configured. Please check Firebase Console.');
    } else if (error.code === 'storage/quota-exceeded') {
      throw new Error('Storage quota exceeded. Please contact support.');
    } else if (error.message && error.message.includes('CORS')) {
      throw new Error('Firebase Storage is not properly configured. Please enable Storage in Firebase Console.');
    } else {
      throw error;
    }
  }
};

export const deleteProfileImage = async (userId: string): Promise<void> => {
  try {
    // Create a reference to the user's profile image
    const imageRef = ref(storage, `profile-images/${userId}`);

    // Delete the file from storage
    await deleteObject(imageRef);

    // Update user's auth profile to remove photo
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        photoURL: null
      });
    }

    // Update user document in Firestore
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      photoURL: null,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    // If image doesn't exist, that's okay - just update the profile
    if (error instanceof Error && error.message.includes('object-not-found')) {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          photoURL: null
        });
      }
      
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        photoURL: null,
        updatedAt: serverTimestamp()
      });
    } else {
      console.error("Error deleting profile image:", error);
      throw error;
    }
  }
};

// League image management functions
export const uploadLeagueImage = async (file: File, leagueId: string): Promise<string> => {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Please select a valid image file (JPG, PNG, GIF, WebP)');
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size must be less than 5MB');
    }

    // Create a reference to the league image in Firebase Storage
    const imageRef = ref(storage, `league-images/${leagueId}`);
    
    // Upload the file to Firebase Storage
    const snapshot = await uploadBytes(imageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error: any) {
    console.error("Error uploading league image:", error);
    
    // Provide more specific error messages
    if (error.code === 'storage/unauthorized') {
      throw new Error('Firebase Storage is not enabled or rules are not configured. Please check Firebase Console.');
    } else if (error.code === 'storage/quota-exceeded') {
      throw new Error('Storage quota exceeded. Please contact support.');
    } else if (error.message && error.message.includes('CORS')) {
      throw new Error('Firebase Storage is not properly configured. Please enable Storage in Firebase Console.');
    } else {
      throw error;
    }
  }
};

export const deleteLeagueImage = async (leagueId: string): Promise<void> => {
  try {
    // Delete the image from Firebase Storage
    const imageRef = ref(storage, `league-images/${leagueId}`);
    await deleteObject(imageRef);
  } catch (error) {
    // If image doesn't exist, that's okay
    if (error instanceof Error && error.message.includes('object-not-found')) {
      return;
    } else {
      console.error("Error deleting league image:", error);
      throw error;
    }
  }
};

// Complete league deletion function
export const deleteLeagueCompletely = async (leagueId: string): Promise<void> => {
  try {
    console.log(`Starting complete deletion of league ${leagueId}`);
    
    // Step 1: Delete league image from Firebase Storage
    try {
      await deleteLeagueImage(leagueId);
      console.log(`League image deleted for ${leagueId}`);
    } catch (error) {
      console.warn(`Error deleting league image for ${leagueId}:`, error);
      // Continue with deletion even if image deletion fails
    }
    
    // Step 2: Delete all league memberships
    try {
      const membershipsQuery = query(
        collection(db, "leagueMemberships"),
        where("leagueId", "==", leagueId)
      );
      const membershipsSnap = await getDocs(membershipsQuery);
      
      const membershipDeletions = membershipsSnap.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      await Promise.all(membershipDeletions);
      console.log(`Deleted ${membershipsSnap.docs.length} league memberships for ${leagueId}`);
    } catch (error) {
      console.error(`Error deleting league memberships for ${leagueId}:`, error);
      throw error;
    }
    
    // Step 3: Delete all league join requests
    try {
      const joinRequestsQuery = query(
        collection(db, "leagueJoinRequests"),
        where("leagueId", "==", leagueId)
      );
      const joinRequestsSnap = await getDocs(joinRequestsQuery);
      
      const joinRequestDeletions = joinRequestsSnap.docs.map(doc =>
        deleteDoc(doc.ref)
      );
      await Promise.all(joinRequestDeletions);
      console.log(`Deleted ${joinRequestsSnap.docs.length} join requests for ${leagueId}`);
    } catch (error) {
      console.error(`Error deleting join requests for ${leagueId}:`, error);
      throw error;
    }
    
    // Step 4: Delete all league-season associations
    try {
      const leagueSeasonsQuery = query(
        collection(db, "leagueSeasons"),
        where("leagueId", "==", leagueId)
      );
      const leagueSeasonsSnap = await getDocs(leagueSeasonsQuery);
      
      const leagueSeasonDeletions = leagueSeasonsSnap.docs.map(doc =>
        deleteDoc(doc.ref)
      );
      await Promise.all(leagueSeasonDeletions);
      console.log(`Deleted ${leagueSeasonsSnap.docs.length} league-season associations for ${leagueId}`);
    } catch (error) {
      console.error(`Error deleting league-season associations for ${leagueId}:`, error);
      throw error;
    }
    
    // Step 5: Delete all league-specific games
    try {
      const leagueGamesQuery = query(
        collection(db, "games"),
        where("leagueId", "==", leagueId)
      );
      const leagueGamesSnap = await getDocs(leagueGamesQuery);
      
      const gameDeletions = leagueGamesSnap.docs.map(doc =>
        deleteDoc(doc.ref)
      );
      await Promise.all(gameDeletions);
      console.log(`Deleted ${leagueGamesSnap.docs.length} league games for ${leagueId}`);
    } catch (error) {
      console.error(`Error deleting league games for ${leagueId}:`, error);
      throw error;
    }
    
    // Step 6: Delete league invitations (if any)
    try {
      const invitationsQuery = query(
        collection(db, "leagueInvitations"),
        where("leagueId", "==", leagueId)
      );
      const invitationsSnap = await getDocs(invitationsQuery);
      
      const invitationDeletions = invitationsSnap.docs.map(doc =>
        deleteDoc(doc.ref)
      );
      await Promise.all(invitationDeletions);
      console.log(`Deleted ${invitationsSnap.docs.length} league invitations for ${leagueId}`);
    } catch (error) {
      console.error(`Error deleting league invitations for ${leagueId}:`, error);
      // Don't throw here as this collection might not exist
    }
    
    // Step 7: Delete league tournaments and related data (if any)
    try {
      const tournamentsQuery = query(
        collection(db, "leagueTournaments"),
        where("leagueId", "==", leagueId)
      );
      const tournamentsSnap = await getDocs(tournamentsQuery);
      
      const tournamentDeletions = tournamentsSnap.docs.map(doc =>
        deleteDoc(doc.ref)
      );
      await Promise.all(tournamentDeletions);
      console.log(`Deleted ${tournamentsSnap.docs.length} league tournaments for ${leagueId}`);
    } catch (error) {
      console.error(`Error deleting league tournaments for ${leagueId}:`, error);
      // Don't throw here as this collection might not exist
    }
    
    // Step 8: Delete league teams (if any)
    try {
      const teamsQuery = query(
        collection(db, "leagueTeams"),
        where("leagueId", "==", leagueId)
      );
      const teamsSnap = await getDocs(teamsQuery);
      
      const teamDeletions = teamsSnap.docs.map(doc =>
        deleteDoc(doc.ref)
      );
      await Promise.all(teamDeletions);
      console.log(`Deleted ${teamsSnap.docs.length} league teams for ${leagueId}`);
    } catch (error) {
      console.error(`Error deleting league teams for ${leagueId}:`, error);
      // Don't throw here as this collection might not exist
    }
    
    // Step 9: Finally, delete the league document itself
    try {
      const leagueRef = doc(db, "leagues", leagueId);
      await deleteDoc(leagueRef);
      console.log(`League document ${leagueId} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting league document ${leagueId}:`, error);
      throw error;
    }
    
    console.log(`Complete deletion of league ${leagueId} finished successfully`);
  } catch (error) {
    console.error(`Error in complete league deletion for ${leagueId}:`, error);
    throw error;
  }
};

export { auth, db, storage, functions };
export default app;