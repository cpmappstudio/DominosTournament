import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { auth } from "../../firebase";
import {
  TrophyIcon,
  UserGroupIcon,
  CalendarIcon,
  ChartBarIcon,
} from "@heroicons/react/24/solid";
import type { League } from "../../models/league";
import { ConfirmModal } from "@/components/modal";
import { isJudge } from "../../utils/auth";

const JoinLeague: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [joinMessage, setJoinMessage] = useState("");
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [showJoinConfirmModal, setShowJoinConfirmModal] = useState(false);

  useEffect(() => {
    if (!id || !auth.currentUser) {
      navigate("/leagues");
      return;
    }

    // Judges/administrators cannot join leagues as members
    if (isJudge(auth.currentUser)) {
      navigate(`/leagues/${id}`);
      return;
    }

    // Quick early check for membership before setting up listeners
    const quickMembershipCheck = async () => {
      const db = getFirestore();
      const membershipQuery = query(
        collection(db, "leagueMemberships"),
        where("leagueId", "==", id),
        where("userId", "==", auth.currentUser!.uid),
        where("status", "==", "active")
      );
      
      const membershipSnap = await getDocs(membershipQuery);
      if (!membershipSnap.empty) {
        // User is already a member, redirect immediately
        navigate(`/leagues/${id}`);
        return;
      }
    };

    quickMembershipCheck();

    setLoading(true);
    setError(null);

    const db = getFirestore();
    
    // Set up real-time listener for league data
    const leagueRef = doc(db, "leagues", id);
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
      },
      (err) => {
        console.error("Error fetching league data:", err);
        setError("Failed to load league data");
        setLoading(false);
      }
    );

    // Set up real-time listener for membership status (FIRST PRIORITY)
    const membershipQuery = query(
      collection(db, "leagueMemberships"),
      where("leagueId", "==", id),
      where("userId", "==", auth.currentUser.uid),
    );

    const unsubMembership = onSnapshot(membershipQuery, (membershipSnap) => {
      if (!membershipSnap.empty) {
        const membership = membershipSnap.docs[0].data();
        
        if (membership.status === "active") {
          setAlreadyMember(true);
          setPendingRequest(false);
          setLoading(false);
          
          // Start countdown for auto-redirect
          setRedirectCountdown(3);
          const countdownInterval = setInterval(() => {
            setRedirectCountdown((prev) => {
              if (prev === null || prev <= 1) {
                clearInterval(countdownInterval);
                navigate(`/leagues/${id}`);
                return null;
              }
              return prev - 1;
            });
          }, 1000);
          
          return; // Exit early - user is already a member
        } else if (membership.status === "pending") {
          setAlreadyMember(false);
          setPendingRequest(true);
          setLoading(false);
          return; // Exit early - user has pending membership
        }
      }
      
      // If no membership found, reset membership state and check join requests
      setAlreadyMember(false);
    });

    // Set up real-time listener for join requests (SECOND PRIORITY)
    const joinRequestQuery = query(
      collection(db, "leagueJoinRequests"),
      where("leagueId", "==", id),
      where("userId", "==", auth.currentUser.uid),
      where("status", "==", "pending")
    );

    const unsubJoinRequests = onSnapshot(joinRequestQuery, (joinRequestSnap) => {
      // Only set pending request if user is not already a member
      // This will be overridden by membership listener if user is a member
      setPendingRequest(!joinRequestSnap.empty);
      setLoading(false);
    });

    // Cleanup listeners on unmount
    return () => {
      unsubLeague();
      unsubMembership();
      unsubJoinRequests();
    };
  }, [id, navigate]);

  const handleJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id || !auth.currentUser || !league) {
      setError("You must be logged in to join a league");
      return;
    }

    if (alreadyMember) {
      navigate(`/leagues/${id}`);
      return;
    }

    if (pendingRequest) {
      setError("You already have a pending request to join this league");
      return;
    }

    // Check if the league is public or if user has access
    if (!league.isPublic && league.createdBy !== auth.currentUser.uid && !isJudge(auth.currentUser)) {
      setError("This is a private league. You can only join by invitation.");
      return;
    }

    // Check for duplicate membership by username
    const db = getFirestore();
    
    // Get current user's profile to get username
    const currentUserDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (!currentUserDoc.exists()) {
      setError("User profile not found");
      return;
    }
    
    const currentUserData = currentUserDoc.data();
    const currentUsername = currentUserData.username || currentUserData.displayName;

    if (currentUsername) {
      // Check if any member with this username already exists
      const membersQuery = query(
        collection(db, "leagueMemberships"),
        where("leagueId", "==", id),
        where("status", "==", "active")
      );
      
      const membersSnap = await getDocs(membersQuery);
      
      for (const memberDoc of membersSnap.docs) {
        const memberData = memberDoc.data();
        const memberUserDoc = await getDoc(doc(db, "users", memberData.userId));
        
        if (memberUserDoc.exists()) {
          const memberUserData = memberUserDoc.data();
          const memberUsername = memberUserData.username || memberUserData.displayName;
          
          if (memberUsername === currentUsername) {
            setError(`A member with username "${currentUsername}" is already in this league`);
            return;
          }
        }
      }
    }
    
    // Show confirmation modal
    setShowJoinConfirmModal(true);
  };

  const handleConfirmJoin = async () => {
    if (!id || !auth.currentUser || !league) {
      setError("You must be logged in to join a league");
      return;
    }

    // Double-check for pending requests to prevent duplicates
    const db = getFirestore();
    const joinRequestQuery = query(
      collection(db, "leagueJoinRequests"),
      where("leagueId", "==", id),
      where("userId", "==", auth.currentUser.uid),
      where("status", "==", "pending")
    );
    
    const joinRequestSnap = await getDocs(joinRequestQuery);
    if (!joinRequestSnap.empty) {
      setPendingRequest(true);
      setError("You already have a pending request to join this league");
      setShowJoinConfirmModal(false);
      return;
    }

    setSubmitting(true);
    setError(null);
    setShowJoinConfirmModal(false);

    try {
      // If the league doesn't require approval, directly add as member
      if (!league.settings.allowJoinRequests) {
        // Add user as a member directly
        await addDoc(collection(db, "leagueMemberships"), {
          leagueId: id,
          userId: auth.currentUser.uid,
          joinedAt: serverTimestamp(),
          status: "active",
          role: "player",
          stats: {
            gamesPlayed: 0,
            gamesWon: 0,
            totalPoints: 0,
            winRate: 0,
            currentStreak: 0,
            longestWinStreak: 0,
          },
        });

        // Note: Don't set local state here - let the onSnapshot listener handle it
        // This ensures consistency with real-time updates
        
        // Update league member count
        // In a real implementation, this would be handled by a server function
        // to ensure atomic updates
      } else {
        // Create a join request
        await addDoc(collection(db, "leagueJoinRequests"), {
          leagueId: id,
          userId: auth.currentUser.uid,
          requestedAt: serverTimestamp(),
          status: "pending",
          message: joinMessage,
        });
        
        // Note: Don't set local state here - let the onSnapshot listener handle it
        // This ensures consistency with real-time updates
      }
    } catch (err) {
      console.error("Error joining league:", err);
    } finally {
      setSubmitting(false);
    }
  };

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
    <div className="p-6 max-w-6xl mx-auto dark:text-white">
      <h1 className="text-2xl font-bold mb-6 flex items-center">
        <TrophyIcon className="h-7 w-7 mr-2 text-blue-500" />
        Join League: {league.name}
      </h1>

      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">League Information</h2>

        <p className="text-gray-700 dark:text-gray-300 mb-4">
          {league.description}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Details</h3>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-center">
                <UserGroupIcon className="h-5 w-5 mr-2 text-gray-500" />
                <span>{league.stats?.totalMembers || 0} members</span>
              </li>
              <li className="flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2 text-gray-500" />
                <span>
                  Created{" "}
                  {league.createdAt
                    ? new Date(league.createdAt.toDate()).toLocaleDateString()
                    : "Unknown"}
                </span>
              </li>
              <li className="flex items-center">
                <ChartBarIcon className="h-5 w-5 mr-2 text-gray-500" />
                <span>
                  {league.settings?.gameMode === "double"
                    ? "Team"
                    : "Individual"}{" "}
                  mode • {league.settings?.pointsToWin || 100} points
                </span>
              </li>
              <li className="flex items-center">
                {league.isPublic ? (
                  <>
                    <svg className="h-5 w-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-blue-600 dark:text-blue-400">Public League - Anyone can join</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-purple-600 dark:text-purple-400">Private League - Invitation only</span>
                  </>
                )}
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Game Settings</h3>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                <strong>Format:</strong>{" "}
                {league.settings?.tournamentFormat
                  ? league.settings.tournamentFormat.replace("-", " ")
                  : "Standard"}
              </li>
              <li>
                <strong>Rounds:</strong> {league.settings?.numberOfRounds || 0}
              </li>
              <li>
                <strong>Points System:</strong>{" "}
                {league.settings?.scoringSystem?.pointsPerWin || 0} pts win /{" "}
                {league.settings?.scoringSystem?.pointsPerDraw || 0} pts draw
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
        {alreadyMember ? (
          <div className="text-center py-8">
            <div className="mb-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2 text-green-700 dark:text-green-300">
                You are already a member of this league!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You have full access to view league details, participate in games, and compete with other members.
              </p>
              
              {redirectCountdown !== null && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md px-4 py-3 mb-4 inline-block">
                  <p className="text-blue-700 dark:text-blue-300 text-sm">
                    Redirecting to league page in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}...
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => navigate(`/leagues/${id}`)}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Go to League Now
              </button>
              <button
                onClick={() => navigate('/leagues')}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-zinc-700 dark:text-gray-200 dark:hover:bg-zinc-600 transition-colors"
              >
                Back to All Leagues
              </button>
            </div>
          </div>
        ) : pendingRequest ? (
          <div className="text-center py-6">
            <h2 className="text-xl font-semibold mb-2">
              Your request to join is pending
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Your request has been submitted and is awaiting approval. The league
              administrator will review your request soon.
            </p>
            <div className="flex justify-center">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md px-4 py-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <span className="text-yellow-700 dark:text-yellow-400">Request pending approval</span>
              </div>
            </div>
            <div className="mt-4">
              <Link
                to={`/leagues/${id}`}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                View League
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleJoinRequest}>
            <h2 className="text-xl font-semibold mb-4">Join Request</h2>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 dark:bg-red-900/20">
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {league.settings?.allowJoinRequests && (
              <div className="mb-4">
                <label
                  htmlFor="joinMessage"
                  className="block text-sm font-medium mb-1"
                >
                  Message (Optional)
                </label>
                <textarea
                  id="joinMessage"
                  value={joinMessage}
                  onChange={(e) => setJoinMessage(e.target.value)}
                  placeholder="Introduce yourself to the league administrators"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                  rows={3}
                />
                <p className="mt-1 text-sm text-gray-500">
                  {league.settings?.allowJoinRequests
                    ? "Your request will need to be approved by a league administrator."
                    : "You will be added to the league immediately."}
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <Link
                to={`/leagues/${id}`}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-zinc-700 dark:text-gray-200 dark:hover:bg-zinc-600"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={submitting}
                className={`px-4 py-2 rounded-md font-medium ${
                  submitting
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {submitting
                  ? "Processing..."
                  : league.settings?.allowJoinRequests
                  ? "Submit Request to Join"
                  : "Join League"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Join Confirmation Modal */}
      <ConfirmModal
        isOpen={showJoinConfirmModal}
        onClose={() => setShowJoinConfirmModal(false)}
        onConfirm={handleConfirmJoin}
        title="Confirm Join League"
        message={`Are you sure you want to join "${league?.name}"? ${
          league?.settings?.allowJoinRequests
            ? "Your request will be sent to the league administrators for approval."
            : "You will be added to the league immediately."
        }`}
        confirmText={league?.settings?.allowJoinRequests ? "Send Request" : "Join League"}
        confirmButtonClass="bg-blue-600 hover:bg-blue-700 text-white"
      />
    </div>
  );
};

export default JoinLeague;