import React, { useState, useEffect } from "react";
import { auth, getUserProfile, UserProfile } from "../firebase";
import { CogIcon, UserIcon } from "@heroicons/react/24/solid";

const Settings: React.FC = () => {
  const [user, setUser] = useState(auth.currentUser);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "appearance" | "game">(
    "profile",
  );

  // Settings state
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    // Default to dark mode unless explicitly set to light
    return savedTheme !== "light";
  });
  const [gamePreferences, setGamePreferences] = useState({
    defaultGameMode: "teams",
    defaultPointsToWin: 100,
    useBoricuaRules: true,
    confirmationReminders: true,
  });

  // Fetch user profile data
  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
          if (profile) {
            setUsername(profile.username || profile.displayName || "");
          }
        } catch (error) {
          console.error("Error loading user profile:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [user]);

  // Handle theme changes - apply immediately when toggled
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }

    // Force reflow to ensure styles are applied immediately
    document.documentElement.style.transition = "background-color 0.3s ease";
  }, [darkMode]);

  // // Username is read-only and cannot be changed
  // const handleUsernameChange = () => {
  //   // No-op function as username changes are not allowed
  // };

  // Handle game preferences changes
  const handleGamePreferenceChange = (key: string, value: any) => {
    setGamePreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle saving profile changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    try {
      setSaving(true);

      // No username updates are allowed - usernames are permanent

      // Refresh profile data
      const updatedProfile = await getUserProfile(user.uid);
      setUserProfile(updatedProfile);

      // Show success feedback (could be a toast notification in a more complex app)
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setSaving(false);
    }
  };

  // Handle saving game preferences
  const handleSaveGamePreferences = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      // Save to local storage for now
      localStorage.setItem("gamePreferences", JSON.stringify(gamePreferences));

      // Show success feedback
      alert("Game preferences saved!");
    } catch (error) {
      console.error("Error saving game preferences:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Loading settings...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <p className="text-lg">Please sign in to access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-zinc-700 mb-6">
        <button
          className={`py-3 px-6 font-medium text-sm ${
            activeTab === "profile"
              ? "border-b-2 border-red-500 text-red-600 dark:text-red-400"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
          onClick={() => setActiveTab("profile")}
        >
          <UserIcon className="h-5 w-5 inline-block mr-2" />
          Profile
        </button>

        <button
          className={`py-3 px-6 font-medium text-sm ${
            activeTab === "game"
              ? "border-b-2 border-red-500 text-red-600 dark:text-red-400"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
          onClick={() => setActiveTab("game")}
        >
          <CogIcon className="h-5 w-5 inline-block mr-2" />
          Game Preferences
        </button>
      </div>

      {/* Profile Settings */}
      {activeTab === "profile" && (
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Profile Settings</h2>

          <form onSubmit={handleSaveProfile}>
            <div className="mb-4">
              <label
                htmlFor="username"
                className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300"
              >
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                disabled
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700
                  dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                placeholder="Your username"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Usernames are permanent and cannot be changed after registration
              </p>
            </div>

            <div className="mb-4">
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                value={user.email || ""}
                disabled
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500
                  dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                placeholder="Your email"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Your email is managed through your Google account
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`px-4 py-2 rounded-md font-medium ${
                saving
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>
      )}

      {/* Appearance Settings */}
      {activeTab === "appearance" && (
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Appearance Settings</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-4 text-zinc-700 dark:text-zinc-300">
              Theme
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                className={`p-4 border rounded-lg cursor-pointer ${
                  !darkMode
                    ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                    : "border-gray-300 dark:border-zinc-600"
                }`}
                onClick={() => setDarkMode(false)}
              >
                <div className="flex items-start">
                  <input
                    type="radio"
                    name="theme"
                    checked={!darkMode}
                    onChange={() => {}}
                    className="h-4 w-4 mt-1 text-blue-600"
                  />
                  <div className="ml-3">
                    <span className="block font-medium">Light Mode</span>
                    <span className="block text-sm text-gray-500 dark:text-zinc-400">
                      Bright background with dark text
                    </span>
                  </div>
                </div>
              </div>

              <div
                className={`p-4 border rounded-lg cursor-pointer ${
                  darkMode
                    ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                    : "border-gray-300 dark:border-zinc-600"
                }`}
                onClick={() => setDarkMode(true)}
              >
                <div className="flex items-start">
                  <input
                    type="radio"
                    name="theme"
                    checked={darkMode}
                    onChange={() => {}}
                    className="h-4 w-4 mt-1 text-blue-600"
                  />
                  <div className="ml-3">
                    <span className="block font-medium">Dark Mode</span>
                    <span className="block text-sm text-gray-500 dark:text-zinc-400">
                      Dark background with light text
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Preferences */}
      {activeTab === "game" && (
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Game Preferences</h2>

          <form onSubmit={handleSaveGamePreferences}>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                Default Game Mode
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="defaultGameMode"
                    value="individual"
                    checked={gamePreferences.defaultGameMode === "individual"}
                    onChange={() =>
                      handleGamePreferenceChange(
                        "defaultGameMode",
                        "individual",
                      )
                    }
                    className="h-4 w-4 text-blue-600"
                  />
                  <span>Individual (each player plays solo)</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="defaultGameMode"
                    value="teams"
                    checked={gamePreferences.defaultGameMode === "teams"}
                    onChange={() =>
                      handleGamePreferenceChange("defaultGameMode", "teams")
                    }
                    className="h-4 w-4 text-blue-600"
                  />
                  <span>Teams (2 vs 2) - Traditional Puerto Rican format</span>
                </label>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                Default Points to Win
              </label>
              <select
                name="defaultPointsToWin"
                value={gamePreferences.defaultPointsToWin}
                onChange={(e) =>
                  handleGamePreferenceChange(
                    "defaultPointsToWin",
                    parseInt(e.target.value),
                  )
                }
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
              >
                <option value={100}>100 points (short game)</option>
                <option value={150}>150 points (standard match)</option>
                <option value={200}>200 points (formal match)</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={gamePreferences.useBoricuaRules}
                  onChange={(e) =>
                    handleGamePreferenceChange(
                      "useBoricuaRules",
                      e.target.checked,
                    )
                  }
                  className="h-4 w-4 text-blue-600"
                />
                <span className="text-sm font-medium">
                  Use Boricua (Puerto Rican) Rules by default
                </span>
              </label>
            </div>

            <div className="mb-6">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={gamePreferences.confirmationReminders}
                  onChange={(e) =>
                    handleGamePreferenceChange(
                      "confirmationReminders",
                      e.target.checked,
                    )
                  }
                  className="h-4 w-4 text-blue-600"
                />
                <span className="text-sm font-medium">
                  Send reminders for game confirmations
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`px-4 py-2 rounded-md font-medium ${
                saving
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              {saving ? "Saving..." : "Save Preferences"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Settings;
