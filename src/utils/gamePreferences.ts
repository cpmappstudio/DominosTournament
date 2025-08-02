import { getGameConfig, validateGameMode, validatePoints, validateRuleset, getDefaultGameMode, getDefaultPoints, getDefaultRuleset } from "../config/gameConfig";

// Dynamic game preferences interface
export interface GamePreferences {
  defaultGameMode: string; // Now dynamic, not hardcoded
  defaultPointsToWin: number;
  defaultRuleset: string; // Replaces useBoricuaRules with dynamic ruleset
  confirmationReminders: boolean;
  // Version for migration purposes
  version?: string;
}

const STORAGE_KEY = "gamePreferences";
const CURRENT_VERSION = "2.0.0";

/**
 * Save game preferences with validation
 */
export async function saveGamePreferences(prefs: GamePreferences): Promise<void> {
  try {
    // Validate preferences against current game config
    const isValidGameMode = await validateGameMode(prefs.defaultGameMode);
    const isValidPoints = await validatePoints(prefs.defaultPointsToWin);
    const isValidRuleset = await validateRuleset(prefs.defaultRuleset);

    if (!isValidGameMode) {
      console.warn(`Invalid game mode: ${prefs.defaultGameMode}, using default`);
      prefs.defaultGameMode = await getDefaultGameMode();
    }

    if (!isValidPoints) {
      console.warn(`Invalid points: ${prefs.defaultPointsToWin}, using default`);
      prefs.defaultPointsToWin = await getDefaultPoints();
    }

    if (!isValidRuleset) {
      console.warn(`Invalid ruleset: ${prefs.defaultRuleset}, using default`);
      prefs.defaultRuleset = await getDefaultRuleset();
    }

    // Add version for future migrations
    const prefsWithVersion = {
      ...prefs,
      version: CURRENT_VERSION
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefsWithVersion));
  } catch (error) {
    console.error("Error saving game preferences:", error);
    throw new Error("Failed to save game preferences");
  }
}

/**
 * Load game preferences with migration support
 */
export async function getGamePreferences(): Promise<GamePreferences> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    
    if (!raw) {
      // Return default preferences based on current game config
      return await getDefaultPreferences();
    }

    const stored = JSON.parse(raw);
    
    // Migrate old preferences if needed
    const migrated = await migratePreferences(stored);
    
    // Validate migrated preferences
    const validated = await validatePreferences(migrated);
    
    return validated;
  } catch (error) {
    console.error("Error loading game preferences:", error);
    return await getDefaultPreferences();
  }
}

/**
 * Get default preferences based on current game config
 */
async function getDefaultPreferences(): Promise<GamePreferences> {
  try {
    return {
      defaultGameMode: await getDefaultGameMode(),
      defaultPointsToWin: await getDefaultPoints(),
      defaultRuleset: await getDefaultRuleset(),
      confirmationReminders: true,
      version: CURRENT_VERSION
    };
  } catch (error) {
    console.error("Error getting default preferences:", error);
    // Fallback to hardcoded defaults
    return {
      defaultGameMode: "double",
      defaultPointsToWin: 150,
      defaultRuleset: "boricua",
      confirmationReminders: true,
      version: CURRENT_VERSION
    };
  }
}

/**
 * Migrate preferences from older versions
 */
async function migratePreferences(stored: any): Promise<GamePreferences> {
  // Handle migration from v1 (with useBoricuaRules) to v2 (with defaultRuleset)
  if (!stored.version || stored.version < "2.0.0") {
    const migrated: GamePreferences = {
      defaultGameMode: stored.defaultGameMode || "double",
      defaultPointsToWin: stored.defaultPointsToWin || 150,
      defaultRuleset: stored.useBoricuaRules ? "boricua" : "standard",
      confirmationReminders: stored.confirmationReminders ?? true,
      version: CURRENT_VERSION
    };

    console.log("Migrated preferences from v1 to v2:", migrated);
    return migrated;
  }

  return stored;
}

/**
 * Validate preferences against current game config
 */
async function validatePreferences(prefs: GamePreferences): Promise<GamePreferences> {
  try {
    const config = await getGameConfig();
    
    // Validate game mode
    if (!config.gameModes.some(mode => mode.value === prefs.defaultGameMode)) {
      prefs.defaultGameMode = await getDefaultGameMode();
    }

    // Validate points
    if (!config.pointsOptions.some(option => option.value === prefs.defaultPointsToWin)) {
      prefs.defaultPointsToWin = await getDefaultPoints();
    }

    // Validate ruleset
    if (!config.rulesets.some(ruleset => ruleset.value === prefs.defaultRuleset)) {
      prefs.defaultRuleset = await getDefaultRuleset();
    }

    return prefs;
  } catch (error) {
    console.error("Error validating preferences:", error);
    return prefs; // Return as-is if validation fails
  }
}

/**
 * Reset preferences to defaults based on current config
 */
export async function resetGamePreferences(): Promise<GamePreferences> {
  const defaults = await getDefaultPreferences();
  await saveGamePreferences(defaults);
  return defaults;
}

/**
 * Check if current preferences are compatible with current game config
 */
export async function arePreferencesValid(prefs: GamePreferences): Promise<boolean> {
  try {
    const isValidGameMode = await validateGameMode(prefs.defaultGameMode);
    const isValidPoints = await validatePoints(prefs.defaultPointsToWin);
    const isValidRuleset = await validateRuleset(prefs.defaultRuleset);
    
    return isValidGameMode && isValidPoints && isValidRuleset;
  } catch {
    return false;
  }
}

// Legacy support for components that still expect the old boolean useBoricuaRules
export function legacyGetUseBoricuaRules(prefs: GamePreferences): boolean {
  return prefs.defaultRuleset === "boricua";
}
