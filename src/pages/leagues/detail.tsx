import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
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
import { auth } from "../../firebase";
import { canManageLeague } from "../../utils/auth";
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

const LeagueDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  // Using Link for navigation instead of navigate function
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [userMembership, setUserMembership] = useState<LeagueMember | null>(
    null,
  );
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [games, setGames] = useState<LeagueGame[]>([]);
  const [activeTab, setActiveTab] = useState<
    "overview" | "standings" | "members" | "games"
  >("overview");
  const [userDisplayNames, setUserDisplayNames] = useState<
    Record<string, string>
  >({});
  const [fetchingUserData, setFetchingUserData] = useState(false);

  // Check user permissions for managing the league
  const canManage = league
    ? canManageLeague(auth.currentUser, league.createdBy)
    : false;

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
        }
      });
    }

    // Set up real-time listener for league members
    const membersQuery = query(
      collection(db, "leagueMemberships"),
      where("leagueId", "==", id),
      where("status", "==", "active"),
    );

    const unsubMembers = onSnapshot(membersQuery, async (membersSnap) => {
      const membersData: LeagueMember[] = [];
      const userIds: string[] = [];

      membersSnap.forEach((docSnapshot) => {
        const memberData = {
          id: docSnapshot.id,
          ...docSnapshot.data(),
          displayName: "",
        } as LeagueMember & { displayName: string };
        membersData.push(memberData);
        userIds.push(memberData.userId);

        // Use cached display name if available
        if (userDisplayNames[memberData.userId]) {
          memberData.displayName = userDisplayNames[memberData.userId];
        } else {
          memberData.displayName = memberData.userId; // Default to userId initially
        }
      });

      // Set members immediately with initial data
      setMembers(membersData);

      // Find users we need to fetch data for (use local cache to prevent re-renders)
      const existingUserNames = { ...userDisplayNames };
      const missingUserIds = userIds.filter(
        (userId) => !existingUserNames[userId],
      );

      // Only fetch if we have missing users and aren't already fetching
      if (missingUserIds.length > 0 && !fetchingUserData) {
        setFetchingUserData(true);

        try {
          const userPromises: Promise<void>[] = [];
          const newUserNames: Record<string, string> = { ...existingUserNames };

          // Create a promise for each user
          missingUserIds.forEach((userId) => {
            const userPromise = getDoc(firestoreDoc(db, "users", userId))
              .then((userDoc) => {
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  newUserNames[userId] =
                    userData.displayName || userData.username || userId;
                } else {
                  newUserNames[userId] = userId;
                }
              })
              .catch(() => {
                newUserNames[userId] = userId;
              });

            userPromises.push(userPromise);
          });

          // Wait for all promises to resolve
          await Promise.all(userPromises);

          // Update the state once
          setUserDisplayNames(newUserNames);

          // Update members with display names
          const updatedMembers = membersData.map((member) => ({
            ...member,
            displayName: newUserNames[member.userId] || member.userId,
          }));

          setMembers(updatedMembers);
        } finally {
          setFetchingUserData(false);
        }
      }
    });

    // Set up real-time listener for league games
    const gamesQuery = query(
      collection(db, "leagueGames"),
      where("leagueId", "==", id),
      orderBy("updatedAt", "desc"),
    );

    const unsubGames = onSnapshot(gamesQuery, (gamesSnap) => {
      const gamesData: LeagueGame[] = [];
      gamesSnap.forEach((docSnapshot) => {
        gamesData.push({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        } as LeagueGame);
      });
      setGames(gamesData);
    });

    // Clean up listeners on unmount
    return () => {
      unsubLeague();
      if (unsubMembership) unsubMembership();
      unsubMembers();
      unsubGames();
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
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
    <div className="p-6 max-w-6xl mx-auto text-white">
      {/* League Header */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden mb-6">
        <div className="h-40 bg-gradient-to-r from-blue-500 to-indigo-600 relative">
          {league.photoURL ? (
            <img
              src={league.photoURL}
              alt={league.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <TrophyIcon className="h-24 w-24 text-white opacity-30" />
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-4">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-white">{league.name}</h1>

              <div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
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
        </div>

        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {league.description}
          </p>

          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center">
              <UserGroupIcon className="h-5 w-5 mr-1" />
              <span>{league.stats?.totalMembers || 0} members</span>
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
                {league.settings?.gameMode === "teams" ? "Team" : "Individual"}{" "}
                mode • {league.settings?.pointsToWin || 100} points
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 flex justify-between">
          <div className="space-x-2">
            <Link
              to="/leagues"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-zinc-700 dark:text-gray-200 dark:hover:bg-zinc-600"
            >
              Back to Leagues
            </Link>

            {!userMembership &&
              league.status &&
              league.status !== "completed" && (
                <Link
                  to={`/leagues/join/${id}`}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Join League
                </Link>
              )}
          </div>

          {canManage && (
            <div className="space-x-2">
              <Link
                to={`/leagues/manage/${id}`}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              >
                <PencilSquareIcon className="h-5 w-5 mr-1" />
                Manage League
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow mb-6">
        <div className="flex border-b border-gray-200 dark:border-zinc-700">
          <button
            className={`px-6 py-3 font-medium text-sm border-b-2 ${
              activeTab === "overview"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm border-b-2 ${
              activeTab === "standings"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
            onClick={() => setActiveTab("standings")}
          >
            Standings
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm border-b-2 ${
              activeTab === "members"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
            onClick={() => setActiveTab("members")}
          >
            Members ({members.length})
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm border-b-2 ${
              activeTab === "games"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
            onClick={() => setActiveTab("games")}
          >
            Games ({games.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
        {activeTab === "overview" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">League Overview</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Game Settings</h3>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li>
                    <strong>Game Mode:</strong>{" "}
                    {league.settings?.gameMode === "teams"
                      ? "Teams (2 vs 2)"
                      : "Individual"}
                  </li>
                  <li>
                    <strong>Points to Win:</strong>{" "}
                    {league.settings?.pointsToWin || 100}
                  </li>
                  <li>
                    <strong>Maximum Players:</strong>{" "}
                    {league.settings?.maxPlayers || 16}
                  </li>
                  {(league.settings?.timeLimit || 0) > 0 && (
                    <li>
                      <strong>Time Limit:</strong>{" "}
                      {league.settings?.timeLimit || 0} minutes
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
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li>
                    <strong>Format:</strong>{" "}
                    {league.settings?.tournamentFormat
                      ? league.settings.tournamentFormat.replace("-", " ")
                      : "Standard"}
                  </li>
                  <li>
                    <strong>Number of Rounds:</strong>{" "}
                    {league.settings?.numberOfRounds || 0}
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-zinc-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total Members
                  </p>
                  <p className="text-2xl font-bold">
                    {league.stats?.totalMembers || 0}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total Matches
                  </p>
                  <p className="text-2xl font-bold">
                    {league.stats?.totalMatches || 0}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Completed Matches
                  </p>
                  <p className="text-2xl font-bold">
                    {league.stats?.totalMatchesCompleted || 0}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Active Matches
                  </p>
                  <p className="text-2xl font-bold">
                    {league.stats?.activeMatches || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "standings" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">League Standings</h2>
              {league.status && league.status === "active" && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Updated in real-time as games are played
                </span>
              )}
            </div>

            {members.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No members have joined this league yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                  <thead className="bg-gray-50 dark:bg-zinc-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                        Player
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                        Games
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                        Wins
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                        Points
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                        Win Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-zinc-700">
                    {/* Placeholder for standings data */}
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap" colSpan={6}>
                        <div className="text-center text-gray-500 dark:text-gray-400">
                          Standings will appear here as games are played
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "members" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                League Members ({members.length})
              </h2>
              {canManage && (
                <Link
                  to={`/leagues/manage/${id}`}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center"
                >
                  <UsersIcon className="h-4 w-4 mr-1" />
                  Manage Members
                </Link>
              )}
            </div>

            {members.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No members have joined this league yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                  <thead className="bg-gray-50 dark:bg-zinc-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                        Member
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                        Joined
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                        Stats
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-zinc-700">
                    {members.map((member) => (
                      <tr
                        key={member.id}
                        className="hover:bg-gray-50 dark:hover:bg-zinc-700/50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {(member as any).displayName || member.userId}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              member.role === "owner"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200"
                                : member.role === "admin"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {member.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              member.status === "active"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {member.joinedAt
                            ? new Date(
                                member.joinedAt.toDate(),
                              ).toLocaleDateString()
                            : "Unknown"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex flex-col">
                            <span className="text-gray-900 dark:text-white">
                              {member.stats?.gamesPlayed || 0} games
                            </span>
                            <span className="text-green-600 dark:text-green-400">
                              {member.stats?.gamesWon || 0} wins
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "games" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">League Games</h2>
              {userMembership &&
                league.status &&
                league.status === "active" && (
                  <button className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 flex items-center">
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Create League Game
                  </button>
                )}
            </div>

            {games.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No games have been played in this league yet
              </div>
            ) : (
              <div className="space-y-4">
                {/* Placeholder for game list */}
                <div className="bg-gray-50 dark:bg-zinc-700 p-4 rounded-lg">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    Game list will appear here
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeagueDetail;
