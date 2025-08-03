import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { Link } from "react-router-dom";
import {
  getFirestore,
  collection,
  query,
  getDocs,
  where,
  orderBy,
} from "firebase/firestore";
import { auth, validateAndUpdateLeagueStatus } from "../../firebase";
import { isJudge } from "../../utils/auth";
import { useMultipleLeagueStatuses, useLeagueStatusDisplay } from "../../hooks/useLeagueStatus";
import {
  TrophyIcon,
  PlusIcon,
  UserGroupIcon,
  ClockIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";
import { League } from "../../models/league";
import {
  Card,
  CardContent,
} from "../../components/ui/card";

// Memoized League Card component to prevent unnecessary re-renders
const LeagueCard = memo<{
  league: League;
  isMyLeague?: boolean;
  userIsJudge: boolean;
  onNavigate?: () => void;
  currentStatus?: string; // Override status from hook
}>(({ league, isMyLeague = false, userIsJudge, onNavigate, currentStatus }) => {
  const handleClick = useCallback(() => {
    onNavigate?.();
  }, [onNavigate]);

  // Use current status if provided, otherwise use league status
  const displayStatus = currentStatus || league.status;
  const statusDisplay = useLeagueStatusDisplay(displayStatus);

  const statusConfig = useMemo(() => {
    return {
      bg: statusDisplay.color,
      text: "text-white",
      label: statusDisplay.label
    };
  }, [statusDisplay]);

  const membershipStatus = useMemo(() => {
    // Check if user is the creator/administrator of this league
    const isLeagueCreator = auth.currentUser && league.createdBy === auth.currentUser.uid;
    
    if (isLeagueCreator || userIsJudge) {
      return {
        text: "Administrator",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
      };
    }
    
    if (isMyLeague) {
      return {
        text: "Joined",
        className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
      };
    }
    
    // Check if join requests are allowed for this league and if league is active
    if (league.settings?.allowJoinRequests !== false && (displayStatus === "active" || displayStatus === "upcoming")) {
      return {
        text: "Join",
        className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/50",
        isLink: true,
        href: `/leagues/join/${league.id}`
      };
    }
    
    // If league is completed or join requests are not allowed
    return null;
  }, [userIsJudge, isMyLeague, league.id, league.createdBy, league.settings?.allowJoinRequests, displayStatus]);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 overflow-hidden hover:shadow-md transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600">
      {/* Header with avatar and status */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            {/* League Avatar */}
            <div className="relative">
              {league.photoURL ? (
                <img
                  src={league.photoURL}
                  alt={league.name}
                  className="w-12 h-12 rounded-full object-cover "
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center border-2 border-gray-200 dark:border-zinc-600">
                  <TrophyIcon className="h-6 w-6 text-white" />
                </div>
              )}
              {/* Status indicator on avatar */}
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${statusConfig.bg} rounded-full border-2 border-white dark:border-zinc-800`} />
            </div>
            
            {/* League info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {league.name}
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                  {statusConfig.label}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  league.isPublic 
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" 
                    : "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200"
                }`}>
                  {league.isPublic ? "Public" : "Private"}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {league.stats?.totalMembers || 0} members
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2 leading-relaxed">
          {league.description || "No description available"}
        </p>

        {/* League details */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <UserGroupIcon className="h-4 w-4 mr-1" />
              <span>{league.stats?.totalMembers || 0} members</span>
            </div>
            <div className="flex items-center">
              <ClockIcon className="h-4 w-4 mr-1" />
              <span>{new Date(league.createdAt.toDate()).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex space-x-2">
          <Link
            to={`/leagues/${league.id}`}
            className="flex-1 px-3 py-2 text-sm font-medium text-center bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            onClick={handleClick}
          >
            View Details
          </Link>

          {membershipStatus ? (
            membershipStatus.isLink ? (
              <Link
                to={membershipStatus.href!}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${membershipStatus.className}`}
                onClick={handleClick}
              >
                {membershipStatus.text}
              </Link>
            ) : (
              <span className={`px-3 py-2 text-sm font-medium rounded-md ${membershipStatus.className}`}>
                {membershipStatus.text}
              </span>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
});
LeagueCard.displayName = 'LeagueCard';

// Memoized My League Card (optimized for the "My Leagues" section)
const MyLeagueCard = memo<{ 
  league: League; 
  onNavigate?: () => void;
  currentStatus?: string; // Override status from hook
}>(({ league, onNavigate, currentStatus }) => {
  // Use current status if provided, otherwise use league status
  const displayStatus = currentStatus || league.status;
  const statusDisplay = useLeagueStatusDisplay(displayStatus);

  const statusConfig = useMemo(() => {
    return {
      bg: statusDisplay.color,
      text: "text-white",
      label: statusDisplay.label
    };
  }, [statusDisplay]);

  return (
    <Link
      to={`/leagues/${league.id}`}
      className="block bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 overflow-hidden hover:shadow-md transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600"
      onClick={onNavigate}
    >
      <div className="p-4">
        <div className="flex items-start space-x-3 mb-3">
          {/* League Avatar */}
          <div className="relative flex-shrink-0">
            {league.photoURL ? (
              <img
                src={league.photoURL}
                alt={league.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-zinc-600"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center border-2 border-gray-200 dark:border-zinc-600">
                <TrophyIcon className="h-6 w-6 text-white" />
              </div>
            )}
            {/* Status indicator on avatar */}
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${statusConfig.bg} rounded-full border-2 border-white dark:border-zinc-800`} />
          </div>
          
          {/* League info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate mb-1">
              {league.name}
            </h3>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                {statusConfig.label}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Member
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2 leading-relaxed">
          {league.description || "No description available"}
        </p>

        {/* League details */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <UserGroupIcon className="h-4 w-4 mr-1" />
              <span>{league.stats?.totalMembers || 0} members</span>
            </div>
            <div className="flex items-center">
              <ClockIcon className="h-4 w-4 mr-1" />
              <span>{new Date(league.createdAt.toDate()).toLocaleDateString()}</span>
            </div>
          </div>
          
          {/* Quick access badge */}
          <div className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded-md text-xs font-medium">
            My League
          </div>
        </div>
      </div>
    </Link>
  );
});
MyLeagueCard.displayName = 'MyLeagueCard';

// Loading skeleton component
const LoadingSkeleton = memo(() => (
  <div className="text-center py-8">
    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    <p className="mt-2 text-gray-500">Loading leagues...</p>
  </div>
));
LoadingSkeleton.displayName = 'LoadingSkeleton';

// Filter buttons component
const FilterButton = memo<{
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  colorScheme: string;
}>(({ isActive, onClick, children, colorScheme }) => (
  <button
    className={`px-4 py-2 rounded-md mr-2 mb-2 md:mb-0 transition-colors ${
      isActive ? colorScheme : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
    }`}
    onClick={onClick}
  >
    {children}
  </button>
));
FilterButton.displayName = 'FilterButton';

const LeaguesPage: React.FC = () => {
  // Combined state for better performance
  const [leagueState, setLeagueState] = useState({
    allLeagues: [] as League[],
    myLeagues: [] as League[],
    loading: true,
    error: null as string | null,
  });
  
  const [filterState, setFilterState] = useState({
    status: "all" as "all" | "active" | "upcoming" | "completed",
    searchTerm: "",
  });

  // Memoized user judge status
  const userIsJudge = useMemo(() => auth.currentUser ? isJudge(auth.currentUser) : false, []);

  // Get all league IDs for status validation
  const allLeagueIds = useMemo(() => 
    leagueState.allLeagues.map(league => league.id), 
    [leagueState.allLeagues]
  );

  // Use the multiple league statuses hook to validate and update statuses
  const { statuses: validatedStatuses, loading: statusesLoading } = useMultipleLeagueStatuses(allLeagueIds);

  // Optimized data fetching with parallel queries
  const fetchLeaguesData = useCallback(async (statusFilter: string) => {
    setLeagueState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const db = getFirestore();
      const leaguesRef = collection(db, "leagues");

      // Build query based on filter
      let leaguesQuery = query(leaguesRef, orderBy("createdAt", "desc"));
      if (statusFilter !== "all") {
        leaguesQuery = query(leaguesQuery, where("status", "==", statusFilter));
      }

      // Parallel execution for better performance
      const promises: Promise<any>[] = [getDocs(leaguesQuery)];
      
      // Add membership query if user is logged in
      if (auth.currentUser) {
        const membershipsRef = collection(db, "leagueMemberships");
        const membershipQuery = query(
          membershipsRef,
          where("userId", "==", auth.currentUser.uid),
          where("status", "in", ["active", "pending"])
        );
        promises.push(getDocs(membershipQuery));
      }

      const results = await Promise.all(promises);
      const [querySnapshot, membershipSnapshot] = results;

      // Process leagues data with public/private filtering
      const leaguesData: League[] = [];
      querySnapshot.forEach((doc: any) => {
        const leagueData = { id: doc.id, ...doc.data() } as League;
        
        // Show league if:
        // 1. It's public, OR
        // 2. User is the creator, OR
        // 3. User is a judge (can see all leagues), OR
        // 4. User is a member (will be filtered later in myLeagues)
        if (leagueData.isPublic || 
            (auth.currentUser && leagueData.createdBy === auth.currentUser.uid) ||
            userIsJudge) {
          leaguesData.push(leagueData);
        }
      });

      // Process "My Leagues" - include both created leagues and memberships
      let myLeaguesData: League[] = [];
      if (auth.currentUser) {
        // 1. Leagues created by the user (for administrators)
        const createdLeagues = leaguesData.filter((league) => league.createdBy === auth.currentUser!.uid);
        
        // 2. Leagues where user is a member (from memberships)
        let memberLeagues: League[] = [];
        if (membershipSnapshot) {
          const leagueIds = membershipSnapshot.docs.map((doc: any) => doc.data().leagueId);
          memberLeagues = leaguesData.filter((league) => leagueIds.includes(league.id));
        }
        
        // 3. Combine both arrays and remove duplicates using Set
        const allMyLeagueIds = new Set([
          ...createdLeagues.map(l => l.id),
          ...memberLeagues.map(l => l.id)
        ]);
        
        myLeaguesData = leaguesData.filter((league) => allMyLeagueIds.has(league.id));
      }

      setLeagueState({
        allLeagues: leaguesData,
        myLeagues: myLeaguesData,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error("Error fetching leagues:", err);
      setLeagueState(prev => ({
        ...prev,
        loading: false,
        error: "Failed to load leagues data",
      }));
    }
  }, []);

  // Effect for fetching data when filter changes
  useEffect(() => {
    fetchLeaguesData(filterState.status);
  }, [filterState.status, fetchLeaguesData]);

  // Memoized filtered leagues for search with updated statuses
  const filteredLeagues = useMemo(() => {
    if (!filterState.searchTerm.trim()) {
      return leagueState.allLeagues;
    }

    const search = filterState.searchTerm.toLowerCase().trim();
    return leagueState.allLeagues.filter(
      (league) => {
        // Use validated status for filtering if available
        const currentStatus = validatedStatuses[league.id] || league.status;
        
        const matchesSearch = league.name.toLowerCase().includes(search) ||
          (league.description && league.description.toLowerCase().includes(search));
        
        const matchesFilter = filterState.status === "all" || currentStatus === filterState.status;
        
        return matchesSearch && matchesFilter;
      }
    );
  }, [leagueState.allLeagues, filterState.searchTerm, filterState.status, validatedStatuses]);

  // Memoized filter handlers
  const handleFilterChange = useCallback((newFilter: typeof filterState.status) => {
    setFilterState(prev => ({ ...prev, status: newFilter }));
  }, []);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFilterState(prev => ({ ...prev, searchTerm: event.target.value }));
  }, []);

  // Memoized navigation handler
  const handleNavigation = useCallback(() => {
    // Could add analytics or other navigation logic here
  }, []);

  // Memoized filter configurations
  const filterConfigs = useMemo(() => [
    { key: "all", label: "All Leagues", colorScheme: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" },
    { key: "active", label: "Active", colorScheme: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" },
    { key: "upcoming", label: "Upcoming", colorScheme: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" },
    { key: "completed", label: "Completed", colorScheme: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200" },
  ], []);

  // Memoized section title
  const sectionTitle = useMemo(() => {
    switch (filterState.status) {
      case "active": return "Active Leagues";
      case "upcoming": return "Upcoming Leagues";
      case "completed": return "Completed Leagues";
      default: return "All Leagues";
    }
  }, [filterState.status]);

  // Memoized empty state message
  const emptyStateMessage = useMemo(() => {
    if (filterState.searchTerm) {
      return `No leagues match your search "${filterState.searchTerm}".`;
    }
    if (filterState.status !== "all") {
      return `There are no ${filterState.status} leagues at the moment.`;
    }
    return "There are no leagues available right now.";
  }, [filterState.searchTerm, filterState.status]);

  return (
    <div className="p-6 max-w-6xl mx-auto dark:text-white">
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
      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-col md:flex-row">
            <div className="flex flex-wrap mb-4 md:mb-0 border-b md:border-b-0 pb-4 md:pb-0 border-gray-200 dark:border-zinc-700">
              {filterConfigs.map((config) => (
                <FilterButton
                  key={config.key}
                  isActive={filterState.status === config.key}
                  onClick={() => handleFilterChange(config.key as any)}
                  colorScheme={config.colorScheme}
                >
                  {config.label}
                </FilterButton>
              ))}
            </div>
            <div className="md:ml-auto flex">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search leagues..."
                  value={filterState.searchTerm}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* My Leagues section */}
      {leagueState.myLeagues.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <UserGroupIcon className="h-5 w-5 mr-2 text-blue-500" />
            My Leagues
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leagueState.myLeagues.map((league) => (
              <MyLeagueCard 
                key={league.id} 
                league={league} 
                currentStatus={validatedStatuses[league.id]} // Pass validated status
                onNavigate={handleNavigation}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Leagues section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{sectionTitle}</h2>

        {leagueState.loading ? (
          <LoadingSkeleton />
        ) : leagueState.error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {leagueState.error}
          </div>
        ) : filteredLeagues.length === 0 ? (
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <TrophyIcon className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No leagues found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">{emptyStateMessage}</p>
            {userIsJudge && (
              <Link
                to="/leagues/create"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create the first league
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLeagues.map((league) => {
              const isMyLeague = leagueState.myLeagues.some(myLeague => myLeague.id === league.id);
              return (
                <LeagueCard
                  key={league.id}
                  league={league}
                  isMyLeague={isMyLeague}
                  userIsJudge={userIsJudge}
                  currentStatus={validatedStatuses[league.id]} // Pass validated status
                  onNavigate={handleNavigation}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaguesPage;
