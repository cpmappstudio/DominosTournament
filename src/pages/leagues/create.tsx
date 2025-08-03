import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
  Timestamp,
  writeBatch,
  doc,
} from "firebase/firestore";
import { auth } from "../../firebase";
import { uploadLeagueImage, getAllSeasons, createSeason } from "../../firebase";
import { isJudge } from "../../utils/auth";
import { ExclamationCircleIcon, TrophyIcon, CalendarIcon } from "@heroicons/react/24/solid";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import { Calendar } from "../../components/ui/calendar";
import LeagueImageUploader from "../../components/LeagueImageUploader";
import { useGameConfig } from "../../config/gameConfig";
import type { GameMode, TournamentFormat, Season } from "../../models/league";
const CreateLeague: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { config: gameConfig, loading: configLoading } = useGameConfig();

  // League form data with better defaults and season support
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isPublic: true,
    gameMode: "double" as GameMode,
    pointsToWin: 150, // Will be updated from config
    maxPlayers: 16,
    allowJoinRequests: true,
    requireConfirmation: true,
    tournamentFormat: "round-robin" as TournamentFormat,
    numberOfRounds: 5,
    playoffsEnabled: true,
    playoffTeams: 4,
    penaltiesEnabled: true,
    timeLimit: 30,
    pointsPerWin: 3,
    pointsPerDraw: 1,
    pointsPerLoss: 0,
    usePointDifferential: true,
    ruleset: "standard", // Add ruleset selection
    // Season configuration
    selectedSeason: "", // ID de temporada global seleccionada
    createSeason: false, // Cambiar default a false
    seasonName: "",
    resetRankings: true,
    carryOverStats: false,
  });

  // Separate state for calendar dates
  const [seasonStartDate, setSeasonStartDate] = useState<Date | undefined>();
  const [seasonEndDate, setSeasonEndDate] = useState<Date | undefined>();
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  // Global seasons state
  const [globalSeasons, setGlobalSeasons] = useState<Season[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(false);

  // League image state
  const [leagueImage, setLeagueImage] = useState<File | null>(null);
  const [leagueImageUrl, setLeagueImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Update defaults when gameConfig loads - memoized for performance
  useEffect(() => {
    if (gameConfig) {
      const defaultGameMode = gameConfig.gameModes.find(mode => mode.isDefault)?.value || gameConfig.gameModes[0]?.value;
      const defaultPoints = gameConfig.pointsOptions.find(option => option.isDefault)?.value || gameConfig.pointsOptions[0]?.value;
      const defaultRuleset = gameConfig.rulesets.find(ruleset => ruleset.isDefault)?.value || gameConfig.rulesets[0]?.value;
      
      setFormData(prev => ({
        ...prev,
        gameMode: defaultGameMode as GameMode,
        pointsToWin: defaultPoints,
        ruleset: defaultRuleset,
        seasonName: `${new Date().getFullYear()} Season`
      }));
    }
  }, [gameConfig]);

  // Load global seasons
  useEffect(() => {
    const loadGlobalSeasons = async () => {
      setLoadingSeasons(true);
      try {
        // Get global seasons (leagueId = null means global)
        const seasons = await getAllSeasons(); // Sin leagueId para obtener temporadas globales
        setGlobalSeasons(seasons);
      } catch (error) {
        console.error("Error loading global seasons:", error);
      } finally {
        setLoadingSeasons(false);
      }
    };

    loadGlobalSeasons();
  }, []);

  // Optimized calendar click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.calendar-container')) {
        setShowStartCalendar(false);
        setShowEndCalendar(false);
      }
    };

    if (showStartCalendar || showEndCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showStartCalendar, showEndCalendar]);

  // Memoized form validation
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    
    if (!formData.name.trim()) {
      errors.push("League name is required");
    }
    if (!formData.description.trim()) {
      errors.push("Description is required");
    }
    
    // Season validation
    if (formData.createSeason) {
      if (!formData.seasonName.trim()) {
        errors.push("Season name is required");
      }
      if (!seasonStartDate) {
        errors.push("Season start date is required");
      }
      if (!seasonEndDate) {
        errors.push("Season end date is required");
      }
      
      if (seasonStartDate && seasonEndDate && seasonStartDate >= seasonEndDate) {
        errors.push("Season end date must be after start date");
      }
      
      if (seasonStartDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (seasonStartDate < today) {
          errors.push("Season start date cannot be in the past");
        }
      }
    } else if (formData.selectedSeason && !globalSeasons.find(s => s.id === formData.selectedSeason)) {
      errors.push("Selected season is not valid");
    }

    // Playoff teams validation
    if (formData.playoffsEnabled && formData.playoffTeams > formData.maxPlayers) {
      errors.push("Number of playoff teams cannot exceed maximum players");
    }

    // Game mode compatibility
    if (formData.gameMode === "double" && formData.maxPlayers % 4 !== 0) {
      errors.push("For double games, maximum players must be divisible by 4");
    }

    return errors;
  }, [formData, seasonStartDate, seasonEndDate]);

  // Check if current user is a judge - memoized
  const currentUserIsJudge = useMemo(() => {
    return auth.currentUser && isJudge(auth.currentUser);
  }, []);

  useEffect(() => {
    if (!auth.currentUser || !currentUserIsJudge) {
      navigate("/leagues");
    }
  }, [navigate, currentUserIsJudge]);
  // Optimized event handlers with useCallback
  const handleChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  }, []);

  const handleNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: parseInt(value) || 0 }));
  }, []);

  // Image handling functions
  const handleImageSelect = useCallback((file: File) => {
    setImageError(null);
    setLeagueImage(file);
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setLeagueImageUrl(previewUrl);
  }, []);

  const handleImageRemove = useCallback(() => {
    setLeagueImage(null);
    setLeagueImageUrl(null);
    setImageError(null);
  }, []);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Use pre-computed validation errors
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setLoading(true);

    // Firebase batch operation for atomicity
    const db = getFirestore();
    const batch = writeBatch(db);

    try {
      // Generate document references
      const leagueRef = doc(collection(db, "leagues"));
      const leagueId = leagueRef.id;

      // Upload league image if provided
      let uploadedImageUrl: string | null = null;
      if (leagueImage) {
        setImageUploading(true);
        try {
          uploadedImageUrl = await uploadLeagueImage(leagueImage, leagueId);
        } catch (imageError) {
          console.error("Error uploading league image:", imageError);
          setImageError(imageError instanceof Error ? imageError.message : "Failed to upload image");
          // Continue with league creation even if image upload fails
        } finally {
          setImageUploading(false);
        }
      }

      // Determine initial league status based on season dates
      const getInitialLeagueStatus = () => {
        const now = new Date();
        
        if (formData.createSeason && seasonStartDate && seasonEndDate) {
          // For new season creation
          if (seasonStartDate > now) {
            return "upcoming";
          } else if (seasonEndDate < now) {
            return "completed";
          } else {
            return "active";
          }
        } else if (formData.selectedSeason) {
          // For existing season selection
          const selectedSeasonData = globalSeasons.find(s => s.id === formData.selectedSeason);
          if (selectedSeasonData) {
            const startDate = selectedSeasonData.startDate.toDate();
            const endDate = selectedSeasonData.endDate.toDate();
            
            if (startDate > now) {
              return "upcoming";
            } else if (endDate < now) {
              return "completed";
            } else {
              return "active";
            }
          }
        }
        
        // Default to active if no season is associated
        return "active";
      };

      // Create league document with proper indexing and structure
      const leagueData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        createdBy: auth.currentUser?.uid || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: getInitialLeagueStatus(),
        isPublic: Boolean(formData.isPublic),
        photoURL: uploadedImageUrl || null,

        // Optimized settings structure for Firebase queries
        settings: {
          gameMode: formData.gameMode,
          pointsToWin: Number(formData.pointsToWin),
          maxPlayers: Number(formData.maxPlayers),
          allowJoinRequests: Boolean(formData.allowJoinRequests),
          requireConfirmation: Boolean(formData.requireConfirmation),
          ruleset: formData.ruleset,
          
          // Nested scoring system
          scoringSystem: {
            pointsPerWin: Number(formData.pointsPerWin),
            pointsPerDraw: Number(formData.pointsPerDraw),
            pointsPerLoss: Number(formData.pointsPerLoss),
            usePointDifferential: Boolean(formData.usePointDifferential),
          },
          
          // Tournament configuration
          tournament: {
            format: formData.tournamentFormat,
            numberOfRounds: Number(formData.numberOfRounds),
            playoffsEnabled: Boolean(formData.playoffsEnabled),
            playoffTeams: formData.playoffsEnabled ? Number(formData.playoffTeams) : null,
          },
          
          // Game rules
          rules: {
            timeLimit: formData.timeLimit > 0 ? Number(formData.timeLimit) : null,
            penaltiesEnabled: Boolean(formData.penaltiesEnabled),
          },
        },

        // Optimized statistics structure with proper indexing
        stats: {
          totalMembers: currentUserIsJudge ? 0 : 1,
          totalMatches: 0,
          totalMatchesCompleted: 0,
          activeMatches: 0,
          // Index-friendly date fields
          startDate: formData.createSeason && seasonStartDate ? 
            Timestamp.fromDate(seasonStartDate) : null,
          endDate: formData.createSeason && seasonEndDate ? 
            Timestamp.fromDate(seasonEndDate) : null,
        },

        // Additional fields for optimized queries
        searchTerms: [
          formData.name.toLowerCase(),
          ...formData.name.toLowerCase().split(' '),
          ...formData.description.toLowerCase().split(' ').slice(0, 5) // Limit for performance
        ].filter(term => term.length > 2), // Only meaningful terms
      };

      batch.set(leagueRef, leagueData);

      // Handle season association/creation
      let seasonId: string | null = null;
      
      if (formData.createSeason && seasonStartDate && seasonEndDate) {
        // Create new global season
        const seasonData = {
          name: formData.seasonName.trim(),
          description: `Global season: ${formData.seasonName.trim()}`,
          startDate: Timestamp.fromDate(seasonStartDate),
          endDate: Timestamp.fromDate(seasonEndDate),
          status: seasonStartDate > new Date() ? "upcoming" : "active",
          isDefault: false, // No auto-default for new seasons
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          leagueId: null, // Global season
          
          // Season settings
          settings: {
            resetRankings: Boolean(formData.resetRankings),
            carryOverStats: Boolean(formData.carryOverStats),
          },
          
          // Initialize season stats
          stats: {
            totalGames: 0,
            totalPlayers: 0,
            completedGames: 0,
          },
        };
        
        // Create the season first to get its ID
        const seasonRef = doc(collection(db, "seasons"));
        seasonId = seasonRef.id;
        batch.set(seasonRef, seasonData);
      } else if (formData.selectedSeason) {
        // Use existing global season
        seasonId = formData.selectedSeason;
      }

      // Create league-season association if we have a season
      if (seasonId) {
        const leagueSeasonRef = doc(collection(db, "leagueSeasons"));
        const leagueSeasonData = {
          leagueId: leagueId,
          seasonId: seasonId,
          joinedAt: serverTimestamp(),
          status: "active"
        };
        batch.set(leagueSeasonRef, leagueSeasonData);
      }

      // Add creator as league member (if not a judge)
      if (!currentUserIsJudge && auth.currentUser) {
        const membershipRef = doc(collection(db, "leagueMemberships"));
        const membershipData = {
          leagueId: leagueId,
          userId: auth.currentUser.uid,
          joinedAt: serverTimestamp(),
          status: "active",
          role: "owner",
          
          // Initialize member stats with proper structure
          stats: {
            gamesPlayed: 0,
            gamesWon: 0,
            totalPoints: 0,
            winRate: 0,
            rank: 1,
            currentStreak: 0,
            longestWinStreak: 0,
            maxWinStreak: 0,
            partnerIds: [],
          },
        };
        
        batch.set(membershipRef, membershipData);
      }

      // Execute all operations atomically
      await batch.commit();

      // Navigate to the new league page
      navigate(`/leagues/${leagueId}`);
    } catch (err) {
      console.error("Error creating league:", err);
      
      // Provide specific error messages based on Firebase error codes
      if (err instanceof Error) {
        if (err.message.includes('permission-denied')) {
          setError("You don't have permission to create leagues. Please contact an administrator.");
        } else if (err.message.includes('quota-exceeded')) {
          setError("Storage quota exceeded. Please try again later or contact support.");
        } else if (err.message.includes('network')) {
          setError("Network error. Please check your connection and try again.");
        } else {
          setError("Failed to create league. Please try again.");
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="p-4 sm:p-6 w-full max-w-6xl dark:text-white mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center">
        <TrophyIcon className="h-6 w-6 sm:h-8 sm:w-8 mr-2 text-blue-500" />
        Create New League
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error message with improved styling */}
        {(error || validationErrors.length > 0) && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 dark:bg-red-900/20 dark:border-red-500">
            <div className="flex items-start">
              <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                {error && <span className="text-red-700 dark:text-red-300 block">{error}</span>}
                {!error && validationErrors.length > 0 && (
                  <div className="space-y-1">
                    {validationErrors.map((err, index) => (
                      <span key={index} className="text-red-700 dark:text-red-300 block text-sm">
                        • {err}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Basic Information */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="border-b pb-2">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* League Image Upload */}
            <div>
              <Label className="text-sm font-medium mb-3 block">
                League Avatar/Logo
              </Label>
              <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                <LeagueImageUploader
                  currentImageUrl={leagueImageUrl}
                  onImageSelect={handleImageSelect}
                  onImageRemove={handleImageRemove}
                  uploading={imageUploading}
                  error={imageError}
                  size="lg"
                  className="flex-shrink-0"
                />
                
                <div className="flex-1 space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-1">
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
                      Description*
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={4}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3 pt-4 border-t border-gray-200 dark:border-zinc-700">
              <Checkbox 
                id="isPublic" 
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublic: !!checked }))}
              />
              <div className="grid gap-1.5 font-normal">
                <Label htmlFor="isPublic" className="text-sm font-medium">
                  Public League (visible to all users)
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formData.isPublic 
                    ? "Public: This league will appear in the leagues list and anyone can request to join" 
                    : "Private: This league will only be visible to members, the creator, and administrators. Access is by invitation only."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Season Configuration */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="border-b pb-2 flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2 text-green-500" />
              Season Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>About Seasons:</strong> Seasons are global and can be used across multiple leagues. 
                You can either select an existing season or create a new global season.
              </p>
            </div>

            {/* Select Existing Season */}
            <div>
              <Label htmlFor="selectedSeason" className="text-sm font-medium mb-2 block">
                Select Existing Season
              </Label>
              <select
                id="selectedSeason"
                name="selectedSeason"
                value={formData.selectedSeason}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ 
                    ...prev, 
                    selectedSeason: value,
                    createSeason: false // Deselect create when selecting existing
                  }));
                }}
                disabled={loadingSeasons || formData.createSeason}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600 disabled:bg-gray-100 disabled:cursor-not-allowed dark:disabled:bg-zinc-800"
              >
                <option value="">-- Select a season (optional) --</option>
                {globalSeasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name} ({season.status}) - {new Date(season.startDate.toDate()).toLocaleDateString()} to {new Date(season.endDate.toDate()).toLocaleDateString()}
                  </option>
                ))}
              </select>
              {loadingSeasons && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Loading seasons...</p>
              )}
              {!loadingSeasons && globalSeasons.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No global seasons found. Create one below.</p>
              )}
            </div>

            {/* OR Divider */}
            <div className="relative flex items-center justify-center my-6">
              <div className="border-t border-gray-300 dark:border-zinc-600 w-full"></div>
              <span className="bg-white dark:bg-zinc-800 px-3 text-sm text-gray-500 dark:text-gray-400">OR</span>
              <div className="border-t border-gray-300 dark:border-zinc-600 w-full"></div>
            </div>

            {/* Create New Season */}
            <div className="flex items-start gap-3">
              <Checkbox 
                id="createSeason" 
                checked={formData.createSeason}
                disabled={!!formData.selectedSeason}
                onCheckedChange={(checked) => setFormData(prev => ({ 
                  ...prev, 
                  createSeason: !!checked,
                  selectedSeason: checked ? "" : prev.selectedSeason // Clear selection when creating
                }))}
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="grid gap-1.5 font-normal">
                <Label htmlFor="createSeason" className="text-sm font-medium">
                  Create a new global season
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Create a new global season that can be used by multiple leagues
                </p>
              </div>
            </div>
            
            {formData.createSeason && (
              <div className="space-y-4 border-l-2 border-green-200 pl-4 ml-2">
                <div>
                  <Label htmlFor="seasonName" className="text-sm font-medium mb-1 block">
                    Season Name*
                  </Label>
                  <input
                    type="text"
                    id="seasonName"
                    name="seasonName"
                    value={formData.seasonName}
                    onChange={handleChange}
                    placeholder={`${new Date().getFullYear()} Season`}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-1 block">
                      Season Start Date*
                    </Label>
                    <div className="relative calendar-container">
                      <button
                        type="button"
                        onClick={() => setShowStartCalendar(!showStartCalendar)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600 text-left"
                      >
                        {seasonStartDate ? seasonStartDate.toLocaleDateString() : "Select start date"}
                      </button>
                      {showStartCalendar && (
                        <div className="absolute top-full left-0 z-10 mt-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-md shadow-lg">
                          <Calendar
                            mode="single"
                            selected={seasonStartDate}
                            onSelect={(date) => {
                              setSeasonStartDate(date);
                              setShowStartCalendar(false);
                            }}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            className="rounded-md border-0"
                            captionLayout="dropdown"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium mb-1 block">
                      Season End Date*
                    </Label>
                    <div className="relative calendar-container">
                      <button
                        type="button"
                        onClick={() => setShowEndCalendar(!showEndCalendar)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600 text-left"
                      >
                        {seasonEndDate ? seasonEndDate.toLocaleDateString() : "Select end date"}
                      </button>
                      {showEndCalendar && (
                        <div className="absolute top-full left-0 z-10 mt-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-md shadow-lg">
                          <Calendar
                            mode="single"
                            selected={seasonEndDate}
                            onSelect={(date) => {
                              setSeasonEndDate(date);
                              setShowEndCalendar(false);
                            }}
                            disabled={(date) => {
                              const minDate = seasonStartDate || new Date(new Date().setHours(0, 0, 0, 0));
                              return date <= minDate;
                            }}
                            className="rounded-md border-0"
                            captionLayout="dropdown"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      id="resetRankings" 
                      checked={formData.resetRankings}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, resetRankings: !!checked }))}
                    />
                    <Label htmlFor="resetRankings" className="text-sm">
                      Reset player rankings at season start
                    </Label>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      id="carryOverStats" 
                      checked={formData.carryOverStats}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, carryOverStats: !!checked }))}
                    />
                    <Label htmlFor="carryOverStats" className="text-sm">
                      Carry over statistics from previous seasons
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Game Settings */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="border-b pb-2">Game Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
                  disabled={configLoading}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                >
                  {gameConfig?.gameModes.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {gameConfig?.gameModes.find(mode => mode.value === formData.gameMode)?.description}
                </p>
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
                  disabled={configLoading}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                >
                  {gameConfig?.pointsOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {gameConfig?.pointsOptions.find(option => option.value === formData.pointsToWin)?.description}
                </p>
              </div>
              
              <div>
                <label
                  htmlFor="ruleset"
                  className="block text-sm font-medium mb-1"
                >
                  Ruleset
                </label>
                <select
                  id="ruleset"
                  name="ruleset"
                  value={formData.ruleset}
                  onChange={handleChange}
                  disabled={configLoading}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                >
                  {gameConfig?.rulesets.map((ruleset) => (
                    <option key={ruleset.value} value={ruleset.value}>
                      {ruleset.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {gameConfig?.rulesets.find(ruleset => ruleset.value === formData.ruleset)?.description}
                </p>
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
                  min={formData.gameMode === "double" ? "4" : "2"}
                  max="64"
                  step={formData.gameMode === "double" ? "4" : "1"}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {formData.gameMode === "double" 
                    ? "Must be divisible by 4 for team play (minimum 4)" 
                    : "Minimum 2 players for single mode"}
                </p>
              </div>
              
              <div>
                <label
                  htmlFor="timeLimit"
                  className="block text-sm font-medium mb-1"
                >
                  Time Limit per Game (minutes)
                </label>
                <input
                  type="number"
                  id="timeLimit"
                  name="timeLimit"
                  value={formData.timeLimit}
                  onChange={handleNumberChange}
                  min="0"
                  max="120"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {formData.timeLimit === 0 
                    ? "No time limit - games can run indefinitely" 
                    : `Games will be automatically forfeited after ${formData.timeLimit} minutes`}
                </p>
              </div>
            </div>
            
            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">League Settings</h4>
              <div className="space-y-4">
                <Label className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950">
                  <Checkbox 
                    id="allowJoinRequests" 
                    checked={formData.allowJoinRequests}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allowJoinRequests: !!checked }))}
                    className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                  />
                  <div className="grid gap-1.5 font-normal">
                    <p className="text-sm leading-none font-medium">
                      Allow players to request to join the league
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formData.allowJoinRequests 
                        ? "Players can send join requests that admins can approve/reject" 
                        : "Only invitations will be accepted - no public join requests"}
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
                      Require both players to confirm game results
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formData.requireConfirmation 
                        ? "Both players must agree on scores before results are final" 
                        : "Game creator's reported scores will be automatically accepted"}
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
                      Enable penalties for rule violations
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formData.penaltiesEnabled 
                        ? "Judges can assign penalties for tardiness, unsportsmanlike conduct, etc." 
                        : "No penalty system - violations handled manually"}
                    </p>
                  </div>
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Tournament Format */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="border-b pb-2">Tournament Format</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label
                  htmlFor="tournamentFormat"
                  className="block text-sm font-medium mb-1"
                >
                  Tournament Format
                </label>
                <select
                  id="tournamentFormat"
                  name="tournamentFormat"
                  value={formData.tournamentFormat}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                >
                  <option value="round-robin">
                    Round Robin (all players face each other)
                  </option>
                  <option value="elimination">
                    Elimination (single/double elimination)
                  </option>
                  <option value="swiss">Swiss System</option>
                  <option value="custom">Custom Format</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {formData.tournamentFormat === "round-robin" && "Each player/team plays against every other player/team"}
                  {formData.tournamentFormat === "elimination" && "Single or double elimination bracket tournament"}
                  {formData.tournamentFormat === "swiss" && "Players paired based on similar performance"}
                  {formData.tournamentFormat === "custom" && "Custom tournament structure defined by league admin"}
                </p>
              </div>
              
              {formData.tournamentFormat !== "elimination" && (
                <div>
                  <label
                    htmlFor="numberOfRounds"
                    className="block text-sm font-medium mb-1"
                  >
                    Number of Rounds
                  </label>
                  <input
                    type="number"
                    id="numberOfRounds"
                    name="numberOfRounds"
                    value={formData.numberOfRounds}
                    onChange={handleNumberChange}
                    min="1"
                    max="20"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formData.tournamentFormat === "round-robin" 
                      ? "For round-robin, this determines how many times each pair plays"
                      : "Total number of rounds in the tournament"}
                  </p>
                </div>
              )}
            </div>
            
            <div className="mt-6 space-y-4">
              <Label className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950">
                <Checkbox 
                  id="playoffsEnabled" 
                  checked={formData.playoffsEnabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, playoffsEnabled: !!checked }))}
                  className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                />
                <div className="grid gap-1.5 font-normal">
                  <p className="text-sm leading-none font-medium">
                    Enable playoffs (top teams advance to knockout stage)
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formData.playoffsEnabled 
                      ? "After regular season, top-ranked players/teams compete in elimination playoffs"
                      : "Tournament ends after regular season - winner determined by final standings"}
                  </p>
                </div>
              </Label>
              
              {formData.playoffsEnabled && (
                <div className="border-l-2 border-blue-200 pl-4 ml-2">
                  <div>
                    <Label className="text-sm font-medium mb-1 block">
                      Number of Players/Teams in Playoffs
                    </Label>
                    <select
                      id="playoffTeams"
                      name="playoffTeams"
                      value={formData.playoffTeams}
                      onChange={handleChange}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                    >
                      <option value="2">2 (Finals only)</option>
                      <option value="4">4 (Semifinals + Finals)</option>
                      <option value="8">8 (Quarterfinals + Semifinals + Finals)</option>
                      <option value="16">16 (Round of 16 + Quarterfinals + Semifinals + Finals)</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Must not exceed maximum players. Top {formData.playoffTeams} from regular season will advance.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        {/* Scoring System */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="border-b pb-2">Scoring System</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> These are league points awarded for tournament standings, 
                not the domino game points (which are set above as "Points to Win").
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div>
                <label
                  htmlFor="pointsPerWin"
                  className="block text-sm font-medium mb-1"
                >
                  League Points per Win
                </label>
                <input
                  type="number"
                  id="pointsPerWin"
                  name="pointsPerWin"
                  value={formData.pointsPerWin}
                  onChange={handleNumberChange}
                  min="0"
                  max="10"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Points awarded for winning a game (typically 3)
                </p>
              </div>
              
              <div>
                <label
                  htmlFor="pointsPerDraw"
                  className="block text-sm font-medium mb-1"
                >
                  League Points per Draw
                </label>
                <input
                  type="number"
                  id="pointsPerDraw"
                  name="pointsPerDraw"
                  value={formData.pointsPerDraw}
                  onChange={handleNumberChange}
                  min="0"
                  max="5"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Points for tied games (typically 1)
                </p>
              </div>
              
              <div>
                <label
                  htmlFor="pointsPerLoss"
                  className="block text-sm font-medium mb-1"
                >
                  League Points per Loss
                </label>
                <input
                  type="number"
                  id="pointsPerLoss"
                  name="pointsPerLoss"
                  value={formData.pointsPerLoss}
                  onChange={handleNumberChange}
                  min="0"
                  max="2"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Points for losing (typically 0)
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Tiebreaker Settings</h4>
              <Label className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950">
                <Checkbox 
                  id="usePointDifferential" 
                  checked={formData.usePointDifferential}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, usePointDifferential: !!checked }))}
                  className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                />
                <div className="grid gap-1.5 font-normal">
                  <p className="text-sm leading-none font-medium">
                    Use point differential for tiebreakers
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formData.usePointDifferential 
                      ? "Players with the same league points will be ranked by their total domino point difference (points scored - points allowed)"
                      : "Tiebreakers will use head-to-head record, then total games played"}
                  </p>
                </div>
              </Label>
              
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                <h5 className="text-sm font-medium mb-2">Scoring Preview:</h5>
                <div className="text-xs space-y-1">
                  <div>Win: <span className="font-mono">{formData.pointsPerWin} league points</span></div>
                  <div>Draw: <span className="font-mono">{formData.pointsPerDraw} league points</span></div>
                  <div>Loss: <span className="font-mono">{formData.pointsPerLoss} league points</span></div>
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <strong>Example:</strong> Player wins 5 games, draws 2, loses 3 = 
                    <span className="font-mono ml-1">
                      {(5 * formData.pointsPerWin) + (2 * formData.pointsPerDraw) + (3 * formData.pointsPerLoss)} league points
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Submit Button - improved accessibility and UX */}
        <div className="flex justify-end w-full">
          <button
            type="submit"
            disabled={loading || validationErrors.length > 0 || configLoading || imageUploading}
            className={`w-full sm:w-auto px-6 py-3 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              loading || validationErrors.length > 0 || configLoading || imageUploading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg transform hover:scale-105"
            }`}
            aria-disabled={loading || validationErrors.length > 0 || configLoading || imageUploading}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating League...
              </span>
            ) : imageUploading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading Image...
              </span>
            ) : configLoading ? (
              "Loading Configuration..."
            ) : (
              "Create League"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
export default CreateLeague;

