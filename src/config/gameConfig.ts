/**
 * Game Configuration System
 * Centralized configuration for all game-related settings
 * Allows for dynamic changes without code modifications
 */

// Core configuration types
export interface GameModeOption {
  value: string;
  label: string;
  description?: string;
  isDefault?: boolean;
  deprecated?: boolean;
  migrateTo?: string; // For handling config changes
}

export interface PointsOption {
  value: number;
  label: string;
  description?: string;
  isDefault?: boolean;
  deprecated?: boolean;
}

export interface RulesetOption {
  value: string;
  label: string;
  description?: string;
  isDefault?: boolean;
  deprecated?: boolean;
}

export interface StartingPlayerOption {
  value: string;
  label: string;
  description?: string;
  isDefault?: boolean;
  deprecated?: boolean;
}

export interface TimeLimitOption {
  value: number; // in minutes, 0 = no limit
  label: string;
  description?: string;
  isDefault?: boolean;
  deprecated?: boolean;
}

export interface NumberOfPlayersOption {
  value: number;
  label: string;
  description?: string;
  isDefault?: boolean;
  deprecated?: boolean;
  requiredGameModes?: string[]; // Which game modes support this
}

export interface GameConfigurationSchema {
  version: string; // For migration purposes
  lastUpdated: string;
  gameModes: GameModeOption[];
  pointsOptions: PointsOption[];
  rulesets: RulesetOption[];
  // Extended configuration options
  startingPlayerOptions: StartingPlayerOption[];
  timeLimitOptions: TimeLimitOption[];
  numberOfPlayersOptions: NumberOfPlayersOption[];
  // Future extensions can be added here
  features?: {
    enableTimeouts?: boolean;
    allowSpectators?: boolean;
    enableChat?: boolean;
    maxPlayersPerGame?: number;
    enablePenalties?: boolean;
    allowDraws?: boolean;
    enableConfirmation?: boolean;
  };
}

// Default game configuration
export const DEFAULT_GAME_CONFIG: GameConfigurationSchema = {
  version: "1.0.0",
  lastUpdated: new Date().toISOString(),
  gameModes: [
    {
      value: "single",
      label: "Single",
      description: "each player plays solo",
      isDefault: true
    },
    {
      value: "double",
      label: "Double", 
      description: "2 vs 2 - Traditional Puerto Rican format",
      isDefault: false
    }
  ],
  pointsOptions: [
    {
      value: 100,
      label: "100 points",
      description: "short game",
      isDefault: false
    },
    {
      value: 150,
      label: "150 points", 
      description: "standard match",
      isDefault: true
    },
    {
      value: 200,
      label: "200 points",
      description: "formal match", 
      isDefault: false
    }
  ],
  rulesets: [
    {
      value: "standard",
      label: "Standard Rules",
      description: "International domino rules",
      isDefault: true
    },
    {
      value: "boricua",
      label: "Boricua Rules",
      description: "Puerto Rican traditional rules",
      isDefault: false
    }
  ],
  startingPlayerOptions: [
    {
      value: "creator",
      label: "Game Creator",
      description: "Creator always starts first",
      isDefault: true
    },
    {
      value: "opponent",
      label: "Opponent",
      description: "Opponent always starts first",
      isDefault: false
    },
    {
      value: "random",
      label: "Random Selection",
      description: "Starting player chosen randomly",
      isDefault: false
    },
    {
      value: "winner_previous",
      label: "Previous Game Winner",
      description: "Winner of previous game starts (for series)",
      isDefault: false
    },
    {
      value: "highest_double",
      label: "Highest Double",
      description: "Player with highest double starts (traditional)",
      isDefault: false
    }
  ],
  timeLimitOptions: [
    {
      value: 0,
      label: "No Time Limit",
      description: "Games can run indefinitely",
      isDefault: true
    },
    {
      value: 15,
      label: "15 minutes",
      description: "Quick game format",
      isDefault: false
    },
    {
      value: 30,
      label: "30 minutes",
      description: "Standard tournament format",
      isDefault: false
    },
    {
      value: 45,
      label: "45 minutes",
      description: "Extended tournament format",
      isDefault: false
    },
    {
      value: 60,
      label: "1 hour",
      description: "Long format game",
      isDefault: false
    },
    {
      value: 90,
      label: "1.5 hours",
      description: "Championship format",
      isDefault: false
    }
  ],
  numberOfPlayersOptions: [
    {
      value: 2,
      label: "2 Players",
      description: "Head-to-head competition",
      isDefault: true,
      requiredGameModes: ["single", "double"]
    },
    {
      value: 4,
      label: "4 Players",
      description: "Team play (2 vs 2)",
      isDefault: false,
      requiredGameModes: ["double"]
    }
  ],
  features: {
    enableTimeouts: true,
    allowSpectators: true,
    enableChat: true,
    maxPlayersPerGame: 4,
    enablePenalties: true,
    allowDraws: false,
    enableConfirmation: true
  }
};

// Configuration cache
let configCache: GameConfigurationSchema | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get game configuration with caching
 */
