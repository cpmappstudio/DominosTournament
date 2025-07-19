import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  getFirestore,
  collection,
  query,
  getDocs,
  where,
  orderBy,
} from "firebase/firestore";
import { auth } from "../../firebase";
import { isJudge } from "../../utils/auth";
import {
  TrophyIcon,
  PlusIcon,
  UserGroupIcon,
  ClockIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";
import { League } from "../../models/league";

const LeaguesPage: React.FC = () => {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "active" | "upcoming" | "completed"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredLeagues, setFilteredLeagues] = useState<League[]>([]);

  // Check if current user is a judge
  const userIsJudge = auth.currentUser ? isJudge(auth.currentUser) : false;

  useEffect(() => {
    const fetchLeagues = async () => {
      setLoading(true);
      setError(null);

      try {
        const db = getFirestore();
        const leaguesRef = collection(db, "leagues");

        // Base query for all leagues with status filter
        let leaguesQuery = query(leaguesRef, orderBy("createdAt", "desc"));

        if (filter !== "all") {
          leaguesQuery = query(leaguesQuery, where("status", "==", filter));
        }

        const querySnapshot = await getDocs(leaguesQuery);

        const leaguesData: League[] = [];
        querySnapshot.forEach((doc) => {
          leaguesData.push({ id: doc.id, ...doc.data() } as League);
        });

        setLeagues(leaguesData);
        setFilteredLeagues(leaguesData);

        // If user is logged in, fetch leagues they are a member of
        if (auth.currentUser) {
          const membershipsRef = collection(db, "leagueMemberships");
          const membershipQuery = query(
            membershipsRef,
            where("userId", "==", auth.currentUser.uid),
            where("status", "in", ["active", "pending"]),
          );

          const membershipSnapshot = await getDocs(membershipQuery);
          const leagueIds = membershipSnapshot.docs.map(
            (doc) => doc.data().leagueId,
          );

          if (leagueIds.length > 0) {
            const myLeaguesQuery = query(
              leaguesRef,
              where("id", "in", leagueIds),
            );

            const myLeaguesSnapshot = await getDocs(myLeaguesQuery);
            const myLeaguesData: League[] = [];
            myLeaguesSnapshot.forEach((doc) => {
              myLeaguesData.push({ id: doc.id, ...doc.data() } as League);
            });

            setMyLeagues(myLeaguesData);
          }
        }
      } catch (err) {
        console.error("Error fetching leagues:", err);
        setError("Failed to load leagues data");
      } finally {
        setLoading(false);
      }
    };

    fetchLeagues();
  }, [filter]);

  // Filter leagues based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredLeagues(leagues);
      return;
    }

    const search = searchTerm.toLowerCase().trim();
    const filtered = leagues.filter(
      (league) =>
        league.name.toLowerCase().includes(search) ||
        (league.description &&
          league.description.toLowerCase().includes(search)),
    );

    setFilteredLeagues(filtered);
  }, [leagues, searchTerm]);

  return (
    <div className="p-6 max-w-6xl mx-auto text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Domino Leagues</h1>

        {/* Create League button (only for judges) */}
        {userIsJudge && (
          <Link
            to="/leagues/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5" />
            Create League
          </Link>
        )}
      </div>

      {/* Filter controls */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row p-4">
          <div className="flex flex-wrap mb-4 md:mb-0 border-b md:border-b-0 pb-4 md:pb-0 border-gray-200 dark:border-zinc-700">
            <button
              className={`px-4 py-2 rounded-md mr-2 mb-2 md:mb-0 ${
                filter === "all"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
              }`}
              onClick={() => setFilter("all")}
            >
              All Leagues
            </button>
            <button
              className={`px-4 py-2 rounded-md mr-2 mb-2 md:mb-0 ${
                filter === "active"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
              }`}
              onClick={() => setFilter("active")}
            >
              Active
            </button>
            <button
              className={`px-4 py-2 rounded-md mr-2 mb-2 md:mb-0 ${
                filter === "upcoming"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
              }`}
              onClick={() => setFilter("upcoming")}
            >
              Upcoming
            </button>
            <button
              className={`px-4 py-2 rounded-md mb-2 md:mb-0 ${
                filter === "completed"
                  ? "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
              }`}
              onClick={() => setFilter("completed")}
            >
              Completed
            </button>
          </div>
          <div className="md:ml-auto flex">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search leagues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* My Leagues section */}
      {myLeagues.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <UserGroupIcon className="h-5 w-5 mr-2 text-blue-500" />
            My Leagues
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myLeagues.map((league) => (
              <Link
                key={league.id}
                to={`/leagues/${league.id}`}
                className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow duration-200"
              >
                <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600 relative flex items-center justify-center">
                  {league.photoURL ? (
                    <img
                      src={league.photoURL}
                      alt={league.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <TrophyIcon className="h-16 w-16 text-white opacity-30" />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        league.status === "active"
                          ? "bg-green-500 text-white"
                          : league.status === "upcoming"
                            ? "bg-yellow-500 text-white"
                            : "bg-gray-500 text-white"
                      }`}
                    >
                      {league.status
                        ? league.status.charAt(0).toUpperCase() +
                          league.status.slice(1)
                        : "Unknown"}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-1 truncate">
                    {league.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 truncate">
                    {league.description}
                  </p>
                  <div className="flex items-center text-xs text-gray-500">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    <span>
                      {new Date(league.createdAt.toDate()).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Leagues section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          {filter === "all"
            ? "All Leagues"
            : filter === "active"
              ? "Active Leagues"
              : filter === "upcoming"
                ? "Upcoming Leagues"
                : "Completed Leagues"}
        </h2>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-500">Loading leagues...</p>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : filteredLeagues.length === 0 ? (
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-8 text-center">
            <TrophyIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No leagues found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchTerm
                ? `No leagues match your search "${searchTerm}".`
                : filter !== "all"
                  ? `There are no ${filter} leagues at the moment.`
                  : "There are no leagues available right now."}
            </p>
            {userIsJudge && (
              <Link
                to="/leagues/create"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create the first league
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLeagues.map((league) => (
              <div
                key={league.id}
                className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden"
              >
                <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600 relative flex items-center justify-center">
                  {league.photoURL ? (
                    <img
                      src={league.photoURL}
                      alt={league.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <TrophyIcon className="h-16 w-16 text-white opacity-30" />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        league.status === "active"
                          ? "bg-green-500 text-white"
                          : league.status === "upcoming"
                            ? "bg-yellow-500 text-white"
                            : "bg-gray-500 text-white"
                      }`}
                    >
                      {league.status
                        ? league.status.charAt(0).toUpperCase() +
                          league.status.slice(1)
                        : "Unknown"}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-1 truncate">
                    {league.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                    {league.description}
                  </p>

                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                      <span className="block">
                        {league.stats?.totalMembers || 0} members
                      </span>
                      <span>
                        {new Date(
                          league.createdAt.toDate(),
                        ).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex space-x-2">
                      <Link
                        to={`/leagues/${league.id}`}
                        className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50"
                      >
                        View
                      </Link>

                      {/* Show appropriate action based on membership status */}
                      {(() => {
                        // Judges/administrators don't participate as members
                        if (isJudge(auth.currentUser)) {
                          return (
                            <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded-md">
                              Administrator
                            </span>
                          );
                        }

                        const membership = myLeagues.find(
                          (myLeague) => myLeague.id === league.id,
                        );
                        
                        if (membership) {
                          // User is already a member
                          return (
                            <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md">
                              Member
                            </span>
                          );
                        } else {
                          // User is not a member, show join button
                          return (
                            <Link
                              to={`/leagues/join/${league.id}`}
                              className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 rounded-md hover:bg-green-200 dark:hover:bg-green-900/50"
                            >
                              Join
                            </Link>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaguesPage;
