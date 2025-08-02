import React, { useEffect, useState, memo, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, getUserProfile, getUserGames, getUserLeaguesWithRanking } from "../firebase";
import type { User } from "firebase/auth";
import type { UserProfile } from "../firebase";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { LeagueCard, StatCard, TitleBadge } from "../components/ProfileComponents";
import ProfileCard from "../components/ProfileCard";
import { ExclamationCircleIcon } from "@heroicons/react/24/solid";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

// Memoized components for better performance
const ProfileImage = memo<{ user: User }>(({ user }) => (
  user.photoURL ? (
    <img 
      src={user.photoURL} 
      alt={user.displayName || "Profile"}
      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
    />
  ) : (
    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-bold">
      {user.displayName?.charAt(0)?.toUpperCase() || "P"}
    </div>
  )
));
ProfileImage.displayName = 'ProfileImage';

const GameRow = memo<{ game: GameDisplay; onGameClick: (gameId: string) => void }>(({ game, onGameClick }) => {
  const formatDate = useCallback((dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, []);

  const handleClick = useCallback(() => {
    onGameClick(game.id);
  }, [game.id, onGameClick]);

  return (
    <TableRow 
      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors"
      onClick={handleClick}
    >
      <TableCell className="whitespace-nowrap text-xs sm:text-sm">
        {formatDate(game.date.toString())}
      </TableCell>
      <TableCell className="text-xs sm:text-sm">
        <div className="truncate max-w-20 sm:max-w-none" title={game.opponentName}>
          {game.opponentName}
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell whitespace-nowrap text-xs sm:text-sm capitalize">
        {game.gameMode}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs sm:text-sm">
        <span
          className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium ${
            game.result === "win"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
          }`}
        >
          {game.result === "win" ? "W" : "L"}
          <span className="hidden sm:inline">
            {game.result === "win" ? "on" : "ost"}
          </span>
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs sm:text-sm font-mono">
        {game.score.player} - {game.score.opponent}
      </TableCell>
    </TableRow>
  );
});
GameRow.displayName = 'GameRow';

const LoadingSpinner = memo(() => (
  <div className="flex h-screen w-full items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
));
LoadingSpinner.displayName = 'LoadingSpinner';

// Skeleton loaders for different sections
const ProfileSkeleton = memo(() => (
  <Card className="w-full mb-8">
    <CardContent className="pt-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-300 dark:bg-zinc-600 rounded-full animate-pulse"></div>
        <div className="flex-grow min-w-0 text-center sm:text-left w-full sm:w-auto">
          <div className="h-6 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse mb-2 w-3/4"></div>
          <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse w-1/2"></div>
        </div>
      </div>
    </CardContent>
  </Card>
));
ProfileSkeleton.displayName = 'ProfileSkeleton';

const StatsSkeleton = memo(() => (
  <Card className="w-full mb-8">
    <CardHeader>
      <div className="h-6 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse w-1/3"></div>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-3 sm:p-4 bg-gray-50 dark:bg-zinc-700 rounded-lg">
            <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse mb-2"></div>
            <div className="h-8 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
));
StatsSkeleton.displayName = 'StatsSkeleton';

const GamesSkeleton = memo(() => (
  <Card className="w-full">
    <CardHeader>
      <div className="h-6 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse w-1/4"></div>
    </CardHeader>
    <CardContent className="pt-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">
              <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse"></div>
            </TableHead>
            <TableHead>
              <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse"></div>
            </TableHead>
            <TableHead className="hidden sm:table-cell">
              <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse"></div>
            </TableHead>
            <TableHead>
              <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse"></div>
            </TableHead>
            <TableHead>
              <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse"></div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(3)].map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse w-16"></div>
              </TableCell>
              <TableCell>
                <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse w-24"></div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse w-16"></div>
              </TableCell>
              <TableCell>
                <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse w-8"></div>
              </TableCell>
              <TableCell>
                <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse w-12"></div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
));
GamesSkeleton.displayName = 'GamesSkeleton';

const LeaguesSkeleton = memo(() => (
  <Card className="w-full mb-8">
    <CardHeader>
      <div className="h-6 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse w-1/4"></div>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="flex gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="w-48 h-16 bg-gray-300 dark:bg-zinc-600 rounded animate-pulse"></div>
        ))}
      </div>
    </CardContent>
  </Card>
));
// import ProfileImageUploader from "../components/ProfileImageUploader"; // COMMENTED OUT until Firebase Storage upgrade
// import StorageNotEnabledBanner from "../components/StorageNotEnabledBanner"; // COMMENTED OUT until Firebase Storage upgrade
import ProfileImageUploader from "../components/ProfileImageUploader";
import StorageNotEnabledBanner from "../components/StorageNotEnabledBanner";

// Game result display type
interface GameDisplay {
  id: string;
  date: Date;
  opponentName: string;
  gameMode: "individual" | "teams";
  result: "win" | "loss";
  score: {
    player: number;
    opponent: number;
  };
}

LoadingSpinner.displayName = 'LoadingSpinner';

// Optimized main Profile component with caching and fast loading
const Profile = memo<{ user?: User }>(({ user: propUser }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(propUser || null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [recentGames, setRecentGames] = useState<GameDisplay[]>([]);
  const [userLeagues, setUserLeagues] = useState<{
    id: string;
    name: string;
    settings: any;
    photoURL?: string;
    description?: string;
    rank?: number;
    totalMembers?: number;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState({ profile: true, games: true, leagues: true });
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  // Cache for opponent names to avoid repeated Firebase calls
  const opponentCacheRef = useRef<Map<string, string>>(new Map());

  // Handle game click navigation - memoized
  const handleGameClick = useCallback((gameId: string) => {
    navigate(`/game/${gameId}`);
  }, [navigate]);

  // Handle profile image update
  const handleImageUpdate = useCallback((newPhotoURL: string | null) => {
    setUser(prevUser => {
      if (prevUser) {
        // Update the user state to reflect the new photo URL
        return { ...prevUser, photoURL: newPhotoURL };
      }
      return prevUser;
    });
    
    // Clear any previous upload errors
    setImageUploadError(null);
  }, []);

  // Handle image upload errors
  const handleImageError = useCallback((error: string) => {
    setImageUploadError(error);
    
    // Clear error after 5 seconds
    setTimeout(() => {
      setImageUploadError(null);
    }, 5000);
  }, []);

  // Memoized data fetching functions with parallel loading
  const fetchUserData = useCallback(async (currentUser: User) => {
    try {
      // Reset loading states
      setDataLoading({ profile: true, games: true, leagues: true });

      // Fetch all data in parallel for faster loading
      const [profile, games] = await Promise.all([
        getUserProfile(currentUser.uid),
        getUserGames()
      ]);

      // Set profile immediately (fastest to show)
      setUserProfile(profile);
      setDataLoading(prev => ({ ...prev, profile: false }));

      // Process games with cached opponent names
      const completedGames = games.filter(game => game.status === "completed");
      
      // Fetch opponent names in parallel, using cache when possible
      const gameDisplaysPromises = completedGames.slice(0, 5).map(async (game) => {
        const isCreator = game.createdBy === currentUser.uid;
        const opponentId = isCreator ? game.opponent : game.createdBy;

        // Check cache first
        let opponentName = opponentCacheRef.current.get(opponentId);
        
        if (!opponentName) {
          try {
            const db = getFirestore();
            const opponentDoc = await getDoc(doc(db, "users", opponentId));
            opponentName = opponentDoc.exists() 
              ? opponentDoc.data().displayName 
              : "Unknown Player";
            
            // Cache the result
            opponentCacheRef.current.set(opponentId, opponentName);
          } catch (error) {
            opponentName = "Unknown Player";
          }
        }

        return {
          id: game.id || "",
          date: game.updatedAt?.toDate() || new Date(),
          opponentName,
          gameMode: game.settings.gameMode === "single" ? "individual" : "teams" as "individual" | "teams",
          result: game.winner === currentUser.uid ? "win" : ("loss" as "win" | "loss"),
          score: {
            player: isCreator ? game.scores?.creator || 0 : game.scores?.opponent || 0,
            opponent: isCreator ? game.scores?.opponent || 0 : game.scores?.creator || 0,
          },
        };
      });

      // Fetch leagues in parallel with games processing
      const [gameDisplays, leagues] = await Promise.all([
        Promise.all(gameDisplaysPromises),
        getUserLeaguesWithRanking(currentUser.uid)
      ]);

      setRecentGames(gameDisplays);
      setDataLoading(prev => ({ ...prev, games: false }));
      
      setUserLeagues(leagues);
      setDataLoading(prev => ({ ...prev, leagues: false }));

    } catch (error) {
      console.error("Error fetching profile data:", error);
      // Set loading to false even on error
      setDataLoading({ profile: false, games: false, leagues: false });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        await fetchUserData(currentUser);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserData]);

  // Memoized statistics calculation
  const winRate = useMemo(() => {
    if (!userProfile?.stats?.gamesPlayed || userProfile.stats.gamesPlayed === 0) return null;
    return Math.round((userProfile.stats.gamesWon / userProfile.stats.gamesPlayed) * 100);
  }, [userProfile?.stats]);

  // Show progressive loading - profile loads first, then games and leagues
  const showProfileSection = !dataLoading.profile;
  const showStatsSection = !dataLoading.profile;
  const showLeaguesSection = !dataLoading.leagues;
  const showGamesSection = !dataLoading.games;

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return (
      <div className="p-4 sm:p-6 lg:max-w-6xl lg:mx-auto text-center w-full">
        <h1 className="text-3xl font-bold mb-6">Player Profile</h1>
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <p className="text-lg">Please sign in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 lg:p-6 w-full lg:max-w-6xl lg:mx-auto dark:text-white">
      <h1 className="sr-only">Player Profile</h1>

      {/* Storage Configuration Banner - Show if there are image upload errors */}
      {imageUploadError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          <div className="flex items-center">
            <ExclamationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
            <div>
              <h4 className="font-medium">Image Upload Error</h4>
              <p className="text-sm mt-1">{imageUploadError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Player Info Card */}
      <ProfileCard 
        title="Player Information"
        className="mb-8"
        loading={!showProfileSection}
        skeleton={<ProfileSkeleton />}
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
          <div className="flex-shrink-0">
            {user ? (
              <ProfileImageUploader
                user={user}
                onImageUpdate={handleImageUpdate}
                onError={handleImageError}
                size="lg"
                className="w-20 h-20 sm:w-24 sm:h-24"
              />
            ) : (
              <ProfileImage user={user!} />
            )}
          </div>
          <div className="flex-grow min-w-0 text-center sm:text-left w-full sm:w-auto">
            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white break-words">
              {user.displayName || "Player"}
            </h2>
            {userProfile?.username && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 break-all mt-1">@{userProfile.username}</p>
            )}
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-1 break-all sm:break-words">
              {user.email}
            </p>
            <div className="mt-3">
              <TitleBadge gamesWon={userProfile?.stats?.gamesWon || 0} />
            </div>
          </div>
        </div>
      </ProfileCard>

      {/* User's Leagues Section */}
      <ProfileCard 
        title="Your Leagues"
        className="mb-8"
        loading={!showLeaguesSection}
        skeleton={<LeaguesSkeleton />}
      >
        {userLeagues.length === 0 ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">You are not a member of any active leagues.</div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {userLeagues.map((league) => (
              <LeagueCard 
                key={league.id} 
                league={league} 
                showRanking={true}
                href={`/leagues/${league.id}`}
              />
            ))}
          </div>
        )}
      </ProfileCard>

      {/* Stats Overview */}
      <ProfileCard 
        title="Player Statistics"
        className="mb-8"
        loading={!showStatsSection}
        skeleton={<StatsSkeleton />}
      >
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <StatCard 
            title="Games Played"
            value={userProfile?.stats?.gamesPlayed || 0}
            color="text-zinc-900 dark:text-white"
          />
          <StatCard 
            title="Games Won"
            value={userProfile?.stats?.gamesWon || 0}
            color="text-green-600 dark:text-green-400"
          />
          <StatCard 
            title="Total Points"
            value={userProfile?.stats?.totalPoints || 0}
            color="text-blue-600 dark:text-blue-400"
            className="col-span-2 lg:col-span-1"
          />
          {winRate !== null && (
            <StatCard 
              title="Win Rate"
              value={`${winRate}%`}
              color="text-purple-600 dark:text-purple-400"
              className="col-span-2 lg:col-span-3"
            />
          )}
        </div>
      </ProfileCard>

      {/* Match History */}
      <ProfileCard 
        title="Last 5 Matches"
        loading={!showGamesSection}
        skeleton={<GamesSkeleton />}
      >
        <div className="overflow-x-auto">
          <Table>
            {recentGames.length === 0 && (
              <TableCaption>No completed games yet</TableCaption>
            )}
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead>Opponent</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentGames.length > 0 ? (
                recentGames.map((game) => (
                  <GameRow key={game.id} game={game} onGameClick={handleGameClick} />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No completed games yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* View All Games Button */}
        {recentGames.length > 0 && (
          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/games')}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              View All Games
            </button>
          </div>
        )}
      </ProfileCard>
    </div>
  );
});

Profile.displayName = 'Profile';

export default Profile;
