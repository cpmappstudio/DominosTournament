import React, { useEffect, useState } from "react";
import { auth, getUserProfile, getUserGames } from "../firebase";
import type { User } from "firebase/auth";
import type { UserProfile } from "../firebase";
import { getFirestore, doc, getDoc } from "firebase/firestore";
// import ProfileImageUploader from "../components/ProfileImageUploader"; // COMMENTED OUT until Firebase Storage upgrade
// import StorageNotEnabledBanner from "../components/StorageNotEnabledBanner"; // COMMENTED OUT until Firebase Storage upgrade

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

const Profile: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [recentGames, setRecentGames] = useState<GameDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  // const [showStorageBanner, setShowStorageBanner] = useState(false); // COMMENTED OUT until Firebase Storage upgrade

  // Handle profile image updates - COMMENTED OUT until Firebase Storage upgrade
  // const handleImageUpdate = (newPhotoURL: string | null) => {
  //   if (user) {
  //     // Create a new user object with updated photoURL
  //     const updatedUser = {
  //       ...user,
  //       photoURL: newPhotoURL
  //     } as User;
  //     setUser(updatedUser);
      
  //     // Hide banner if upload was successful
  //     if (newPhotoURL) {
  //       setShowStorageBanner(false);
  //     }
  //   }
  // };

  // Handle storage errors - COMMENTED OUT until Firebase Storage upgrade
  // const handleStorageError = (error: string) => {
  //   if (error.includes('Firebase Storage') || error.includes('CORS')) {
  //     setShowStorageBanner(true);
  //   }
  // };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          // Fetch user profile with stats
          const profile = await getUserProfile(currentUser.uid);
          setUserProfile(profile);

          // Fetch recent games
          const games = await getUserGames();
          const completedGames = games.filter(
            (game) => game.status === "completed",
          );

          // Get opponent names for display
          const gameDisplays = await Promise.all(
            completedGames.slice(0, 5).map(async (game) => {
              const isCreator = game.createdBy === currentUser.uid;
              const opponentId = isCreator ? game.opponent : game.createdBy;

              // Get opponent profile
              const db = getFirestore();
              const opponentDoc = await getDoc(doc(db, "users", opponentId));
              const opponentName = opponentDoc.exists()
                ? opponentDoc.data().displayName
                : "Unknown Player";

              // Format for display
              return {
                id: game.id || "",
                date: game.updatedAt?.toDate() || new Date(),
                opponentName,
                gameMode: game.settings.gameMode,
                result:
                  game.winner === currentUser.uid
                    ? "win"
                    : ("loss" as "win" | "loss"),
                score: {
                  player: isCreator
                    ? game.scores?.creator || 0
                    : game.scores?.opponent || 0,
                  opponent: isCreator
                    ? game.scores?.opponent || 0
                    : game.scores?.creator || 0,
                },
              };
            }),
          );

          setRecentGames(gameDisplays);
        } catch (error) {
          console.error("Error fetching profile data:", error);
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Calculate player title based on wins
  const calculateTitle = (gamesWon: number): string => {
    if (gamesWon >= 25) return "Duro del 6";
    if (gamesWon >= 15) return "Tranquero";
    if (gamesWon >= 8) return "Matador";
    return "Novice";
  };

  // Format date to more readable format
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-6">Player Profile</h1>
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <p className="text-lg">Please sign in to view your profile.</p>
        </div>
      </div>
    );
  }

  // No longer needed as we calculate the title directly from userProfile

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto text-white">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Player Profile</h1>

      {/* Storage Configuration Banner - COMMENTED OUT until Firebase Storage upgrade */}
      {/* {showStorageBanner && <StorageNotEnabledBanner />} */}

      {/* Player Info Card */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4 sm:p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
          {/* Profile Image from Google Account */}
          <div className="flex-shrink-0">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || "Profile"}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-bold">
                {user.displayName?.charAt(0)?.toUpperCase() || "P"}
              </div>
            )}
          </div>

          {/* User Info Section - Responsive Text */}
          <div className="flex-grow min-w-0 text-center sm:text-left w-full sm:w-auto">
            {/* Display Name - Responsive with word break */}
            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white break-words">
              {user.displayName || "Player"}
            </h2>
            
            {/* Email - Responsive with ellipsis on overflow */}
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-1 break-all sm:break-words">
              {user.email}
            </p>

            {/* Title Badge */}
            <div className="mt-3">
              <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                {userProfile?.stats
                  ? calculateTitle(userProfile.stats.gamesWon)
                  : "New Player"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4 sm:p-6 mb-8">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">Player Statistics</h2>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="p-3 sm:p-4 bg-gray-50 dark:bg-zinc-700 rounded-lg text-center">
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-1">
              Games Played
            </p>
            <p className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-white">
              {userProfile?.stats?.gamesPlayed || 0}
            </p>
          </div>

          <div className="p-3 sm:p-4 bg-gray-50 dark:bg-zinc-700 rounded-lg text-center">
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-1">
              Games Won
            </p>
            <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
              {userProfile?.stats?.gamesWon || 0}
            </p>
          </div>

          <div className="p-3 sm:p-4 bg-gray-50 dark:bg-zinc-700 rounded-lg text-center col-span-2 lg:col-span-1">
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-1">
              Total Points
            </p>
            <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
              {userProfile?.stats?.totalPoints || 0}
            </p>
          </div>

          {/* Win Rate - Additional stat */}
          {userProfile?.stats?.gamesPlayed > 0 && (
            <div className="p-3 sm:p-4 bg-gray-50 dark:bg-zinc-700 rounded-lg text-center col-span-2 lg:col-span-3">
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                Win Rate
              </p>
              <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
                {Math.round((userProfile.stats.gamesWon / userProfile.stats.gamesPlayed) * 100)}%
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Match History */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">Recent Matches</h2>

        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
              <thead>
                <tr>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Opponent
                  </th>
                  <th className="hidden sm:table-cell px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Result
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                {recentGames.length > 0 ? (
                  recentGames.map((game) => (
                    <tr key={game.id}>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-xs sm:text-sm">
                        {formatDate(game.date.toString())}
                      </td>
                      <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm">
                        <div className="truncate max-w-20 sm:max-w-none" title={game.opponentName}>
                          {game.opponentName}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-2 sm:px-4 py-3 whitespace-nowrap text-xs sm:text-sm capitalize">
                        {game.gameMode}
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-xs sm:text-sm">
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
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-xs sm:text-sm font-mono">
                        {game.score.player} - {game.score.opponent}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-2 sm:px-4 py-8 text-center text-gray-500 dark:text-zinc-400 text-sm"
                    >
                      No completed games yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
