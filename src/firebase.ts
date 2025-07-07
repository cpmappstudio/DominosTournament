// Firebase configuration and initialization
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, User, signInWithPopup } from "firebase/auth";
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
  addDoc
} from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC3Ox8ePVNmRALd0aSfXMOy2pfgNw6H45Y",
  authDomain: "domino-federation.firebaseapp.com",
  projectId: "domino-federation",
  storageBucket: "domino-federation.firebasestorage.app",
  messagingSenderId: "960409936120",
  appId: "1:960409936120:web:6fde8f4143c1981c621b0d",
  measurementId: "G-7DE9FKB4QP",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Collection references
const usersCollection = collection(db, "users");
const gamesCollection = collection(db, "games");

// Type definitions
export type GameMode = "individual" | "teams";
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
  opponent: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp; // When the game was completed (for ranking timeframes)
  status: GameStatus;
  settings: {
    gameMode: GameMode;
    pointsToWin: number;
    numberOfPlayers?: number;
    startingPlayer?: string;
    useBoricuaRules?: boolean;
  };
  scores?: {
    creator: number;
    opponent: number;
  };
  confirmedBy?: string;
  winner?: string;
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
      where("username", "<=", searchTerm.toLowerCase() + '\uf8ff')
    );
    
    // Then by display name as fallback
    const displayNameQuery = query(
      usersCollection,
      where("displayName", ">=", searchTerm),
      where("displayName", "<=", searchTerm + '\uf8ff')
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
      .filter(user => user.uid !== auth.currentUser?.uid);
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
};

// Game functions
export const createGame = async (opponentId: string, settings: { 
  gameMode: GameMode, 
  pointsToWin: number,
  numberOfPlayers?: number,
  startingPlayer?: string,
  useBoricuaRules?: boolean
}): Promise<Game | null> => {
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
      settings: settings
    };
    
    const gameRef = await addDoc(gamesCollection, newGame);
    return { ...newGame, id: gameRef.id };
  } catch (error) {
    console.error("Error creating game:", error);
    throw error; // Re-throw the error for better handling in UI
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
    
    // Get games where user is creator or opponent
    const creatorQuery = query(
      gamesCollection,
      where("createdBy", "==", userId),
      orderBy("updatedAt", "desc")
    );
    
    const opponentQuery = query(
      gamesCollection,
      where("opponent", "==", userId),
      orderBy("updatedAt", "desc")
    );
    
    const [creatorSnap, opponentSnap] = await Promise.all([
      getDocs(creatorQuery),
      getDocs(opponentQuery)
    ]);
    
    const creatorGames = creatorSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
    const opponentGames = opponentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
    
    // Combine and sort by updatedAt
    return [...creatorGames, ...opponentGames].sort(
      (a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis()
    );
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
      where("status", "in", activeStatuses)
    );
    
    // Check games where user is opponent
    const opponentQuery = query(
      gamesCollection,
      where("opponent", "==", userId),
      where("status", "in", activeStatuses)
    );
    
    const [creatorSnap, opponentSnap] = await Promise.all([
      getDocs(creatorQuery),
      getDocs(opponentQuery)
    ]);
    
    // If either query returns results, the player is in an active game
    return !creatorSnap.empty || !opponentSnap.empty;
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
    
    // Only query games where current user is the opponent and status is "invited"
    const invitationsQuery = query(
      gamesCollection,
      where("opponent", "==", userId),
      where("status", "==", "invited"),
      orderBy("createdAt", "desc")
    );
    
    const snapshot = await getDocs(invitationsQuery);
    
    // Convert to Game objects
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
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
      orderBy("stats.gamesPlayed", "desc")
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
      where("status", "==", "completed")
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
      where("stats.gamesPlayed", ">", 0)
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

export { auth, db };
export default app;