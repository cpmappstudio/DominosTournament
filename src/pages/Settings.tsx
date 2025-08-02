import React, { useState, useEffect, useCallback, useMemo, memo, Suspense } from "react";
import { saveGamePreferences, getGamePreferences, GamePreferences, arePreferencesValid, resetGamePreferences } from "../utils/gamePreferences";
import { auth, getUserProfile, UserProfile } from "../firebase";
import { CogIcon, UserIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
// import { EyeIcon } from "@heroicons/react/24/outline";
import { ModeToggle } from "@/components/mode-toggle";
import { useGameConfig } from "../config/gameConfig";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";

// Skeleton Loading Component
const SettingsSkeleton = memo(() => (
  <div className="p-2 sm:p-4 lg:p-6 w-full lg:max-w-6xl lg:mx-auto">
    <div className="h-8 bg-gray-200 dark:bg-zinc-700 rounded-md w-32 mb-6 animate-pulse"></div>
    
    <div className="flex border-b border-gray-200 dark:border-zinc-700 mb-6">
      <div className="h-10 bg-gray-200 dark:bg-zinc-700 rounded-md w-40 animate-pulse"></div>
    </div>
    
    <Card>
      <CardHeader>
        <div className="h-6 bg-gray-200 dark:bg-zinc-700 rounded-md w-48 animate-pulse"></div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded-md w-24 mb-2 animate-pulse"></div>
            <div className="h-10 bg-gray-200 dark:bg-zinc-700 rounded-md w-32 animate-pulse"></div>
          </div>
          
          <div>
            <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded-md w-36 mb-2 animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-6 bg-gray-200 dark:bg-zinc-700 rounded-md w-64 animate-pulse"></div>
              <div className="h-6 bg-gray-200 dark:bg-zinc-700 rounded-md w-80 animate-pulse"></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
));

// Success Alert Component
const SuccessAlert = memo(({ show }: { show: boolean }) => {
  if (!show) return null;
  
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-blue-600 text-white px-4 py-2 rounded shadow text-sm font-medium transition-all duration-300">
        Preferences updated successfully
      </div>
    </div>
  );
});

// Config Incompatibility Warning
const ConfigIncompatibilityWarning = memo(({ 
  show, 
  onReset 
}: { 
  show: boolean; 
  onReset: () => void;
}) => {
  if (!show) return null;
  
  return (
    <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Configuration Update Available
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            Your current preferences may be incompatible with the latest game configuration. 
            Some options may no longer be available.
          </p>
          <button
            onClick={onReset}
            className="mt-2 text-sm font-medium text-yellow-800 dark:text-yellow-200 underline hover:no-underline"
          >
            Reset to current defaults
          </button>
        </div>
      </div>
    </div>
  );
});

// Game Mode Radio Component
const GameModeRadio = memo(({ 
  value, 
  checked, 
  onChange, 
  label,
  description 
}: {
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
}) => (
  <label className="flex items-center space-x-3">
    <input
      type="radio"
      name="defaultGameMode"
      value={value}
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 text-blue-600"
    />
    <div>
      <span>{label}</span>
      {description && (
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
          ({description})
        </span>
      )}
    </div>
  </label>
));

// Points Select Component
const PointsSelect = memo(({ 
  value, 
  onChange,
  options 
}: { 
  value: number; 
  onChange: (value: number) => void;
  options: Array<{ value: number; label: string; description?: string; }>;
}) => (
  <select
    name="defaultPointsToWin"
    value={value}
    onChange={(e) => onChange(parseInt(e.target.value))}
    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label} {option.description && `(${option.description})`}
      </option>
    ))}
  </select>
));

// Ruleset Select Component
const RulesetSelect = memo(({ 
  value, 
  onChange,
  options 
}: { 
  value: string; 
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; description?: string; }>;
}) => (
  <select
    name="defaultRuleset"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label} {option.description && `- ${option.description}`}
      </option>
    ))}
  </select>
));

