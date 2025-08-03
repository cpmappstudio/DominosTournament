import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getFirestore,
  doc as firestoreDoc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  addDoc,
  runTransaction,
  limit,
} from "firebase/firestore";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { auth, uploadLeagueImage, getLeagueSeasons, getCurrentSeason, createSeason, updateSeasonStatus, getAllSeasons } from "../../firebase";
import { isJudge } from "../../utils/auth";
import { TrophyIcon } from "@heroicons/react/24/solid";
import type {
  League,
  LeagueMember,
  LeagueJoinRequest,
  Season,
} from "../../models/league";
import { ConfirmModal } from "../../components/modal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Button } from "../../components/ui/button";
import { useGameConfig } from "../../config/gameConfig";
import ImageUploader from "../../components/ImageUploader";
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
import { Input } from "../../components/input";
import UserProfileModal, { useUserProfileModal } from "../../components/UserProfileModal";
import { getUserProfile } from "../../firebase";

const LeagueManagement: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [joinRequests, setJoinRequests] = useState<LeagueJoinRequest[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [globalSeasons, setGlobalSeasons] = useState<Season[]>([]);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
  const [userDisplayNames, setUserDisplayNames] = useState<
    Record<string, string>
  >({});
  const [userPhotoURLs, setUserPhotoURLs] = useState<
    Record<string, string>
  >({});
  const [fetchingUserData, setFetchingUserData] = useState(false);

  // Estados para imagen de liga
  const [leagueImageUrl, setLeagueImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Modal de perfil de usuario
  const { isOpen: isProfileModalOpen, selectedUser, openModal: openProfileModal, closeModal: closeProfileModal } = useUserProfileModal();

  // Estados para la tabla de miembros con búsqueda
  const [membersSorting, setMembersSorting] = useState<SortingState>([]);
  const [membersColumnFilters, setMembersColumnFilters] = useState<ColumnFiltersState>([]);
  const [membersGlobalFilter, setMembersGlobalFilter] = useState("");

  // Game configuration hook
  const { config: gameConfig, loading: configLoading } = useGameConfig();

  // League form data
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "",
    isPublic: true,
    gameMode: "",
    pointsToWin: 150,
    maxPlayers: 16,
    allowJoinRequests: true,
    requireConfirmation: true,
    ruleset: "standard",
    // Tournament settings
    tournamentFormat: "round-robin",
    numberOfRounds: 5,
    playoffsEnabled: true,
    playoffTeams: 4,
    // Scoring system
    pointsPerWin: 3,
    pointsPerDraw: 1,
    pointsPerLoss: 0,
    usePointDifferential: true,
    // Game rules
    timeLimit: 30,
    penaltiesEnabled: true,
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

      // If approved, create a membership using transaction to prevent duplicates
      if (status === "approved") {
        const requestData = joinRequests.find((req) => req.id === requestId);
        if (requestData) {
          await runTransaction(db, async (transaction) => {
            // Check if membership already exists within transaction
            const existingMembershipQuery = query(
              collection(db, "leagueMemberships"),
              where("leagueId", "==", id),
              where("userId", "==", requestData.userId)
            );
            
            const existingMembershipSnap = await getDocs(existingMembershipQuery);
            
            if (existingMembershipSnap.empty) {
              // Create the membership document reference
              const membershipRef = firestoreDoc(collection(db, "leagueMemberships"));
              
              // Set the membership data using transaction
              transaction.set(membershipRef, {
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
            } else {
              console.warn("Membership already exists for user", requestData.userId);
              // If membership already exists, we can optionally update its status
              const existingDoc = existingMembershipSnap.docs[0];
              transaction.update(existingDoc.ref, {
                status: "active",
                updatedAt: serverTimestamp()
              });
            }
          });
          
          // Clean any duplicates that might have been created
          await cleanDuplicatesAfterApproval(id);
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

        // Initialize form data with proper fallback handling
        setFormData({
          name: leagueData.name || "",
          description: leagueData.description || "",
          status: leagueData.status || "upcoming",
          isPublic: leagueData.isPublic ?? true,
          gameMode: leagueData.settings?.gameMode ?? "double",
          pointsToWin: leagueData.settings?.pointsToWin ?? 150,
          maxPlayers: leagueData.settings?.maxPlayers ?? 16,
          allowJoinRequests: leagueData.settings?.allowJoinRequests ?? true,
          requireConfirmation: leagueData.settings?.requireConfirmation ?? true,
          ruleset: "standard", // Default value since it's not in the current model
          // Tournament settings
          tournamentFormat: leagueData.settings?.tournamentFormat ?? "round-robin",
          numberOfRounds: leagueData.settings?.numberOfRounds ?? 5,
          playoffsEnabled: leagueData.settings?.playoffsEnabled ?? true,
          playoffTeams: leagueData.settings?.playoffTeams ?? 4,
          // Scoring system
          pointsPerWin: leagueData.settings?.scoringSystem?.pointsPerWin ?? 3,
          pointsPerDraw: leagueData.settings?.scoringSystem?.pointsPerDraw ?? 1,
          pointsPerLoss: leagueData.settings?.scoringSystem?.pointsPerLoss ?? 0,
          usePointDifferential: leagueData.settings?.scoringSystem?.usePointDifferential ?? true,
          // Game rules - using proper nullish coalescing for 0 values
          timeLimit: leagueData.settings?.timeLimit ?? 30,
          penaltiesEnabled: leagueData.settings?.penaltiesEnabled ?? true,
        });

        // Initialize league image URL
        setLeagueImageUrl(leagueData.photoURL || null);

        // Fetch league members with real-time updates (active and inactive)
        const membersQuery = query(
          collection(db, "leagueMemberships"),
          where("leagueId", "==", id),
          where("status", "in", ["active", "inactive"]),
        );

        const unsubMembers = onSnapshot(membersQuery, async (membersSnap) => {
          
          // First, collect all member data
          const allMembersData: LeagueMember[] = [];
          const userIds: string[] = [];

          membersSnap.forEach((docSnapshot) => {
            const memberData = {
              id: docSnapshot.id,
              ...docSnapshot.data(),
            } as unknown as LeagueMember;
            allMembersData.push(memberData);
            userIds.push(memberData.userId);
          });

          // Fetch user data to check for judges and get display names
          const userDataPromises = userIds.map(async (userId) => {
            try {
              const userDoc = await getDoc(firestoreDoc(db, "users", userId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                return {
                  userId,
                  userData,
                  isJudgeUser: isJudge(userData.email || ""),
                  displayName: userData.displayName || userData.username || userId,
                  photoURL: userData.photoURL || null
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
              photoURL: null
            };
          });

          try {
            const userDataResults = await Promise.all(userDataPromises);
            const userDataMap = new Map(userDataResults.map(result => [result.userId, result]));
            
            // Filter out judges/administrators and prepare final member list
            const filteredMembersData: LeagueMember[] = [];
            const seenUserIds = new Set<string>(); // Track seen users to avoid duplicates
            
            allMembersData.forEach((member) => {
              const userResult = userDataMap.get(member.userId);
              
              // Only include non-judge members and avoid duplicates
              if (userResult && !userResult.isJudgeUser && !seenUserIds.has(member.userId)) {
                filteredMembersData.push(member);
                seenUserIds.add(member.userId);
              }
            });

            setMembers(filteredMembersData);

            // Update display names state for non-judge users only
            const newUserNames: Record<string, string> = { ...userDisplayNames };
            const newUserPhotos: Record<string, string> = { ...userPhotoURLs };
            userDataResults.forEach((result) => {
              if (!result.isJudgeUser) {
                newUserNames[result.userId] = result.displayName;
                if (result.photoURL) {
                  newUserPhotos[result.userId] = result.photoURL;
                }
              }
            });
            
            setUserDisplayNames(newUserNames);
            setUserPhotoURLs(newUserPhotos);
            
          } catch (error) {
            console.error("Error processing member data:", error);
            // Fallback: set members without filtering if there's an error
            setMembers(allMembersData);
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
                const newUserPhotos: Record<string, string> = {
                  ...userPhotoURLs,
                };

                // Create a promise for each user
                missingUserIds.forEach((userId) => {
                  const userPromise = getDoc(firestoreDoc(db, "users", userId))
                    .then((userDoc) => {
                      if (userDoc.exists()) {
                        const userData = userDoc.data();
                        newUserNames[userId] =
                          userData.displayName || userData.username || userId;
                        if (userData.photoURL) {
                          newUserPhotos[userId] = userData.photoURL;
                        }
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
                setUserPhotoURLs(newUserPhotos);
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

    // Fetch seasons data
    const fetchSeasonsData = async () => {
      if (!id) return;
      
      try {
        const [leagueSeasons, allGlobalSeasons] = await Promise.all([
          getLeagueSeasons(id),
          getAllSeasons(), // Global seasons
        ]);
        
        setSeasons(leagueSeasons);
        setGlobalSeasons(allGlobalSeasons);
        
        // Get the current season association for this league
        const db = getFirestore();
        const leagueSeasonQuery = query(
          collection(db, "leagueSeasons"),
          where("leagueId", "==", id),
          where("status", "==", "active"),
          limit(1)
        );
        
        const leagueSeasonSnap = await getDocs(leagueSeasonQuery);
        
        if (!leagueSeasonSnap.empty) {
          const leagueSeasonData = leagueSeasonSnap.docs[0].data();
          const associatedSeasonId = leagueSeasonData.seasonId;
          
          // Find the season in the global seasons
          const associatedSeason = allGlobalSeasons.find(s => s.id === associatedSeasonId);
          
          if (associatedSeason) {
            setCurrentSeason(associatedSeason);
            setSelectedSeasonId(associatedSeasonId);
          }
        }
      } catch (err) {
        console.error("Error fetching seasons data:", err);
      }
    };

    fetchLeagueData();
    fetchSeasonsData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) return;

    setSaving(true);
    setError(null);

    try {
      const db = getFirestore();

      // Prepare league update data (image upload is handled by ImageUploader component)
      const leagueUpdate = {
        name: formData.name,
        description: formData.description,
        status: formData.status,
        isPublic: formData.isPublic,
        ...(leagueImageUrl && { photoURL: leagueImageUrl }),
        settings: {
          gameMode: formData.gameMode,
          pointsToWin: formData.pointsToWin,
          maxPlayers: formData.maxPlayers,
          allowJoinRequests: formData.allowJoinRequests,
          requireConfirmation: formData.requireConfirmation,
          tournamentFormat: formData.tournamentFormat,
          numberOfRounds: formData.numberOfRounds,
          playoffsEnabled: formData.playoffsEnabled,
          playoffTeams: formData.playoffTeams,
          timeLimit: formData.timeLimit,
          penaltiesEnabled: formData.penaltiesEnabled,
          scoringSystem: {
            pointsPerWin: formData.pointsPerWin,
            pointsPerDraw: formData.pointsPerDraw,
            pointsPerLoss: formData.pointsPerLoss,
            usePointDifferential: formData.usePointDifferential,
          },
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
            tournamentFormat: formData.tournamentFormat as any,
            numberOfRounds: formData.numberOfRounds,
            playoffsEnabled: formData.playoffsEnabled,
            playoffTeams: formData.playoffTeams,
            timeLimit: formData.timeLimit,
            penaltiesEnabled: formData.penaltiesEnabled,
            scoringSystem: {
              pointsPerWin: formData.pointsPerWin,
              pointsPerDraw: formData.pointsPerDraw,
              pointsPerLoss: formData.pointsPerLoss,
              usePointDifferential: formData.usePointDifferential,
            },
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

  // Funciones para manejar imagen de liga
  const handleImageUpload = async (file: File): Promise<string> => {
    if (!id) throw new Error("League ID not found");
    
    setImageError(null);
    try {
      const imageUrl = await uploadLeagueImage(file, id);
      setLeagueImageUrl(imageUrl);
      return imageUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload image";
      setImageError(errorMessage);
      throw error;
    }
  };

  const handleImageRemove = () => {
    setLeagueImageUrl(null);
    setImageError(null);
  };

  // Función para manejar click en perfil de miembro
  const handleMemberClick = async (member: LeagueMember) => {
    try {
      const fullUserProfile = await getUserProfile(member.userId);
      
      if (fullUserProfile) {
        openProfileModal(fullUserProfile);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  // Función para manejar cambio de estado de miembro
  const handleMemberStatusChange = async (memberId: string, newStatus: "active" | "inactive") => {
    if (!id || !memberId) return;

    setSaving(true);
    setError(null);

    try {
      const db = getFirestore();
      const memberRef = firestoreDoc(db, "leagueMemberships", memberId);

      await updateDoc(memberRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      // Update local state
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, status: newStatus } : m))
      );
    } catch (err) {
      console.error("Error updating member status:", err);
      setError("Failed to update member status. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleMemberAction = async (
    memberId: string,
    action: "promote" | "demote" | "remove",
  ) => {
    if (!id || !memberId) return;

    // If action is remove, show confirmation modal instead of executing immediately
    if (action === "remove") {
      const member = members.find((m) => m.id === memberId);
      if (member) {
        const memberName = userDisplayNames[member.userId] || member.userId;
        setMemberToRemove({ id: memberId, name: memberName });
        setShowRemoveMemberModal(true);
      }
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const db = getFirestore();
      const memberRef = firestoreDoc(db, "leagueMemberships", memberId);

      if (action === "promote") {
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

  // Handle confirmed member removal
  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;

    setSaving(true);
    setError(null);

    try {
      const db = getFirestore();
      const memberRef = firestoreDoc(db, "leagueMemberships", memberToRemove.id);

      // Permanently delete the membership document from Firebase
      await deleteDoc(memberRef);

      // Update local state - remove member from list
      setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
      
      // Close modal and reset state
      setShowRemoveMemberModal(false);
      setMemberToRemove(null);
    } catch (err) {
      console.error("Error removing member:", err);
      setError("Failed to remove member. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Function to associate a league with a season
  const handleSeasonChange = async (seasonId: string) => {
    if (!id || !seasonId) return;

    setSaving(true);
    setError(null);

    try {
      const db = getFirestore();

      // First check if this association already exists
      const existingAssociationQuery = query(
        collection(db, "leagueSeasons"),
        where("leagueId", "==", id),
        where("seasonId", "==", seasonId)
      );
      
      const existingSnap = await getDocs(existingAssociationQuery);
      
      if (existingSnap.empty) {
        // Create new association
        await addDoc(collection(db, "leagueSeasons"), {
          leagueId: id,
          seasonId: seasonId,
          joinedAt: serverTimestamp(),
          status: "active"
        });
      }

      // Update the selected season
      setSelectedSeasonId(seasonId);
      
      // Refresh seasons data
      const [leagueSeasons, currentSeasonData] = await Promise.all([
        getLeagueSeasons(id),
        getCurrentSeason(id),
      ]);
      
      setSeasons(leagueSeasons);
      setCurrentSeason(currentSeasonData);
      
    } catch (err) {
      console.error("Error associating season with league:", err);
      setError("Failed to associate season with league");
    } finally {
      setSaving(false);
    }
  };

  // Clean duplicates when approving join requests
  const cleanDuplicatesAfterApproval = async (leagueId: string) => {
    try {
      const db = getFirestore();
      
      // Get all memberships for this league
      const allMembershipsQuery = query(
        collection(db, "leagueMemberships"),
        where("leagueId", "==", leagueId)
      );
      
      const allMembershipsSnap = await getDocs(allMembershipsQuery);
      const membershipsByUser = new Map<string, any[]>();
      
      // Group memberships by userId
      allMembershipsSnap.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as any;
        const userId = data.userId as string;
        
        if (!membershipsByUser.has(userId)) {
          membershipsByUser.set(userId, []);
        }
        membershipsByUser.get(userId)!.push(data);
      });
      
      let duplicatesRemoved = 0;
      
      // For each user, keep only the most recent membership
      for (const [userId, memberships] of membershipsByUser) {
        if (memberships.length > 1) {
          // Sort by status (active first), then by joinedAt (most recent first)
          memberships.sort((a, b) => {
            // Prefer active status
            if (a.status === "active" && b.status !== "active") return -1;
            if (b.status === "active" && a.status !== "active") return 1;
            
            // Then by joinedAt (most recent first)
            const aTime = a.joinedAt?.toMillis() || 0;
            const bTime = b.joinedAt?.toMillis() || 0;
            if (aTime !== bTime) return bTime - aTime;
            
            // Finally by document ID for deterministic ordering
            return a.id.localeCompare(b.id);
          });
          
          // Keep the first (best), delete the rest
          const toDelete = memberships.slice(1);
          
          for (const membership of toDelete) {
            try {
              await deleteDoc(firestoreDoc(db, "leagueMemberships", membership.id));
              duplicatesRemoved++;
            } catch (error) {
              console.error(`Failed to delete duplicate membership ${membership.id}:`, error);
            }
          }
        }
      }
      
      if (duplicatesRemoved > 0) {
        console.log(`Cleaned ${duplicatesRemoved} duplicate memberships for league ${leagueId}`);
      }
      
      return duplicatesRemoved;
      
    } catch (err) {
      console.error("Error cleaning duplicates:", err);
      return 0;
    }
  };

  // Definir las columnas de la tabla de miembros
  const membersColumns = useMemo<ColumnDef<LeagueMember & { displayName?: string }>[]>(() => [
    {
      accessorKey: "displayName",
      header: "Member",
      cell: ({ row }) => {
        const member = row.original;
        const displayName = userDisplayNames[member.userId] || member.userId;
        return (
          <div className="font-medium text-xs sm:text-sm flex items-center space-x-2">
            <Avatar 
              className="h-6 w-6 sm:h-8 sm:w-8 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleMemberClick(member)}
            >
              <AvatarImage src={userPhotoURLs[member.userId] || undefined} alt={displayName} />
              <AvatarFallback className="text-xs">
                {displayName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div 
              className="truncate max-w-20 sm:max-w-none cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors" 
              title={displayName}
              onClick={() => handleMemberClick(member)}
            >
              {displayName}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const member = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => e.stopPropagation()}
                className={`px-2 py-1 text-xs rounded-full border ${
                  member.status === "active"
                    ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800 dark:hover:bg-green-800/30"
                    : "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                }`}
                disabled={saving}
              >
                {member.status}
                <span className="ml-1">▼</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem 
                onClick={() => handleMemberStatusChange(member.id as string, "active")}
                className={member.status === "active" ? "bg-green-50 dark:bg-green-900/20" : ""}
              >
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Active
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleMemberStatusChange(member.id as string, "inactive")}
                className={member.status === "inactive" ? "bg-gray-50 dark:bg-gray-800/50" : ""}
              >
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                  Inactive
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
    {
      accessorKey: "joinedAt",
      header: "Joined",
      cell: ({ row }) => {
        const member = row.original;
        return (
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {member.joinedAt
              ? new Date(member.joinedAt.toDate()).toLocaleDateString()
              : "Unknown"}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const member = row.original;
        if (member.role !== "owner") {
          return (
            <div className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMemberAction(member.id as string, "remove");
                }}
                disabled={saving}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 h-8 px-2 text-xs"
              >
                Remove
              </Button>
            </div>
          );
        }
        return null;
      },
    },
  ], [userDisplayNames, userPhotoURLs, saving, handleMemberClick, handleMemberStatusChange, handleMemberAction]);

  // Preparar datos de miembros con nombres para mostrar
  const membersWithDisplayNames = useMemo(() => 
    members.map(member => ({
      ...member,
      displayName: userDisplayNames[member.userId] || member.userId
    })), 
    [members, userDisplayNames]
  );

  // Configurar la tabla de miembros
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!league) {
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
      {/* Delete League Confirmation Modal */}
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

      {/* Remove Member Confirmation Modal */}
      <ConfirmModal
        isOpen={showRemoveMemberModal}
        onClose={() => {
          setShowRemoveMemberModal(false);
          setMemberToRemove(null);
        }}
        onConfirm={handleConfirmRemoveMember}
        title="Remove Member"
        message={
          <div>
            <p className="mb-2">
              Are you sure you want to permanently remove{" "}
              <strong>{memberToRemove?.name}</strong> from the league?
            </p>
            <p className="text-sm text-orange-600 dark:text-orange-400">
              This action permanently deletes their membership from the database. 
              They will need to request to join again if they want to rejoin.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Note: Use "Inactive" status instead if you want to temporarily suspend them while keeping their membership record.
            </p>
          </div>
        }
        confirmText="Remove Member"
        isDestructive={true}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold flex items-center">
          <TrophyIcon className="h-8 w-8 mr-2 text-blue-500" />
          Manage League: {league.name}
        </h1>

        <Link to={`/leagues/${id}`} className="text-blue-600 hover:underline whitespace-nowrap">
          &larr; Back to League
        </Link>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="w-full">
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <TabsList className="grid w-max min-w-full sm:w-full grid-cols-4 mx-3 sm:mx-0">
            <TabsTrigger value="details" className="text-xs sm:text-sm">League Details</TabsTrigger>
            <TabsTrigger value="members" className="text-xs sm:text-sm">Members ({members.filter(m => m.status === "active").length})</TabsTrigger>
            <TabsTrigger value="requests" className="text-xs sm:text-sm">Join Requests ({joinRequests.length})</TabsTrigger>
            <TabsTrigger value="danger" className="text-xs sm:text-sm text-red-600 dark:text-red-400">Danger Zone</TabsTrigger>
          </TabsList>
        </div>

        
        <TabsContent value="danger" className="mt-4 sm:mt-6 w-full">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="mt-4 sm:mt-6 w-full">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Edit League Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 dark:bg-red-900/20">
                    <p className="text-red-700 dark:text-red-300">{error}</p>
                  </div>
                )}

                {/* Basic Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2">
                    Basic Information
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name" className="text-sm font-medium">
                        League Name*
                      </Label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full p-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                        required
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium">
                        League Avatar
                      </Label>
                      <div className="mt-1">
                        <ImageUploader
                          currentImageUrl={leagueImageUrl}
                          onImageUpload={handleImageUpload}
                          onImageRemove={handleImageRemove}
                          uploading={imageUploading}
                          error={imageError}
                          size="md"
                          title="League Avatar"
                          placeholder="Upload"
                          acceptedFormats={["JPG", "PNG", "GIF", "WebP"]}
                          maxSizeInMB={5}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="status" className="text-sm font-medium">
                        League Status
                      </Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between mt-1">
                            {formData.status || "Select status"}
                            <span className="ml-2">▼</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-full">
                          <DropdownMenuItem onClick={() => setFormData(prev => ({ ...prev, status: "upcoming" }))}>
                            Upcoming
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFormData(prev => ({ ...prev, status: "active" }))}>
                            Active
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFormData(prev => ({ ...prev, status: "completed" }))}>
                            Completed
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFormData(prev => ({ ...prev, status: "canceled" }))}>
                            Canceled
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div>
                      <Label htmlFor="season" className="text-sm font-medium">
                        Associated Season
                      </Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between mt-1" disabled={saving}>
                            {selectedSeasonId ? 
                              globalSeasons.find(season => season.id === selectedSeasonId)?.name || "Season not found" :
                              "Select a season"
                            }
                            <span className="ml-2">▼</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-full max-h-60 overflow-y-auto">
                          <DropdownMenuItem onClick={() => handleSeasonChange("")}>
                            <span className="text-gray-500">No season</span>
                          </DropdownMenuItem>
                          {globalSeasons.map((season) => (
                            <DropdownMenuItem 
                              key={season.id}
                              onClick={() => handleSeasonChange(season.id)}
                              className={selectedSeasonId === season.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}
                            >
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{season.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {season.status === "active" ? "Active" : 
                                   season.status === "completed" ? "Completed" : "Upcoming"}
                                  {season.startDate && ` • ${new Date(season.startDate.toDate()).getFullYear()}`}
                                </span>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {selectedSeasonId && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          This league is associated with the selected global season
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-sm font-medium">
                      Description
                    </Label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      className="w-full p-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                      rows={3}
                    />
                  </div>

                  <Label className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950">
                    <Checkbox
                      id="isPublic"
                      checked={formData.isPublic}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublic: !!checked }))}
                      className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                    />
                    <div className="grid gap-1.5 font-normal">
                      <p className="text-sm leading-none font-medium">
                        Public League
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        When enabled, this league appears in the public leagues list and anyone can request to join. When disabled, the league is private and only visible to existing members and administrators.
                      </p>
                    </div>
                  </Label>
                </div>

                {/* Game Settings Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2">
                    Game Settings
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="gameMode" className="text-sm font-medium">
                        Game Mode
                      </Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between mt-1" disabled={configLoading}>
                            {gameConfig?.gameModes.find(mode => mode.value === formData.gameMode)?.label || "Select game mode"}
                            <span className="ml-2">▼</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-full">
                          {gameConfig?.gameModes.map((mode) => (
                            <DropdownMenuItem 
                              key={mode.value}
                              onClick={() => setFormData(prev => ({ ...prev, gameMode: mode.value }))}
                            >
                              <div className="flex flex-col">
                                <span>{mode.label}</span>
                                {mode.description && (
                                  <span className="text-xs text-gray-500">{mode.description}</span>
                                )}
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div>
                      <Label htmlFor="pointsToWin" className="text-sm font-medium">
                        Points to Win
                      </Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between mt-1" disabled={configLoading}>
                            {gameConfig?.pointsOptions.find(option => option.value === formData.pointsToWin)?.label || `${formData.pointsToWin} points`}
                            <span className="ml-2">▼</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-full">
                          {gameConfig?.pointsOptions.map((option) => (
                            <DropdownMenuItem 
                              key={option.value}
                              onClick={() => setFormData(prev => ({ ...prev, pointsToWin: option.value }))}
                            >
                              <div className="flex flex-col">
                                <span>{option.label}</span>
                                {option.description && (
                                  <span className="text-xs text-gray-500">{option.description}</span>
                                )}
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div>
                      <Label htmlFor="ruleset" className="text-sm font-medium">
                        Ruleset
                      </Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between mt-1" disabled={configLoading}>
                            {gameConfig?.rulesets.find(ruleset => ruleset.value === formData.ruleset)?.label || "Select ruleset"}
                            <span className="ml-2">▼</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-full">
                          {gameConfig?.rulesets.map((ruleset) => (
                            <DropdownMenuItem 
                              key={ruleset.value}
                              onClick={() => setFormData(prev => ({ ...prev, ruleset: ruleset.value }))}
                            >
                              <div className="flex flex-col">
                                <span>{ruleset.label}</span>
                                {ruleset.description && (
                                  <span className="text-xs text-gray-500">{ruleset.description}</span>
                                )}
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div>
                      <Label htmlFor="maxPlayers" className="text-sm font-medium">
                        Maximum Players
                      </Label>
                      <input
                        type="number"
                        id="maxPlayers"
                        name="maxPlayers"
                        value={formData.maxPlayers}
                        onChange={handleNumberChange}
                        min={formData.gameMode === "double" ? "4" : "2"}
                        max="64"
                        step={formData.gameMode === "double" ? "4" : "1"}
                        className="w-full p-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.gameMode === "double" ? "Must be divisible by 4 for team play" : "Minimum 2 players"}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="timeLimit" className="text-sm font-medium">
                        Time Limit (minutes)
                      </Label>
                      <input
                        type="number"
                        id="timeLimit"
                        name="timeLimit"
                        value={formData.timeLimit}
                        onChange={handleNumberChange}
                        min="0"
                        max="120"
                        className="w-full p-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Set to 0 for no time limit
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950">
                      <Checkbox
                        id="allowJoinRequests"
                        checked={formData.allowJoinRequests}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allowJoinRequests: !!checked }))}
                        className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                      />
                      <div className="grid gap-1.5 font-normal">
                        <p className="text-sm leading-none font-medium">
                          Allow Join Requests
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Players can request to join this league
                        </p>
                      </div>
                    </Label>

                    <Label className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950">
                      <Checkbox
                        id="requireConfirmation"
                        checked={formData.requireConfirmation}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requireConfirmation: !!checked }))}
                        className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                      />
                      <div className="grid gap-1.5 font-normal">
                        <p className="text-sm leading-none font-medium">
                          Require Game Confirmation
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Both players must confirm game results
                        </p>
                      </div>
                    </Label>

                    <Label className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950">
                      <Checkbox
                        id="penaltiesEnabled"
                        checked={formData.penaltiesEnabled}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, penaltiesEnabled: !!checked }))}
                        className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                      />
                      <div className="grid gap-1.5 font-normal">
                        <p className="text-sm leading-none font-medium">
                          Enable Penalties
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Allow penalty points for rule violations
                        </p>
                      </div>
                    </Label>
                  </div>
                </div>

                {/* Tournament Settings Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2">
                    Tournament Settings
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tournamentFormat" className="text-sm font-medium">
                        Tournament Format
                      </Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between mt-1">
                            {formData.tournamentFormat === "round-robin" ? "Round Robin" : 
                             formData.tournamentFormat === "elimination" ? "Elimination" :
                             formData.tournamentFormat === "swiss" ? "Swiss" : "Custom"}
                            <span className="ml-2">▼</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-full">
                          <DropdownMenuItem onClick={() => setFormData(prev => ({ ...prev, tournamentFormat: "round-robin" }))}>
                            Round Robin
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFormData(prev => ({ ...prev, tournamentFormat: "elimination" }))}>
                            Elimination
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFormData(prev => ({ ...prev, tournamentFormat: "swiss" }))}>
                            Swiss
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFormData(prev => ({ ...prev, tournamentFormat: "custom" }))}>
                            Custom
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {formData.tournamentFormat !== "elimination" && (
                      <div>
                        <Label htmlFor="numberOfRounds" className="text-sm font-medium">
                          Number of Rounds
                        </Label>
                        <input
                          type="number"
                          id="numberOfRounds"
                          name="numberOfRounds"
                          value={formData.numberOfRounds}
                          onChange={handleNumberChange}
                          min="1"
                          max="20"
                          className="w-full p-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                        />
                      </div>
                    )}
                  </div>

                  <Label className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950">
                    <Checkbox
                      id="playoffsEnabled"
                      checked={formData.playoffsEnabled}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, playoffsEnabled: !!checked }))}
                      className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                    />
                    <div className="grid gap-1.5 font-normal">
                      <p className="text-sm leading-none font-medium">
                        Enable Playoffs
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Top teams advance to playoff rounds
                      </p>
                    </div>
                  </Label>

                  {formData.playoffsEnabled && (
                    <div>
                      <Label htmlFor="playoffTeams" className="text-sm font-medium">
                        Teams in Playoffs
                      </Label>
                      <input
                        type="number"
                        id="playoffTeams"
                        name="playoffTeams"
                        value={formData.playoffTeams}
                        onChange={handleNumberChange}
                        min="2"
                        max="16"
                        className="w-full p-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Number of teams that qualify for playoffs
                      </p>
                    </div>
                  )}
                </div>

                {/* Scoring System Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2">
                    League Scoring System
                  </h3>
                  
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      These are league points awarded for tournament standings, not domino game points.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="pointsPerWin" className="text-sm font-medium">
                        Points per Win
                      </Label>
                      <input
                        type="number"
                        id="pointsPerWin"
                        name="pointsPerWin"
                        value={formData.pointsPerWin}
                        onChange={handleNumberChange}
                        min="0"
                        max="10"
                        className="w-full p-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                      />
                    </div>

                    <div>
                      <Label htmlFor="pointsPerDraw" className="text-sm font-medium">
                        Points per Draw
                      </Label>
                      <input
                        type="number"
                        id="pointsPerDraw"
                        name="pointsPerDraw"
                        value={formData.pointsPerDraw}
                        onChange={handleNumberChange}
                        min="0"
                        max="5"
                        className="w-full p-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                      />
                    </div>

                    <div>
                      <Label htmlFor="pointsPerLoss" className="text-sm font-medium">
                        Points per Loss
                      </Label>
                      <input
                        type="number"
                        id="pointsPerLoss"
                        name="pointsPerLoss"
                        value={formData.pointsPerLoss}
                        onChange={handleNumberChange}
                        min="0"
                        max="2"
                        className="w-full p-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                      />
                    </div>
                  </div>

                  <Label className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950">
                    <Checkbox
                      id="usePointDifferential"
                      checked={formData.usePointDifferential}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, usePointDifferential: !!checked }))}
                      className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                    />
                    <div className="grid gap-1.5 font-normal">
                      <p className="text-sm leading-none font-medium">
                        Use Point Differential for Tiebreaker
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Consider the difference in game points when ranking teams
                      </p>
                    </div>
                  </Label>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    disabled={saving || configLoading}
                    className="w-full sm:w-auto"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4 sm:mt-6 w-full">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>
                League Members ({members.filter(m => m.status === "active").length} active, {members.length} total)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 dark:bg-red-900/20">
                  <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md mb-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Status Info:</strong> Active members can play games and appear in rankings. 
                  Inactive members remain in the league but cannot play games or appear in rankings.
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  <strong>Important:</strong> Points earned by other players from games against inactive/removed members are preserved. 
                  The ranking system includes all historical games for accurate statistics.
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Note: Inactive status should be used for temporary suspensions or breaks. Use "Remove" for permanent removal.
                </p>
              </div>

              {members.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No members in this league yet
                </div>
              ) : (
                <div className="w-full">
                  {/* Barra de búsqueda y contador */}
                  <div className="flex justify-between items-center mb-4">
                    <Input
                      placeholder="Search members..."
                      value={membersGlobalFilter ?? ""}
                      onChange={(event) => setMembersGlobalFilter(String(event.target.value))}
                      className="max-w-sm"
                    />
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      {membersTable.getRowModel().rows.length} of {members.length} members
                    </div>
                  </div>

                  {/* Table */}
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
                              data-state={row.getIsSelected() && "selected"}
                              className="hover:bg-gray-50 dark:hover:bg-zinc-700/50"
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

        <TabsContent value="requests" className="mt-4 sm:mt-6 w-full">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Join Requests ({joinRequests.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 dark:bg-red-900/20">
                  <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md mb-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>About Join Requests:</strong> Players can request to join this league if it's public and allows join requests. 
                  You can approve or reject pending requests from this section.
                </p>
              </div>

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
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="flex-1">
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
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          <button
                            onClick={() =>
                              handleJoinRequest(request.id, "approved")
                            }
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 text-center"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              handleJoinRequest(request.id, "rejected")
                            }
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 text-center"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={closeProfileModal}
        user={selectedUser}
      />
    </div>
  );
};

export default LeagueManagement;
