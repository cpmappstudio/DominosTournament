import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
} from "firebase/firestore";
import { auth } from "../../firebase";
import { isJudge } from "../../utils/auth";
import { ExclamationCircleIcon, TrophyIcon } from "@heroicons/react/24/solid";
import type { GameMode, TournamentFormat } from "../../models/league";
const CreateLeague: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // League form data
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isPublic: true,
    gameMode: "teams" as GameMode,
    pointsToWin: 100,
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
  });
  // Check if current user is a judge
  useEffect(() => {
    if (!auth.currentUser || !isJudge(auth.currentUser)) {
      navigate("/leagues");
    }
  }, [navigate]);
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Validate form
    if (!formData.name.trim()) {
      setError("League name is required");
      return;
    }
    if (!formData.description.trim()) {
      setError("Description is required");
      return;
    }
    setLoading(true);
    try {
      const db = getFirestore();
      const leaguesRef = collection(db, "leagues");
      // Create league document
      const leagueData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        createdBy: auth.currentUser?.uid || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "upcoming",
        isPublic: Boolean(formData.isPublic),
        photoURL: null, // Placeholder for future feature
        // League settings
        settings: {
          gameMode: formData.gameMode || "teams",
          pointsToWin: Number(formData.pointsToWin) || 100,
          maxPlayers: Number(formData.maxPlayers) || 16,
          allowJoinRequests: Boolean(formData.allowJoinRequests),
          requireConfirmation: Boolean(formData.requireConfirmation),
          // Scoring settings
          scoringSystem: {
            pointsPerWin: Number(formData.pointsPerWin) || 3,
            pointsPerDraw: Number(formData.pointsPerDraw) || 1,
            pointsPerLoss: Number(formData.pointsPerLoss) || 0,
            usePointDifferential: Boolean(formData.usePointDifferential),
          },
          // Tournament settings
          tournamentFormat: formData.tournamentFormat || "round-robin",
          numberOfRounds: Number(formData.numberOfRounds) || 5,
          playoffsEnabled: Boolean(formData.playoffsEnabled),
          playoffTeams: Number(formData.playoffTeams) || 4,
          // Rules and penalties
          timeLimit: Number(formData.timeLimit) || 30,
          penaltiesEnabled: Boolean(formData.penaltiesEnabled),
        },
        // Statistics
        stats: {
          totalMembers: 1, // Starting with the creator
          totalMatches: 0,
          totalMatchesCompleted: 0,
          activeMatches: 0,
          startDate: null,
          endDate: null,
        },
      };
      const docRef = await addDoc(leaguesRef, leagueData);
      // Automatically make the creator a member with admin role
      const membershipsRef = collection(db, "leagueMemberships");
      await addDoc(membershipsRef, {
        leagueId: docRef.id,
        userId: auth.currentUser?.uid || "",
        joinedAt: serverTimestamp(),
        status: "active",
        role: "owner",
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          totalPoints: 0,
          winRate: 0,
          rank: 1, // First member is rank 1
          currentStreak: 0,
          longestWinStreak: 0,
          maxWinStreak: 0,
          partnerIds: [],
        },
      });
      // Redirect to the new league page
      navigate(`/leagues/${docRef.id}`);
    } catch (err) {
      console.error("Error creating league:", err);
      setError("Failed to create league. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="p-6 max-w-4xl text-white mx-auto">
      <h1 className="text-3xl font-bold mb-6 flex items-center">
        <TrophyIcon className="h-8 w-8 mr-2 text-blue-500" />
        Create New League
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 dark:bg-red-900/20 dark:border-red-500">
            <div className="flex items-start">
              <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
          </div>
        )}
        {/* Basic Information */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">
            Basic Information
          </h2>
          <div className="space-y-4">
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
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                required
              />
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
        </div>
        {/* Game Settings */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">
            Game Settings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Teams is the traditional Puerto Rican format (2 vs 2)
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
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter 0 for no time limit
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
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
            <label className="flex items-center">
              <input
                type="checkbox"
                name="penaltiesEnabled"
                checked={formData.penaltiesEnabled}
                onChange={handleCheckboxChange}
                className="h-4 w-4 text-blue-600"
              />
              <span className="ml-2 text-sm">
                Enable penalties for rule violations
              </span>
            </label>
          </div>
        </div>
        {/* Tournament Format */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">
            Tournament Format
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </div>
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
            </div>
            <div className="col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="playoffsEnabled"
                  checked={formData.playoffsEnabled}
                  onChange={handleCheckboxChange}
                  className="h-4 w-4 text-blue-600"
                />
                <span className="ml-2 text-sm">
                  Enable playoffs (top teams advance to knockout stage)
                </span>
              </label>
            </div>
            {formData.playoffsEnabled && (
              <div>
                <label
                  htmlFor="playoffTeams"
                  className="block text-sm font-medium mb-1"
                >
                  Number of Teams in Playoffs
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
        {/* Scoring System */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">
            Scoring System
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label
                htmlFor="pointsPerWin"
                className="block text-sm font-medium mb-1"
              >
                Points per Win
              </label>
              <input
                type="number"
                id="pointsPerWin"
                name="pointsPerWin"
                value={formData.pointsPerWin}
                onChange={handleNumberChange}
                min="0"
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
              />
            </div>
            <div>
              <label
                htmlFor="pointsPerDraw"
                className="block text-sm font-medium mb-1"
              >
                Points per Draw
              </label>
              <input
                type="number"
                id="pointsPerDraw"
                name="pointsPerDraw"
                value={formData.pointsPerDraw}
                onChange={handleNumberChange}
                min="0"
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
              />
            </div>
            <div>
              <label
                htmlFor="pointsPerLoss"
                className="block text-sm font-medium mb-1"
              >
                Points per Loss
              </label>
              <input
                type="number"
                id="pointsPerLoss"
                name="pointsPerLoss"
                value={formData.pointsPerLoss}
                onChange={handleNumberChange}
                min="0"
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
              />
            </div>
          </div>
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="usePointDifferential"
                checked={formData.usePointDifferential}
                onChange={handleCheckboxChange}
                className="h-4 w-4 text-blue-600"
              />
              <span className="ml-2 text-sm">
                Use point differential for tiebreakers
              </span>
            </label>
            <p className="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">
              If enabled, players with the same number of wins will be ranked by
              point difference
            </p>
          </div>
        </div>
        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-3 rounded-md font-medium ${
              loading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {loading ? "Creating League..." : "Create League"}
          </button>
        </div>
      </form>
    </div>
  );
};
export default CreateLeague;