// Checkbox Component
const SettingsCheckbox = memo(({ 
  checked, 
  onChange, 
  label 
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) => (
  <label className="flex items-center space-x-2">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 text-blue-600"
    />
    <span className="text-sm font-medium">{label}</span>
  </label>
));

const Settings: React.FC = () => {
  const [showPrefsAlert, setShowPrefsAlert] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "appearance" | "game">("game");
  const [error, setError] = useState<string | null>(null);
  const [configIncompatible, setConfigIncompatible] = useState(false);

  // Settings state
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Game config and preferences
  const { config: gameConfig, loading: configLoading, error: configError, refreshConfig } = useGameConfig();
  const [gamePreferences, setGamePreferences] = useState<GamePreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(true);

  // Load game preferences asynchronously
  const loadGamePreferences = useCallback(async () => {
    try {
      setPreferencesLoading(true);
      const prefs = await getGamePreferences();
      setGamePreferences(prefs);
      
      // Check if current preferences are compatible with current config
      const isValid = await arePreferencesValid(prefs);
      setConfigIncompatible(!isValid);
      
      if (!isValid) {
        console.warn("Game preferences are incompatible with current config");
      }
    } catch (error) {
      console.error("Error loading game preferences:", error);
      setError("Failed to load game preferences");
    } finally {
      setPreferencesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGamePreferences();
  }, [loadGamePreferences]);

  // Memoized callbacks to prevent unnecessary re-renders
  const handleGamePreferenceChange = useCallback(async (key: string, value: any) => {
    if (!gamePreferences) return;

    const updated = { ...gamePreferences, [key]: value };
    setGamePreferences(updated);
    
    try {
      await saveGamePreferences(updated);
      setShowPrefsAlert(true);
      setTimeout(() => setShowPrefsAlert(false), 1800);
      setError(null);
      setConfigIncompatible(false);
    } catch (err) {
      console.error("Error saving preferences:", err);
      setError("Failed to save preferences. Please try again.");
    }
  }, [gamePreferences]);

  const handleSaveGamePreferences = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gamePreferences) return;

    try {
      setSaving(true);
      setError(null);
      await saveGamePreferences(gamePreferences);
      setShowPrefsAlert(true);
      setTimeout(() => setShowPrefsAlert(false), 1800);
    } catch (error) {
      console.error("Error saving game preferences:", error);
      setError("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [gamePreferences]);

  const handleResetPreferences = useCallback(async () => {
    try {
      setSaving(true);
      const defaultPrefs = await resetGamePreferences();
      setGamePreferences(defaultPrefs);
      setConfigIncompatible(false);
      setShowPrefsAlert(true);
      setTimeout(() => setShowPrefsAlert(false), 1800);
    } catch (error) {
      console.error("Error resetting preferences:", error);
      setError("Failed to reset preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  }, []);

  // Memoized profile loading
  const loadUserProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const profile = await getUserProfile(user.uid);
      setUserProfile(profile);
      if (profile) {
        setUsername(profile.username || profile.displayName || "");
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
      setError("Failed to load profile. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch user profile data
  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  // Memoized loading component
  const LoadingComponent = useMemo(() => (
    <SettingsSkeleton />
  ), []);

  // Memoized error component
  const ErrorComponent = useMemo(() => {
    if (!error) return null;
    return (
      <div className="p-2 sm:p-4 lg:p-6 w-full lg:max-w-6xl lg:mx-auto">
        <h1 className="sr-only">Settings</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button 
                onClick={() => {
                  setError(null);
                  loadUserProfile();
                }}
                className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }, [error, loadUserProfile]);

  // Memoized unauthenticated component
  const UnauthenticatedComponent = useMemo(() => (
    <div className="p-2 sm:p-4 lg:p-6 w-full lg:max-w-6xl lg:mx-auto text-center">
      <h1 className="sr-only">Settings</h1>
      <Card>
        <CardContent className="pt-6">
          <p className="text-lg">Please sign in to access settings.</p>
        </CardContent>
      </Card>
    </div>
  ), []);

  if (loading) {
    return LoadingComponent;
  }

  if (error) {
    return ErrorComponent;
  }

  if (!user) {
    return UnauthenticatedComponent;
  }

  return (
    <div className="p-2 sm:p-4 lg:p-6 w-full lg:max-w-6xl lg:mx-auto">
      <h1 className="sr-only">Settings</h1>
      
      <Tabs defaultValue="game" value={activeTab} onValueChange={(value) => setActiveTab(value as "profile" | "appearance" | "game")}>
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="game" className="flex items-center gap-2">
            <CogIcon className="h-4 w-4" />
            Game Preferences
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="game" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">Game Preferences</CardTitle>
            </CardHeader>
            <CardContent>

          {configIncompatible && (
            <ConfigIncompatibilityWarning 
              show={configIncompatible} 
              onReset={handleResetPreferences}
            />
          )}

          {(configLoading || preferencesLoading) ? (
            <div className="space-y-6">
              <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-24 animate-pulse"></div>
              <div className="h-10 bg-gray-200 dark:bg-zinc-700 rounded w-32 animate-pulse"></div>
            </div>
          ) : gameConfig && gamePreferences ? (
            <form onSubmit={handleSaveGamePreferences}>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-4 text-zinc-700 dark:text-zinc-300">
                  Theme
                </label>
                <div className="mb-4">
                  <Suspense fallback={<div className="h-10 w-20 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse"></div>}>
                    <ModeToggle />
                  </Suspense>
                </div>

                <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                  Default Game Mode
                </label>
                <div className="space-y-2">
                  {gameConfig.gameModes
                    .filter(mode => !mode.deprecated)
                    .map((mode) => (
                      <GameModeRadio
                        key={mode.value}
                        value={mode.value}
                        checked={gamePreferences.defaultGameMode === mode.value}
                        onChange={() => handleGamePreferenceChange("defaultGameMode", mode.value)}
                        label={mode.label}
                        description={mode.description}
                      />
                    ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                  Default Points to Win
                </label>
                <PointsSelect
                  value={gamePreferences.defaultPointsToWin}
                  onChange={(points) => handleGamePreferenceChange("defaultPointsToWin", points)}
                  options={gameConfig.pointsOptions.filter(option => !option.deprecated)}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                  Default Ruleset
                </label>
                <RulesetSelect
                  value={gamePreferences.defaultRuleset}
                  onChange={(ruleset) => handleGamePreferenceChange("defaultRuleset", ruleset)}
                  options={gameConfig.rulesets.filter(ruleset => !ruleset.deprecated)}
                />
              </div>

              {configError && (
                <div className="mb-4 text-sm text-red-600 dark:text-red-400">
                  Warning: Using cached configuration. Some options may be outdated.
                  <button 
                    type="button"
                    onClick={refreshConfig}
                    className="ml-2 underline hover:no-underline"
                  >
                    Refresh
                  </button>
                </div>
              )}

              <SuccessAlert show={showPrefsAlert} />
            </form>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400">
              Unable to load game configuration. Please try refreshing the page.
            </div>
          )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Memoize the entire component for better performance
const MemoizedSettings = memo(Settings);

export default MemoizedSettings;
