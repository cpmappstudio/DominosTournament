import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  getFirestore,
  doc as firestoreDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { auth, getUserProfile, UserProfile } from "../../firebase";
import { canManageLeague, isJudge } from "../../utils/auth";
import { useGameConfig } from "../../config/gameConfig";
import {
  TrophyIcon,
  UserGroupIcon,
  CalendarIcon,
  ChartBarIcon,
  PencilSquareIcon,
  PlusIcon,
  UsersIcon,
} from "@heroicons/react/24/solid";
import type { League, LeagueMember, LeagueGame } from "../../models/league";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  getFilteredRowModel,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import UserProfileModal, { useUserProfileModal } from "../../components/UserProfileModal";
import { Timestamp } from "firebase/firestore";
import { Input } from "../../components/ui/input";

const LeagueDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Game configuration hook
  const { config: gameConfig, loading: configLoading } = useGameConfig();
  const [error, setError] = useState<string | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [userMembership, setUserMembership] = useState<LeagueMember | null>(
    null,
  );
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [allMembers, setAllMembers] = useState<LeagueMember[]>([]);
  const [games, setGames] = useState<LeagueGame[]>([]);
  const [activeTab, setActiveTab] = useState<
    "overview" | "standings" | "members" | "games"
  >("overview");
  const [userDisplayNames, setUserDisplayNames] = useState<
    Record<string, string>
  >({});
  const [userProfiles, setUserProfiles] = useState<
    Record<string, { displayName: string; photoURL?: string; email?: string; isJudge?: boolean }>
  >({});
  const [fetchingUserData, setFetchingUserData] = useState(false);
  const [userProfileCache, setUserProfileCache] = useState<Record<string, UserProfile>>({});

  // Use the user profile modal hook
  const { isOpen: isProfileModalOpen, selectedUser, openModal: openProfileModal, closeModal: closeProfileModal } = useUserProfileModal();

  // Helper function to convert StandingEntry to UserProfile
  const convertStandingEntryToUserProfile = useCallback((entry: StandingEntry): UserProfile => {
    return {
      uid: entry.userId,
      displayName: entry.displayName,
      username: entry.displayName, // Use displayName as username fallback
      email: "", // Not available in StandingEntry
      photoURL: entry.photoURL, // Now available from userProfiles
      createdAt: Timestamp.now(), // Placeholder timestamp
      stats: {
        gamesPlayed: entry.gamesPlayed,
        gamesWon: entry.gamesWon,
        totalPoints: entry.pointsFor, // Use pointsFor as totalPoints
        globalRank: 0, // Not available in league standings
        winStreak: 0, // Not available in StandingEntry
        maxWinStreak: 0, // Not available in StandingEntry
      },
      hasSetUsername: !!entry.displayName,
    };
  }, []);

  // Table sorting states
  const [membersSorting, setMembersSorting] = useState<SortingState>([]);
  const [membersColumnFilters, setMembersColumnFilters] = useState<ColumnFiltersState>([]);
  const [membersGlobalFilter, setMembersGlobalFilter] = useState("");
  const [standingsSorting, setStandingsSorting] = useState<SortingState>([]);
  const [gamesSorting, setGamesSorting] = useState<SortingState>([]);

  // Centralized user data fetching with cache
  const fetchUserData = useCallback(async (userIds: string[], forceRefresh = false) => {
    if (userIds.length === 0) return;

    const db = getFirestore();
    
    try {
      const userPromises = userIds.map(async (userId) => {
        try {
          const userDoc = await getDoc(firestoreDoc(db, "users", userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const fullProfile: UserProfile = {
              uid: userId,
              displayName: userData.displayName || userData.username || userId,
              username: userData.username || userId,
              email: userData.email || "",
              photoURL: userData.photoURL,
              createdAt: userData.createdAt || Timestamp.now(),
              stats: userData.stats || {
                gamesPlayed: 0,
                gamesWon: 0,
                totalPoints: 0,
                globalRank: 0,
                winStreak: 0,
                maxWinStreak: 0,
              },
              hasSetUsername: !!userData.displayName || !!userData.username,
            };

            return {
              userId,
              userData,
              isJudgeUser: isJudge(userData.email || ""),
              displayName: userData.displayName || userData.username || userId,
              fullProfile
            };
          }
        } catch (error) {
          console.error(`Error fetching user data for ${userId}:`, error);
        }
        return {
          userId,
          userData: null,
          isJudgeUser: false,
          displayName: userId,
          fullProfile: null
        };
      });

      const userResults = await Promise.all(userPromises);
      
      // Update all state at once
      setUserDisplayNames(prevNames => {
        const updatedNames = { ...prevNames };
        userResults.forEach((result) => {
          updatedNames[result.userId] = result.displayName;
        });
        return updatedNames;
      });

      setUserProfiles(prevProfiles => {
        const updatedProfiles = { ...prevProfiles };
        userResults.forEach((result) => {
          updatedProfiles[result.userId] = {
            displayName: result.displayName,
            photoURL: result.userData?.photoURL,
            email: result.userData?.email,
            isJudge: result.isJudgeUser
          };
        });
        return updatedProfiles;
      });

      // Update cache
      setUserProfileCache(prevCache => {
        const updatedCache = { ...prevCache };
        userResults.forEach((result) => {
          if (result.fullProfile) {
            updatedCache[result.userId] = result.fullProfile;
          }
        });
        return updatedCache;
      });

    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  }, []);

  // Legacy function for backward compatibility
  const fetchUserDisplayNames = useCallback(async (userIds: string[]) => {
    return fetchUserData(userIds);
  }, [fetchUserData]);

  // Check user permissions for managing the league
  const canManage = league
    ? canManageLeague(auth.currentUser, league.createdBy)
    : false;

  // Calculate league standings from games
  const calculateStandings = () => {
    const playerStats: Record<string, { 
      gamesPlayed: number, 
      gamesWon: number, 
      points: number,
      pointsFor: number,
      pointsAgainst: number 
    }> = {};

    // Initialize stats for all members
    members.forEach(member => {
      playerStats[member.userId] = {
        gamesPlayed: 0,
        gamesWon: 0,
        points: 0,
        pointsFor: 0,
        pointsAgainst: 0
      };
    });

    // Calculate stats from completed games
    const completedGames = games.filter(game => game.status === 'completed' && game.scores);
    
    completedGames.forEach(game => {
        // Make sure we have stats for both players (create if missing)
        if (!playerStats[game.createdBy]) {
          playerStats[game.createdBy] = {
            gamesPlayed: 0,
            gamesWon: 0,
            points: 0,
            pointsFor: 0,
            pointsAgainst: 0
          };
        }
        
        if (!playerStats[game.opponent]) {
          playerStats[game.opponent] = {
            gamesPlayed: 0,
            gamesWon: 0,
            points: 0,
            pointsFor: 0,
            pointsAgainst: 0
          };
        }
        
        const creatorStats = playerStats[game.createdBy];
        const opponentStats = playerStats[game.opponent];

        if (creatorStats && opponentStats && game.scores) {
          // Update games played
          creatorStats.gamesPlayed++;
          opponentStats.gamesPlayed++;

          // Update points for/against
          creatorStats.pointsFor += game.scores.creator;
          creatorStats.pointsAgainst += game.scores.opponent;
          opponentStats.pointsFor += game.scores.opponent;
          opponentStats.pointsAgainst += game.scores.creator;

          // Determine winner and update wins/points
          if (game.winner === game.createdBy) {
            creatorStats.gamesWon++;
            creatorStats.points += league?.settings?.scoringSystem?.pointsPerWin || 3;
            opponentStats.points += league?.settings?.scoringSystem?.pointsPerLoss || 0;
          } else if (game.winner === game.opponent) {
            opponentStats.gamesWon++;
            opponentStats.points += league?.settings?.scoringSystem?.pointsPerWin || 3;
            creatorStats.points += league?.settings?.scoringSystem?.pointsPerLoss || 0;
          } else {
            // Draw
            creatorStats.points += league?.settings?.scoringSystem?.pointsPerDraw || 1;
            opponentStats.points += league?.settings?.scoringSystem?.pointsPerDraw || 1;
          }
        }
      });

    // Convert to array and sort by points, then by win rate, then by point differential
    const result = Object.entries(playerStats)
      .map(([userId, stats]) => ({
        userId,
        displayName: userDisplayNames[userId] || userId,
        photoURL: userProfiles[userId]?.photoURL,
        ...stats,
        winRate: stats.gamesPlayed > 0 ? (stats.gamesWon / stats.gamesPlayed) * 100 : 0,
        pointDifferential: stats.pointsFor - stats.pointsAgainst
      }))
      .sort((a, b) => {
        // Sort by points first
        if (b.points !== a.points) return b.points - a.points;
        // Then by win rate
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        // Then by point differential
        return b.pointDifferential - a.pointDifferential;
      });
    
    return result;
  };

  const standings = useMemo(() => calculateStandings(), [members, games, userDisplayNames, userProfiles, league?.settings]);

  // Filter members when userProfiles change (to exclude judges)
  useEffect(() => {
    const filteredMembers = allMembers.filter((member) => {
      const userProfile = userProfiles[member.userId];
      return userProfile && !userProfile.isJudge;
    });
    setMembers(filteredMembers);
  }, [allMembers, userProfiles]);

  // Check if user profiles are still loading for members
  const membersProfilesLoading = members.some(member => !userProfiles[member.userId]);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError(null);

    const db = getFirestore();
    const leagueRef = firestoreDoc(db, "leagues", id);

    // Set up real-time listener for league data
    const unsubLeague = onSnapshot(
      leagueRef,
      (leagueSnap) => {
        if (!leagueSnap.exists()) {
          setError("League not found");
          setLoading(false);
          return;
        }

        const leagueData = {
          id: leagueSnap.id,
          ...leagueSnap.data(),
        } as League;
        
        // Check if user has access to this league
        if (!leagueData.isPublic && auth.currentUser) {
          const isCreator = leagueData.createdBy === auth.currentUser.uid;
          const isJudgeUser = isJudge(auth.currentUser);
          
          // If it's a private league and user is not creator or judge, check membership
          if (!isCreator && !isJudgeUser) {
            // We'll verify membership in the membership listener
            // For now, set the league data and let membership check handle access
          }
        }
        
        setLeague(leagueData);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching league data:", err);
        setError("Failed to load league data");
        setLoading(false);
      },
    );

    // Fetch user membership if logged in
    let unsubMembership: (() => void) | undefined;
    if (auth.currentUser) {
      const membershipQuery = query(
        collection(db, "leagueMemberships"),
        where("leagueId", "==", id),
        where("userId", "==", auth.currentUser.uid),
      );

      unsubMembership = onSnapshot(membershipQuery, (membershipSnap) => {
        if (!membershipSnap.empty) {
          const membershipData = {
            id: membershipSnap.docs[0].id,
            ...membershipSnap.docs[0].data(),
          } as LeagueMember;
          setUserMembership(membershipData);
        } else {
          setUserMembership(null);
          
          // If this is a private league and user is not a member, creator, or judge, deny access
          if (league && !league.isPublic && auth.currentUser) {
            const isCreator = league.createdBy === auth.currentUser.uid;
            const isJudgeUser = isJudge(auth.currentUser);
            
            if (!isCreator && !isJudgeUser) {
              setError("Access denied. This is a private league and you are not a member.");
              setLoading(false);
              return;
            }
          }
        }
      });
    }

    // Set up real-time listener for league members
    const membersQuery = query(
      collection(db, "leagueMemberships"),
      where("leagueId", "==", id),
      where("status", "==", "active"),
    );

    const unsubMembers = onSnapshot(membersQuery, (membersSnap) => {
      const allMembersData: LeagueMember[] = [];
      const userIds: string[] = [];

      // Collect all member data and user IDs
      membersSnap.forEach((docSnapshot) => {
        const memberData = {
          id: docSnapshot.id,
          ...docSnapshot.data(),
        } as LeagueMember;
        allMembersData.push(memberData);
        userIds.push(memberData.userId);
      });

      // Set all members first so they show immediately
      setAllMembers(allMembersData);

      // Fetch user data in background (non-blocking)
      if (userIds.length > 0) {
        fetchUserData(userIds);
      }
    });

    // Set up real-time listener for league games (both collections)
    const leagueGamesQuery = query(
      collection(db, "leagueGames"),
      where("leagueId", "==", id),
      orderBy("updatedAt", "desc"),
    );

    const regularGamesQuery = query(
      collection(db, "games"),
      where("leagueId", "==", id),
      orderBy("updatedAt", "desc"),
    );

    const unsubLeagueGames = onSnapshot(leagueGamesQuery, (gamesSnap) => {
      const leagueGamesData: LeagueGame[] = [];
      const gameUserIds = new Set<string>();
      
      gamesSnap.forEach((docSnapshot) => {
        const gameData = {
          id: docSnapshot.id,
          ...docSnapshot.data(),
        } as LeagueGame;
        
        leagueGamesData.push(gameData);
        
        // Collect user IDs from this game
        if (gameData.createdBy) gameUserIds.add(gameData.createdBy);
        if (gameData.opponent) gameUserIds.add(gameData.opponent);
      });
      
      // Update games with league games data
      setGames(prevGames => {
        const regularGames = prevGames.filter(game => !game.id.startsWith('league_'));
        const newGames = [...regularGames, ...leagueGamesData];
        return newGames;
      });

      // Fetch display names for all game participants
      if (gameUserIds.size > 0) {
        fetchUserDisplayNames(Array.from(gameUserIds));
      }
    });

    const unsubRegularGames = onSnapshot(regularGamesQuery, (gamesSnap) => {
      const regularGamesData: LeagueGame[] = [];
      const gameUserIds = new Set<string>();
      
      gamesSnap.forEach((docSnapshot) => {
        const gameData = docSnapshot.data();
        // Convert regular game format to league game format
        const convertedGame = {
          id: `regular_${docSnapshot.id}`,
          leagueId: id!,
          createdBy: gameData.createdBy,
          opponent: gameData.opponent,
          status: gameData.status,
          createdAt: gameData.createdAt,
          updatedAt: gameData.updatedAt,
          scores: gameData.scores,
          winner: gameData.winner
        } as LeagueGame;
        
        regularGamesData.push(convertedGame);
        
        // Collect user IDs from this game
        if (gameData.createdBy) gameUserIds.add(gameData.createdBy);
        if (gameData.opponent) gameUserIds.add(gameData.opponent);
      });
      
      // Update games with regular games data
      setGames(prevGames => {
        const leagueGames = prevGames.filter(game => game.id.startsWith('league_'));
        const newGames = [...leagueGames, ...regularGamesData];
        return newGames;
      });

      // Fetch display names for all game participants
      if (gameUserIds.size > 0) {
        fetchUserDisplayNames(Array.from(gameUserIds));
      }
    });

    // Clean up listeners on unmount
    return () => {
      unsubLeague();
      if (unsubMembership) unsubMembership();
      unsubMembers();
      unsubLeagueGames();
      unsubRegularGames();
    };
  }, [id, fetchUserDisplayNames]);

  // Helper function to handle game click navigation
  const handleGameClick = useCallback((game: LeagueGame) => {
    // Handle different ID formats:
    // - 'regular_<id>' for games from the regular 'games' collection
    // - Plain ID for games from the 'leagueGames' collection
    let gameId = game.id;
    
    if (game.id.startsWith('regular_')) {
      // Remove the 'regular_' prefix for navigation
      gameId = game.id.replace('regular_', '');
    }
    // For league games (without prefix), use the ID as-is
    
    navigate(`/game/${gameId}`);
  }, [navigate]);

  // Handle player click - use cache for better performance
  const handlePlayerClick = useCallback(async (player: StandingEntry) => {
    try {
      // Try cache first
      if (userProfileCache[player.userId]) {
        openProfileModal(userProfileCache[player.userId]);
        return;
      }

      // Fallback to getUserProfile if not in cache
      const fullUserProfile = await getUserProfile(player.userId);
      
      if (fullUserProfile) {
        // Update cache
        setUserProfileCache(prev => ({
          ...prev,
          [player.userId]: fullUserProfile
        }));
        openProfileModal(fullUserProfile);
      } else {
        // Fallback to converted profile if getUserProfile fails
        const userProfile = convertStandingEntryToUserProfile(player);
        openProfileModal(userProfile);
      }
    } catch (error) {
      // Fallback to converted profile on error
      const userProfile = convertStandingEntryToUserProfile(player);
      openProfileModal(userProfile);
    }
  }, [openProfileModal, convertStandingEntryToUserProfile, userProfileCache]);

  // Handle member click - use cache for better performance
  const handleMemberClick = useCallback(async (member: LeagueMember & { displayName?: string }) => {
    try {
      // Try cache first
      if (userProfileCache[member.userId]) {
        openProfileModal(userProfileCache[member.userId]);
        return;
      }

      // Fallback to getUserProfile if not in cache
      const fullUserProfile = await getUserProfile(member.userId);
      
      if (fullUserProfile) {
        // Update cache
        setUserProfileCache(prev => ({
          ...prev,
          [member.userId]: fullUserProfile
        }));
        openProfileModal(fullUserProfile);
      } else {
        // Create a fallback profile from member data
        const userProfile: UserProfile = {
          uid: member.userId,
          displayName: member.displayName || member.userId,
          username: member.displayName || member.userId,
          email: "",
          photoURL: userProfiles[member.userId]?.photoURL,
          createdAt: member.joinedAt || Timestamp.now(),
          stats: {
            gamesPlayed: 0,
            gamesWon: 0,
            totalPoints: 0,
            globalRank: 0,
            winStreak: 0,
            maxWinStreak: 0,
          },
          hasSetUsername: !!member.displayName,
        };
        openProfileModal(userProfile);
      }
    } catch (error) {
      // Create a fallback profile on error
      const userProfile: UserProfile = {
        uid: member.userId,
        displayName: member.displayName || member.userId,
        username: member.displayName || member.userId,
        email: "",
        photoURL: userProfiles[member.userId]?.photoURL,
        createdAt: member.joinedAt || Timestamp.now(),
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          totalPoints: 0,
          globalRank: 0,
          winStreak: 0,
          maxWinStreak: 0,
        },
        hasSetUsername: !!member.displayName,
      };
      openProfileModal(userProfile);
    }
  }, [openProfileModal, userProfiles, userProfileCache]);

  // Helper function to get game mode display name
  const getGameModeDisplayName = useCallback((gameMode: string) => {
    if (!gameConfig) return gameMode;
    
    const mode = gameConfig.gameModes.find(m => m.value === gameMode);
    return mode ? mode.label : gameMode;
  }, [gameConfig]);

  // Define standings type
  type StandingEntry = {
    userId: string;
    displayName: string;
    photoURL?: string;
    gamesPlayed: number;
    gamesWon: number;
    points: number;
    pointsFor: number;
    pointsAgainst: number;
    winRate: number;
    pointDifferential: number;
  };

  // Define table columns
  // Members table columns
  const membersColumns = useMemo<ColumnDef<LeagueMember & { displayName?: string }>[]>(() => [
    {
      accessorKey: "displayName",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-semibold hover:bg-transparent"
        >
          Member
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const member = row.original;
        const displayName = member.displayName || member.userId;
        const userProfile = userProfiles[member.userId];
        return (
          <div className="font-medium text-xs sm:text-sm flex items-center space-x-2">
            <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
              <AvatarImage src={userProfile?.photoURL || undefined} alt={displayName} />
              <AvatarFallback className="text-xs">
                {displayName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="truncate max-w-20 sm:max-w-none" title={displayName}>
              {displayName}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const role = row.getValue("role") as string;
        return (
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              role === "owner"
                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200"
                : role === "admin"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {role}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              status === "active"
                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200"
                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: "joinedAt",
      header: "Joined",
      cell: ({ row }) => {
        const joinedAt = row.getValue("joinedAt") as any;
        return (
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {joinedAt ? new Date(joinedAt.toDate()).toLocaleDateString() : "Unknown"}
          </div>
        );
      },
    },
  ], [userProfiles]);

  // Standings table columns (similar to rankings)
  const standingsColumns = useMemo<ColumnDef<StandingEntry>[]>(() => [
    {
      accessorKey: "rank",
      header: "Rank",
      cell: ({ row }) => {
        const rank = row.index + 1;
        return (
          <div className="text-xs sm:text-sm font-bold text-center">
            #{rank}
          </div>
        );
      },
    },
    {
      accessorKey: "displayName",
      header: "Player",
      cell: ({ row }) => {
        const entry = row.original;
        return (
          <div className="font-medium text-xs sm:text-sm flex items-center space-x-2">
            <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
              <AvatarImage src={entry.photoURL || undefined} alt={entry.displayName} />
              <AvatarFallback className="text-xs">
                {entry.displayName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="truncate max-w-20 sm:max-w-none" title={entry.displayName}>
              {entry.displayName}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "gamesPlayed",
      header: "Games",
      cell: ({ row }) => (
        <div className="text-xs sm:text-sm text-center">
          {row.getValue("gamesPlayed")}
        </div>
      ),
    },
    {
      accessorKey: "gamesWon",
      header: "Wins",
      cell: ({ row }) => (
        <div className="text-xs sm:text-sm text-center">
          {row.getValue("gamesWon")}
        </div>
      ),
    },
    {
      accessorKey: "winRate",
      header: "Win %",
      cell: ({ row }) => {
        const winRate = row.getValue("winRate") as number;
        return (
          <div className="text-xs sm:text-sm text-center font-medium">
            {winRate.toFixed(1)}%
          </div>
        );
      },
    },
    {
      accessorKey: "points",
      header: "Points",
      cell: ({ row }) => (
        <div className="text-xs sm:text-sm text-center font-mono">
          {row.getValue("points")}
        </div>
      ),
    },
  ], []);

  // Games table columns (similar to GamesList)
  const gamesColumns = useMemo<ColumnDef<LeagueGame>[]>(() => [
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-semibold hover:bg-transparent"
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const createdAt = row.getValue("createdAt") as any;
        return (
          <div className="text-xs sm:text-sm whitespace-nowrap">
            {createdAt ? new Date(createdAt.toDate()).toLocaleDateString() : "Unknown"}
          </div>
        );
      },
    },
    {
      accessorKey: "players",
      header: "Players",
      cell: ({ row }) => {
        const game = row.original as any;
        
        return (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {game.creatorName}
            </span>
            <span className="text-gray-500">vs</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {game.opponentName}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-semibold hover:bg-transparent"
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              status === "completed"
                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200"
                : status === "in_progress"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
                  : status === "invited"
                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
                    : status === "accepted"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200"
                      : status === "waiting_confirmation"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {status === "waiting_confirmation" ? "Awaiting Confirmation" : 
             status === "in_progress" ? "In Progress" :
             status === "accepted" ? "Ready to Start" :
             status === "invited" ? "Invited" :
             status === "completed" ? "Completed" : status}
          </span>
        );
      },
    },
    {
      accessorKey: "scores",
      header: "Score",
      cell: ({ row }) => {
        const game = row.original;
        if (game.scores) {
          return (
            <span className="text-gray-900 dark:text-white">
              {game.scores.creator} - {game.scores.opponent}
            </span>
          );
        }
        return <span className="text-gray-500">-</span>;
      },
    },
  ], []);

  // Create table instances - wait for userProfiles to be loaded like standings does
  const membersWithDisplayNames = useMemo(() => 
    members.map(member => ({
      ...member,
      displayName: userDisplayNames[member.userId] || member.userId
    })), 
    [members, userDisplayNames, userProfiles] // Add userProfiles dependency to sync with avatar loading
  );

  const gamesWithDisplayNames = useMemo(() =>
    games
      .filter(game => 
        game.status !== 'rejected' && // Exclude rejected games
        (game.status === 'completed' || 
         game.status === 'in_progress' || 
         game.status === 'accepted' ||
         game.status === 'waiting_confirmation' ||
         game.status === 'invited')
      )
      .map(game => ({
        ...game,
        creatorName: userDisplayNames[game.createdBy] || game.createdBy,
        opponentName: userDisplayNames[game.opponent] || game.opponent,
      })),
    [games, userDisplayNames]
  );

  const membersTable = useReactTable({
    data: membersWithDisplayNames,
    columns: membersColumns,
    onSortingChange: setMembersSorting,
    onColumnFiltersChange: setMembersColumnFilters,
    onGlobalFilterChange: setMembersGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
    state: { 
      sorting: membersSorting,
      columnFilters: membersColumnFilters,
      globalFilter: membersGlobalFilter,
    },
  });

  const standingsTable = useReactTable({
    data: standings,
    columns: standingsColumns,
    onSortingChange: setStandingsSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting: standingsSorting },
  });

  const gamesTable = useReactTable({
    data: gamesWithDisplayNames,
    columns: gamesColumns,
    onSortingChange: setGamesSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting: gamesSorting },
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-red-700">{error || "League not found"}</p>
            </div>
          </div>
        </div>
        <Link to="/leagues" className="text-blue-600 hover:underline">
          &larr; Back to Leagues
        </Link>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 w-full max-w-full sm:max-w-6xl mx-auto dark:text-white">
      {/* League Header */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader>
          <div className="flex items-center space-x-4">
            <Avatar className="h-12 w-12 sm:h-16 sm:w-16">
              <AvatarImage src={league.photoURL || undefined} alt={league.name} />
              <AvatarFallback>
                {league.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl sm:text-2xl truncate">{league.name}</CardTitle>
              <div className="flex items-center space-x-2 sm:space-x-4 mt-2">
                <span
                  className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                    league.status === "active"
                      ? "bg-green-500 text-white"
                      : league.status === "upcoming"
                        ? "bg-yellow-500 text-white"
                        : league.status === "completed"
                          ? "bg-gray-500 text-white"
                          : "bg-red-500 text-white"
                  }`}
                >
                  {league.status && typeof league.status === "string"
                    ? league.status.charAt(0).toUpperCase() +
                      league.status.slice(1)
                    : "Unknown"}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {league.description}
          </p>

          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
            <div className="flex items-center">
              <UserGroupIcon className="h-5 w-5 mr-1" />
              <span>{members.length} members</span>
            </div>
            <div className="flex items-center">
              <CalendarIcon className="h-5 w-5 mr-1" />
              <span>
                Created{" "}
                {new Date(league.createdAt.toDate()).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center">
              <ChartBarIcon className="h-5 w-5 mr-1" />
              <span>
                {getGameModeDisplayName(league.settings?.gameMode || "single")}{" "}
                mode • {league.settings?.pointsToWin || 100} points
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              to="/leagues"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-zinc-700 dark:text-gray-200 dark:hover:bg-zinc-600 text-center sm:text-left"
            >
              Back to Leagues
            </Link>

            {!userMembership &&
              league.status &&
              league.status !== "completed" &&
              league.settings?.allowJoinRequests !== false && (
                <Link
                  to={`/leagues/join/${id}`}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-center sm:text-left"
                >
                  Join League
                </Link>
              )}
          </div>

          {canManage && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                to={`/leagues/manage/${id}`}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center sm:justify-start"
              >
                <PencilSquareIcon className="h-5 w-5 mr-1" />
                Manage League
              </Link>
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" value={activeTab} onValueChange={(value) => setActiveTab(value as "overview" | "standings" | "members" | "games")}>
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <TabsList className="grid w-max min-w-full sm:w-full grid-cols-4 mx-3 sm:mx-0">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="standings" className="text-xs sm:text-sm">Standings</TabsTrigger>
            <TabsTrigger value="members" className="text-xs sm:text-sm">Members ({members.length})</TabsTrigger>
            <TabsTrigger value="games" className="text-xs sm:text-sm">Games ({games.length})</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="overview" className="mt-4 sm:mt-6">
          <Card>
            <CardHeader>
              <CardTitle>League Overview</CardTitle>
            </CardHeader>
            <CardContent>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Game Settings</h3>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-sm">
                  <li>
                    <strong>Game Mode:</strong>{" "}
                    {getGameModeDisplayName(league.settings?.gameMode || "single")}
                  </li>
                  <li>
                    <strong>Points to Win:</strong>{" "}
                    {league.settings?.pointsToWin || 150} points
                  </li>
                  <li>
                    <strong>Maximum Players:</strong>{" "}
                    {league.settings?.maxPlayers || 16}
                  </li>
                  {(league.settings?.timeLimit || 0) > 0 && (
                    <li>
                      <strong>Time Limit:</strong>{" "}
                      {league.settings.timeLimit} minutes per game
                    </li>
                  )}
                  <li>
                    <strong>Requires Confirmation:</strong>{" "}
                    {league.settings?.requireConfirmation ? "Yes" : "No"}
                  </li>
                  <li>
                    <strong>Penalties Enabled:</strong>{" "}
                    {league.settings?.penaltiesEnabled ? "Yes" : "No"}
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Tournament Format</h3>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-sm">
                  <li>
                    <strong>Format:</strong>{" "}
                    {league.settings?.tournamentFormat === "round-robin" ? "Round Robin" : 
                     league.settings?.tournamentFormat === "elimination" ? "Elimination" : 
                     league.settings?.tournamentFormat === "swiss" ? "Swiss System" : 
                     league.settings?.tournamentFormat || "Custom"}
                  </li>
                  <li>
                    <strong>Number of Rounds:</strong>{" "}
                    {league.settings?.numberOfRounds || "Not set"}
                  </li>
                  <li>
                    <strong>Playoffs:</strong>{" "}
                    {league.settings?.playoffsEnabled
                      ? `Yes (Top ${league.settings?.playoffTeams || 4} advance)`
                      : "No"}
                  </li>
                  <li>
                    <strong>Scoring System:</strong>{" "}
                    {league.settings?.scoringSystem?.pointsPerWin || 3} pts win
                    / {league.settings?.scoringSystem?.pointsPerDraw || 1} pts
                    draw / {league.settings?.scoringSystem?.pointsPerLoss || 0}{" "}
                    pts loss
                  </li>
                  <li>
                    <strong>Tiebreakers:</strong>{" "}
                    {league.settings?.scoringSystem?.usePointDifferential
                      ? "Uses point differential"
                      : "Win count only"}
                  </li>
                </ul>
              </div>
            </div>

            {/* League Stats Summary */}
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4">League Statistics</h3>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-gray-50 dark:bg-zinc-700 p-3 sm:p-4 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Total Members
                  </p>
                  <p className="text-xl sm:text-2xl font-bold">
                    {members.length}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-700 p-3 sm:p-4 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Total Matches
                  </p>
                  <p className="text-xl sm:text-2xl font-bold">
                    {games.length}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-700 p-3 sm:p-4 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Completed Matches
                  </p>
                  <p className="text-xl sm:text-2xl font-bold">
                    {games.filter(game => game.status === 'completed').length}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-700 p-3 sm:p-4 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Active Matches
                  </p>
                  <p className="text-xl sm:text-2xl font-bold">
                    {games.filter(game => ['in_progress', 'accepted', 'waiting_confirmation'].includes(game.status)).length}
                  </p>
                </div>
              </div>
            </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="standings" className="mt-4 sm:mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>League Standings</span>
                {league.status && league.status === "active" && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-normal">
                    Updated in real-time as games are played
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
            {standings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No games completed yet
              </div>
            ) : (
              <div className="w-full">
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      {standingsTable.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {standingsTable.getRowModel().rows?.length ? (
                        standingsTable.getRowModel().rows.map((row, index) => (
                          <TableRow
                            key={row.id}
                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                            onClick={() => handlePlayerClick(row.original)}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={standingsColumns.length}
                            className="h-24 text-center"
                          >
                            No rankings found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4 sm:mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <span>League Members ({members.length})</span>
                {canManage && (
                  <Link
                    to={`/leagues/manage/${id}`}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center justify-center sm:justify-start w-full sm:w-auto"
                  >
                    <UsersIcon className="h-4 w-4 mr-1" />
                    Manage Members
                  </Link>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
            {members.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No members have joined this league yet
              </div>
            ) : membersProfilesLoading ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
                Loading member profiles...
              </div>
            ) : (
              <div className="w-full">
                <div className="flex justify-between items-center mb-4">
                  <Input
                    placeholder="Search members..."
                    value={membersGlobalFilter ?? ""}
                    onChange={(event) => setMembersGlobalFilter(String(event.target.value))}
                    className="max-w-sm"
                  />
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    {membersTable.getRowModel().rows.length} of {members.length} members
                    {membersProfilesLoading && (
                      <div className="flex items-center gap-1">
                        <div className="animate-spin rounded-full h-3 w-3 border-t border-b border-blue-500"></div>
                        <span className="text-xs">Loading avatars...</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      {membersTable.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {membersTable.getRowModel().rows?.length ? (
                        membersTable.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-pointer"
                            onClick={() => handleMemberClick(row.original)}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={membersColumns.length}
                            className="h-24 text-center"
                          >
                            No members found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="games" className="mt-4 sm:mt-6">
          <Card>
            <CardHeader>
              <CardTitle>League Games</CardTitle>
            </CardHeader>
            <CardContent>
            {games.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No games have been played in this league yet
              </div>
            ) : (
              <div className="w-full">
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      {gamesTable.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {gamesTable.getRowModel().rows?.length ? (
                        gamesTable.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-pointer"
                            onClick={() => handleGameClick(row.original)}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={gamesColumns.length}
                            className="h-24 text-center"
                          >
                            No games found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={closeProfileModal}
        user={selectedUser}
      />
    </div>
  );
};

export default LeagueDetail;