export const getGameConfig = async (): Promise<GameConfigurationSchema> => {
  const now = Date.now();
  
  // Return cached config if still valid
  if (configCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return configCache;
  }

  try {
    // Try to load from remote config (Firestore, API, etc.)
    const remoteConfig = await loadRemoteConfig();
    if (remoteConfig) {
      configCache = migrateConfig(remoteConfig);
      cacheTimestamp = now;
      return configCache;
    }
  } catch (error) {
    console.warn("Failed to load remote config, using default:", error);
  }

  // Fallback to default config
  configCache = DEFAULT_GAME_CONFIG;
  cacheTimestamp = now;
  return configCache;
};

/**
 * Load configuration from remote source (Firestore)
 */
const loadRemoteConfig = async (): Promise<GameConfigurationSchema | null> => {
  try {
    // TODO: Implement Firestore loading
    // This would fetch from a 'gameConfig' collection
    // For now, return null to use default config
    return null;
  } catch (error) {
    console.error("Error loading remote config:", error);
    return null;
  }
};

/**
 * Migrate config to current version if needed
 */
const migrateConfig = (config: any): GameConfigurationSchema => {
  // Handle config migrations here
  // For example, if game modes change from "single/double" to "individuo/plural"
  
  if (!config.version || config.version < "1.0.0") {
    // Perform migration
    if (config.gameModes) {
      config.gameModes = config.gameModes.map((mode: any) => {
        // Example migration: rename values but keep backward compatibility
        if (mode.value === "individual" && !mode.migrateTo) {
          return { ...mode, value: "single", migrateTo: "single" };
        }
        return mode;
      });
    }
  }

  return {
    ...DEFAULT_GAME_CONFIG,
    ...config,
    version: "1.0.0"
  };
};

/**
 * Get default values for each configuration type
 */
export const getDefaultGameMode = async (): Promise<string> => {
  const config = await getGameConfig();
  return config.gameModes.find(mode => mode.isDefault)?.value || config.gameModes[0].value;
};

export const getDefaultPoints = async (): Promise<number> => {
  const config = await getGameConfig();
  return config.pointsOptions.find(option => option.isDefault)?.value || config.pointsOptions[0].value;
};

export const getDefaultRuleset = async (): Promise<string> => {
  const config = await getGameConfig();
  return config.rulesets.find(ruleset => ruleset.isDefault)?.value || config.rulesets[0].value;
};

export const getDefaultStartingPlayer = async (): Promise<string> => {
  const config = await getGameConfig();
  return config.startingPlayerOptions.find(option => option.isDefault)?.value || config.startingPlayerOptions[0].value;
};

export const getDefaultTimeLimit = async (): Promise<number> => {
  const config = await getGameConfig();
  return config.timeLimitOptions.find(option => option.isDefault)?.value || config.timeLimitOptions[0].value;
};

export const getDefaultNumberOfPlayers = async (): Promise<number> => {
  const config = await getGameConfig();
  return config.numberOfPlayersOptions.find(option => option.isDefault)?.value || config.numberOfPlayersOptions[0].value;
};

/**
 * Validate that a value exists in the current config
 */
export const validateGameMode = async (value: string): Promise<boolean> => {
  const config = await getGameConfig();
  return config.gameModes.some(mode => mode.value === value);
};

export const validatePoints = async (value: number): Promise<boolean> => {
  const config = await getGameConfig();
  return config.pointsOptions.some(option => option.value === value);
};

export const validateRuleset = async (value: string): Promise<boolean> => {
  const config = await getGameConfig();
  return config.rulesets.some(ruleset => ruleset.value === value);
};

export const validateStartingPlayer = async (value: string): Promise<boolean> => {
  const config = await getGameConfig();
  return config.startingPlayerOptions.some(option => option.value === value);
};

export const validateTimeLimit = async (value: number): Promise<boolean> => {
  const config = await getGameConfig();
  return config.timeLimitOptions.some(option => option.value === value);
};

export const validateNumberOfPlayers = async (value: number): Promise<boolean> => {
  const config = await getGameConfig();
  return config.numberOfPlayersOptions.some(option => option.value === value);
};

/**
 * Get valid number of players for a specific game mode
 */
export const getValidNumberOfPlayersForGameMode = async (gameMode: string): Promise<number[]> => {
  const config = await getGameConfig();
  return config.numberOfPlayersOptions
    .filter(option => !option.requiredGameModes || option.requiredGameModes.includes(gameMode))
    .map(option => option.value);
};

/**
 * Clear configuration cache (useful for testing or forced refresh)
 */
export const clearConfigCache = (): void => {
  configCache = null;
  cacheTimestamp = 0;
};

/**
 * Hook for React components to use game config
 */
export const useGameConfig = () => {
  const [config, setConfig] = React.useState<GameConfigurationSchema | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const gameConfig = await getGameConfig();
        setConfig(gameConfig);
      } catch (err) {
        console.error("Error loading game config:", err);
        setError("Failed to load game configuration");
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const refreshConfig = React.useCallback(async () => {
    clearConfigCache();
    try {
      setError(null);
      const gameConfig = await getGameConfig();
      setConfig(gameConfig);
    } catch (err) {
      console.error("Error refreshing game config:", err);
      setError("Failed to refresh game configuration");
    }
  }, []);

  return { config, loading, error, refreshConfig };
};

// Add React import for the hook
import React from 'react';
