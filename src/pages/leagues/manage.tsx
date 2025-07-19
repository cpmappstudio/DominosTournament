import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getFirestore,
  doc as firestoreDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  addDoc,
} from "firebase/firestore";
import { auth } from "../../firebase";
import { isJudge } from "../../utils/auth";
import { TrophyIcon } from "@heroicons/react/24/solid";
import type {
  League,
  LeagueMember,
  LeagueJoinRequest,
} from "../../models/league";
import { ConfirmModal } from "../../components/modal";

const LeagueManagement: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [joinRequests, setJoinRequests] = useState<LeagueJoinRequest[]>([]);
  const [activeTab, setActiveTab] = useState<
    "details" | "members" | "requests" | "danger"
  >("details");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userDisplayNames, setUserDisplayNames] = useState<
    Record<string, string>
  >({});
  const [fetchingUserData, setFetchingUserData] = useState(false);

  // League form data
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "",
    isPublic: true,
    gameMode: "",
    pointsToWin: 100,
    maxPlayers: 16,
    allowJoinRequests: true,
    requireConfirmation: true,
    playoffsEnabled: true,
    playoffTeams: 4,
  });

  // Handle join request approval/rejection
  const handleJoinRequest = async (
    requestId: string,
    status: "approved" | "rejected",
  ) => {
    if (!id) return;

    setSaving(true);
    setError(null);

    try {
      const db = getFirestore();
      const requestRef = firestoreDoc(db, "leagueJoinRequests", requestId);

      await updateDoc(requestRef, {
        status,
        updatedAt: serverTimestamp(),
      });

      // If approved, create a membership
      if (status === "approved") {
        const requestData = joinRequests.find((req) => req.id === requestId);
        if (requestData) {
          await addDoc(collection(db, "leagueMemberships"), {
            leagueId: id,
            userId: requestData.userId,
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
        }
      }

      // Update local state
      setJoinRequests((prev) => prev.filter((req) => req.id !== requestId));
    } catch (err) {
      console.error("Error handling join request:", err);
      setError("Failed to process join request");
    } finally {
      setSaving(false);
    }
  };

  // Handle league deletion
  const handleDeleteLeague = async () => {
    if (!id) return;

    setSaving(true);
    setError(null);

    try {
      const db = getFirestore();

      // Delete the league document
      await deleteDoc(firestoreDoc(db, "leagues", id));

      // Navigate back to leagues list
      navigate("/leagues");
    } catch (err) {
      console.error("Error deleting league:", err);
      setError("Failed to delete league. Please try again.");
      setSaving(false);
    }
  };

  // Check if user has permission to manage this league
  useEffect(() => {
    const checkPermission = async () => {
      if (!id || !auth.currentUser) {
        navigate("/leagues");
        return;
      }

      const db = getFirestore();
      const leagueRef = firestoreDoc(db, "leagues", id);
      const leagueSnap = await getDoc(leagueRef);

      if (!leagueSnap.exists()) {
        navigate("/leagues");
        return;
      }

      const leagueData = { id: leagueSnap.id, ...leagueSnap.data() } as League;

      if (
        !isJudge(auth.currentUser) &&
        leagueData.createdBy !== auth.currentUser.uid
      ) {
        navigate(`/leagues/${id}`);
        return;
      }
    };

    checkPermission();
  }, [id, navigate]);

  useEffect(() => {
    const fetchLeagueData = async () => {
      if (!id) return;

      setLoading(true);
      setError(null);

      try {
        const db = getFirestore();
        const leagueRef = firestoreDoc(db, "leagues", id);
        const leagueSnap = await getDoc(leagueRef);

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

        // Initialize form data
        setFormData({
          name: leagueData.name || "",
          description: leagueData.description || "",
          status: leagueData.status || "upcoming",
          isPublic: leagueData.isPublic ?? true,
          gameMode: leagueData.settings?.gameMode || "teams",
          pointsToWin: leagueData.settings?.pointsToWin || 100,
          maxPlayers: leagueData.settings?.maxPlayers || 16,
          allowJoinRequests: leagueData.settings?.allowJoinRequests ?? true,
          requireConfirmation: leagueData.settings?.requireConfirmation ?? true,
          playoffsEnabled: leagueData.settings?.playoffsEnabled ?? true,
          playoffTeams: leagueData.settings?.playoffTeams || 4,
        });

        // Fetch league members with real-time updates
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
            } as unknown as LeagueMember;
            membersData.push(memberData);
            userIds.push(memberData.userId);
          });

          setMembers(membersData);

          // Find which users we need to fetch data for (use local cache)
          const existingUserNames = { ...userDisplayNames };
          const missingUserIds = userIds.filter(
            (userId) => !existingUserNames[userId],
          );

          // Only fetch if we have missing users and aren't already fetching
          if (missingUserIds.length > 0 && !fetchingUserData) {
            setFetchingUserData(true);

            try {
              const userPromises: Promise<void>[] = [];
              const newUserNames: Record<string, string> = {
                ...existingUserNames,
              };

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
            } finally {
              setFetchingUserData(false);
            }
          }
        });

        // Fetch join requests with real-time updates
        const requestsQuery = query(
          collection(db, "leagueJoinRequests"),
          where("leagueId", "==", id),
          where("status", "==", "pending"),
        );

        const unsubRequests = onSnapshot(
          requestsQuery,
          async (requestsSnap) => {
            const requestsData: LeagueJoinRequest[] = [];
            const userIds: string[] = [];

            requestsSnap.forEach((docSnapshot) => {
              const requestData = {
                id: docSnapshot.id,
                ...docSnapshot.data(),
              } as unknown as LeagueJoinRequest;
              requestsData.push(requestData);
              userIds.push(requestData.userId);
            });

            setJoinRequests(requestsData);

            // Find which users we need to fetch data for (use local cache)
            const existingUserNames = { ...userDisplayNames };
            const missingUserIds = userIds.filter(
              (userId) => !existingUserNames[userId],
            );

            // Only fetch if we have missing users and aren't already fetching
            if (missingUserIds.length > 0 && !fetchingUserData) {
              setFetchingUserData(true);

              try {
                const userPromises: Promise<void>[] = [];
                const newUserNames: Record<string, string> = {
                  ...userDisplayNames,
                };

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
              } finally {
                setFetchingUserData(false);
              }
            }
          },
        );

        return () => {
          unsubMembers();
          unsubRequests();
        };
      } catch (err) {
        console.error("Error fetching league data:", err);
        setError("Failed to load league data");
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) return;

    setSaving(true);
    setError(null);

    try {
      const db = getFirestore();

      // Prepare league update data
      const leagueUpdate = {
        name: formData.name,
        description: formData.description,
        status: formData.status,
        isPublic: formData.isPublic,
        settings: {
          gameMode: formData.gameMode,
          pointsToWin: formData.pointsToWin,
          maxPlayers: formData.maxPlayers,
          allowJoinRequests: formData.allowJoinRequests,
          requireConfirmation: formData.requireConfirmation,
          playoffsEnabled: formData.playoffsEnabled,
          playoffTeams: formData.playoffTeams,
        },
        updatedAt: serverTimestamp(),
      };

      // Update league document
      await updateDoc(firestoreDoc(db, "leagues", id), leagueUpdate);

      // Update local state
      if (league) {
        const updatedLeague = {
          ...league,
          name: formData.name,
          description: formData.description,
          status: formData.status as any,
          isPublic: formData.isPublic,
          settings: {
            ...league.settings,
            gameMode: formData.gameMode as any,
            pointsToWin: formData.pointsToWin,
            maxPlayers: formData.maxPlayers,
            allowJoinRequests: formData.allowJoinRequests,
            requireConfirmation: formData.requireConfirmation,
            playoffsEnabled: formData.playoffsEnabled,
            playoffTeams: formData.playoffTeams,
          },
        };

        setLeague(updatedLeague);
      }
    } catch (err) {
      console.error("Error updating league:", err);
      setError("Failed to update league settings");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: parseInt(value) || 0 }));
  };

  const handleMemberAction = async (
    memberId: string,
    action: "promote" | "demote" | "remove",
  ) => {
    if (!id || !memberId) return;

    setSaving(true);
    setError(null);

    try {
      const db = getFirestore();
      const memberRef = firestoreDoc(db, "leagueMemberships", memberId);

      if (action === "remove") {
        // Remove member
        await updateDoc(memberRef, {
          status: "inactive",
          updatedAt: serverTimestamp(),
        });

        // Update local state
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
      } else if (action === "promote") {
        // Promote to admin
        await updateDoc(memberRef, {
          role: "admin",
          updatedAt: serverTimestamp(),
        });

        // Update local state
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: "admin" } : m)),
        );
      } else if (action === "demote") {
        // Demote to player
        await updateDoc(memberRef, {
          role: "player",
          updatedAt: serverTimestamp(),
        });

        // Update local state
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: "player" } : m)),
        );
      }
    } catch (err) {
      console.error(`Error ${action} member:`, err);
      setError(`Failed to ${action} member. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!league) {
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
    <div className="p-6 max-w-4xl mx-auto text-white">
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteLeague}
        title="Delete League"
        message={
          <div>
            <p className="mb-2">
              Are you sure you want to delete the league{" "}
              <strong>{league.name}</strong>?
            </p>
            <p>
              This action cannot be undone. All league data, memberships, and
              associated games will be permanently deleted.
            </p>
          </div>
        }
        confirmText="Delete League"
        isDestructive={true}
      />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <TrophyIcon className="h-8 w-8 mr-2 text-blue-500" />
          Manage League: {league.name}
        </h1>

        <Link to={`/leagues/${id}`} className="text-blue-600 hover:underline">
          &larr; Back to League
        </Link>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow mb-6 ">
        <div className="flex border-b border-gray-200 dark:border-zinc-700">
          <button
            className={`px-6 py-3 font-medium text-sm border-b-2 ${
              activeTab === "details"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
            onClick={() => setActiveTab("details")}
          >
            League Details
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
              activeTab === "requests"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
            onClick={() => setActiveTab("requests")}
          >
            Join Requests ({joinRequests.length})
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm border-b-2 ${
              activeTab === "danger"
                ? "border-red-500 text-red-600 dark:text-red-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
            onClick={() => setActiveTab("danger")}
          >
            Danger Zone
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
        {activeTab === "danger" && (
          <div>
            <h2 className="text-xl font-semibold text-red-600 mb-4">
              Danger Zone
            </h2>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 dark:bg-red-900/20">
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="border border-red-300 rounded-md p-6 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
              <h3 className="text-lg font-medium text-red-800 dark:text-red-400">
                Delete League
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1 mb-4">
                Once you delete a league, there is no going back. All league
                data, memberships, and associated games will be permanently
                deleted.
              </p>

              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Deleting..." : "Delete League"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "details" && (
          <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-semibold mb-4">Edit League Details</h2>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 dark:bg-red-900/20">
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium mb-1"
                >
                  League Name*
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium mb-1"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                  rows={3}
                />
              </div>

              <div>
                <label
                  htmlFor="status"
                  className="block text-sm font-medium mb-1"
                >
                  League Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isPublic"
                    checked={formData.isPublic}
                    onChange={handleCheckboxChange}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2 text-sm">
                    Public League (visible to all users)
                  </span>
                </label>
              </div>
            </div>

            <h3 className="text-lg font-medium mb-3">Game Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label
                  htmlFor="gameMode"
                  className="block text-sm font-medium mb-1"
                >
                  Game Mode
                </label>
                <select
                  id="gameMode"
                  name="gameMode"
                  value={formData.gameMode}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                >
                  <option value="teams">Teams (Traditional Boricua)</option>
                  <option value="individual">Individual (Free-for-all)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="pointsToWin"
                  className="block text-sm font-medium mb-1"
                >
                  Points to Win
                </label>
                <select
                  id="pointsToWin"
                  name="pointsToWin"
                  value={formData.pointsToWin}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                >
                  <option value="100">100 points (short game)</option>
                  <option value="150">150 points (standard match)</option>
                  <option value="200">200 points (formal match)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="maxPlayers"
                  className="block text-sm font-medium mb-1"
                >
                  Maximum Players
                </label>
                <input
                  type="number"
                  id="maxPlayers"
                  name="maxPlayers"
                  value={formData.maxPlayers}
                  onChange={handleNumberChange}
                  min="4"
                  max="64"
                  step="4"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Playoff Settings
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="playoffsEnabled"
                      checked={formData.playoffsEnabled}
                      onChange={handleCheckboxChange}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm">Enable playoffs</span>
                  </label>

                  {formData.playoffsEnabled && (
                    <div>
                      <label
                        htmlFor="playoffTeams"
                        className="block text-sm font-medium mb-1"
                      >
                        Teams in Playoffs
                      </label>
                      <input
                        type="number"
                        id="playoffTeams"
                        name="playoffTeams"
                        value={formData.playoffTeams}
                        onChange={handleNumberChange}
                        min="2"
                        max="16"
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="allowJoinRequests"
                  checked={formData.allowJoinRequests}
                  onChange={handleCheckboxChange}
                  className="h-4 w-4 text-blue-600"
                />
                <span className="ml-2 text-sm">
                  Allow players to request to join the league
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="requireConfirmation"
                  checked={formData.requireConfirmation}
                  onChange={handleCheckboxChange}
                  className="h-4 w-4 text-blue-600"
                />
                <span className="ml-2 text-sm">
                  Require both players to confirm game results
                </span>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className={`px-4 py-2 rounded-md font-medium ${
                  saving
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}

        {activeTab === "members" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              League Members ({members.length})
            </h2>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 dark:bg-red-900/20">
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {members.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No members in this league yet
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
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-zinc-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-zinc-700">
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {userDisplayNames[member.userId] || member.userId}
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
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {member.role !== "owner" && (
                            <div className="flex justify-end space-x-2">
                              {member.role === "player" && (
                                <button
                                  onClick={() =>
                                    handleMemberAction(
                                      member.id as string,
                                      "promote",
                                    )
                                  }
                                  disabled={saving}
                                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                  Promote
                                </button>
                              )}

                              {member.role === "admin" && (
                                <button
                                  onClick={() =>
                                    handleMemberAction(
                                      member.id as string,
                                      "demote",
                                    )
                                  }
                                  disabled={saving}
                                  className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                                >
                                  Demote
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  handleMemberAction(
                                    member.id as string,
                                    "remove",
                                  )
                                }
                                disabled={saving}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "requests" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Join Requests ({joinRequests.length})
            </h2>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 dark:bg-red-900/20">
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {joinRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No pending join requests
              </div>
            ) : (
              <div className="space-y-4">
                {joinRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-4 border border-gray-200 dark:border-zinc-600"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-medium">
                          {userDisplayNames[request.userId] || request.userId}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Requested{" "}
                          {new Date(
                            request.requestedAt.toDate(),
                          ).toLocaleDateString()}
                        </p>
                        {request.message && (
                          <p className="mt-2 text-gray-700 dark:text-gray-300">
                            {request.message}
                          </p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() =>
                            handleJoinRequest(request.id, "approved")
                          }
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() =>
                            handleJoinRequest(request.id, "rejected")
                          }
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeagueManagement;
