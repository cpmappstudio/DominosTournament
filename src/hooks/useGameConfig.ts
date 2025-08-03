/**
 * Custom hooks for using dynamic game configuration throughout the app
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  getGameConfig, 
  GameConfigurationSchema,
  getDefaultGameMode,
  getDefaultPoints,
  getDefaultRuleset,
  getDefaultStartingPlayer,
  getDefaultTimeLimit,
  getDefaultNumberOfPlayers,
  validateGameMode,
  validatePoints,
  validateRuleset,
  validateStartingPlayer,
  validateTimeLimit,
  validateNumberOfPlayers,
  getValidNumberOfPlayersForGameMode
} from '../config/gameConfig';
import { getGamePreferences, GamePreferences } from '../utils/gamePreferences';

/**
 * Hook to get current game defaults based on user preferences and configuration
 */
export const useGameDefaults = () => {
  const [defaults, setDefaults] = useState<{
    gameMode: string;
    points: number;
    ruleset: string;
    startingPlayer: string;
    timeLimit: number;
    numberOfPlayers: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDefaults = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const preferences = await getGamePreferences();
      
      setDefaults({
        gameMode: preferences.defaultGameMode,
        points: preferences.defaultPointsToWin,
        ruleset: preferences.defaultRuleset,
        startingPlayer: await getDefaultStartingPlayer(),
        timeLimit: await getDefaultTimeLimit(),
        numberOfPlayers: await getDefaultNumberOfPlayers()
      });
    } catch (err) {
      console.error('Error loading game defaults:', err);
      setError('Failed to load game defaults');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDefaults();
  }, [loadDefaults]);

  return { defaults, loading, error, reload: loadDefaults };
};

/**
 * Hook to get available options for dropdowns/selects
 */
export const useGameOptions = () => {
  const [options, setOptions] = useState<{
    gameModes: Array<{ value: string; label: string; description?: string }>;
    pointsOptions: Array<{ value: number; label: string; description?: string }>;
    rulesets: Array<{ value: string; label: string; description?: string }>;
    startingPlayerOptions: Array<{ value: string; label: string; description?: string }>;
    timeLimitOptions: Array<{ value: number; label: string; description?: string }>;
    numberOfPlayersOptions: Array<{ value: number; label: string; description?: string; requiredGameModes?: string[] }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const config = await getGameConfig();
        
        setOptions({
          gameModes: config.gameModes.filter(mode => !mode.deprecated),
          pointsOptions: config.pointsOptions.filter(option => !option.deprecated),
          rulesets: config.rulesets.filter(ruleset => !ruleset.deprecated),
          startingPlayerOptions: config.startingPlayerOptions.filter(option => !option.deprecated),
          timeLimitOptions: config.timeLimitOptions.filter(option => !option.deprecated),
          numberOfPlayersOptions: config.numberOfPlayersOptions.filter(option => !option.deprecated)
        });
      } catch (err) {
        console.error('Error loading game options:', err);
        setError('Failed to load game options');
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, []);

  return { options, loading, error };
};

/**
 * Hook to validate if a set of game parameters are valid
 */
export const useGameValidation = () => {
  const validateGameParameters = useCallback(async (params: {
    gameMode?: string;
    points?: number;
    ruleset?: string;
    startingPlayer?: string;
    timeLimit?: number;
    numberOfPlayers?: number;
  }) => {
    try {
      const config = await getGameConfig();
      
      const validation = {
        gameMode: params.gameMode 
          ? config.gameModes.some(mode => mode.value === params.gameMode && !mode.deprecated)
          : true,
        points: params.points
          ? config.pointsOptions.some(option => option.value === params.points && !option.deprecated)
          : true,
        ruleset: params.ruleset
          ? config.rulesets.some(ruleset => ruleset.value === params.ruleset && !ruleset.deprecated)
          : true,
        startingPlayer: params.startingPlayer
          ? config.startingPlayerOptions.some(option => option.value === params.startingPlayer && !option.deprecated)
          : true,
        timeLimit: params.timeLimit !== undefined
          ? config.timeLimitOptions.some(option => option.value === params.timeLimit && !option.deprecated)
          : true,
        numberOfPlayers: params.numberOfPlayers
          ? config.numberOfPlayersOptions.some(option => option.value === params.numberOfPlayers && !option.deprecated)
          : true
      };

      // Additional validation: check if numberOfPlayers is compatible with gameMode
      let gameModeCompatibility = true;
      if (params.gameMode && params.numberOfPlayers) {
        const validPlayers = await getValidNumberOfPlayersForGameMode(params.gameMode);
        gameModeCompatibility = validPlayers.includes(params.numberOfPlayers);
      }

      return {
        isValid: validation.gameMode && validation.points && validation.ruleset && 
                validation.startingPlayer && validation.timeLimit && validation.numberOfPlayers &&
                gameModeCompatibility,
        validation: {
          ...validation,
          gameModeCompatibility
        }
      };
    } catch (error) {
      console.error('Error validating game parameters:', error);
      return {
        isValid: false,
        validation: { 
          gameMode: false, 
          points: false, 
          ruleset: false,
          startingPlayer: false,
          timeLimit: false,
          numberOfPlayers: false,
          gameModeCompatibility: false
        }
      };
    }
  }, []);

  return { validateGameParameters };
};

/**
 * Hook for components that need to display game mode information
 */
export const useGameModeInfo = (gameMode: string) => {
  const [info, setInfo] = useState<{
    label: string;
    description?: string;
    isValid: boolean;
  } | null>(null);

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const config = await getGameConfig();
        const mode = config.gameModes.find(m => m.value === gameMode);
        
        if (mode) {
          setInfo({
            label: mode.label,
            description: mode.description,
            isValid: !mode.deprecated
          });
        } else {
          setInfo({
            label: gameMode,
            isValid: false
          });
        }
      } catch (error) {
        console.error('Error loading game mode info:', error);
        setInfo({
          label: gameMode,
          isValid: false
        });
      }
    };

    if (gameMode) {
      loadInfo();
    }
  }, [gameMode]);

  return info;
};

/**
 * Hook for components that need to display points information
 */
export const usePointsInfo = (points: number) => {
  const [info, setInfo] = useState<{
    label: string;
    description?: string;
    isValid: boolean;
  } | null>(null);

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const config = await getGameConfig();
        const pointOption = config.pointsOptions.find(p => p.value === points);
        
        if (pointOption) {
          setInfo({
            label: pointOption.label,
            description: pointOption.description,
            isValid: !pointOption.deprecated
          });
        } else {
          setInfo({
            label: `${points} points`,
            isValid: false
          });
        }
      } catch (error) {
        console.error('Error loading points info:', error);
        setInfo({
          label: `${points} points`,
          isValid: false
        });
      }
    };

    if (points) {
      loadInfo();
    }
  }, [points]);

  return info;
};

/**
 * Hook for components that need to display ruleset information
 */
export const useRulesetInfo = (ruleset: string) => {
  const [info, setInfo] = useState<{
    label: string;
    description?: string;
    isValid: boolean;
  } | null>(null);

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const config = await getGameConfig();
        const rulesetOption = config.rulesets.find(r => r.value === ruleset);
        
        if (rulesetOption) {
          setInfo({
            label: rulesetOption.label,
            description: rulesetOption.description,
            isValid: !rulesetOption.deprecated
          });
        } else {
          setInfo({
            label: ruleset,
            isValid: false
          });
        }
      } catch (error) {
        console.error('Error loading ruleset info:', error);
        setInfo({
          label: ruleset,
          isValid: false
        });
      }
    };

    if (ruleset) {
      loadInfo();
    }
  }, [ruleset]);

  return info;
};

/**
 * Hook for components that need to display starting player information
 */
export const useStartingPlayerInfo = (startingPlayer: string) => {
  const [info, setInfo] = useState<{
    label: string;
    description?: string;
    isValid: boolean;
  } | null>(null);

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const config = await getGameConfig();
        const option = config.startingPlayerOptions.find(o => o.value === startingPlayer);
        
        if (option) {
          setInfo({
            label: option.label,
            description: option.description,
            isValid: !option.deprecated
          });
        } else {
          setInfo({
            label: startingPlayer,
            isValid: false
          });
        }
      } catch (error) {
        console.error('Error loading starting player info:', error);
        setInfo({
          label: startingPlayer,
          isValid: false
        });
      }
    };

    if (startingPlayer) {
      loadInfo();
    }
  }, [startingPlayer]);

  return info;
};

/**
 * Hook for components that need to display time limit information
 */
export const useTimeLimitInfo = (timeLimit: number) => {
  const [info, setInfo] = useState<{
    label: string;
    description?: string;
    isValid: boolean;
  } | null>(null);

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const config = await getGameConfig();
        const option = config.timeLimitOptions.find(o => o.value === timeLimit);
        
        if (option) {
          setInfo({
            label: option.label,
            description: option.description,
            isValid: !option.deprecated
          });
        } else {
          setInfo({
            label: timeLimit === 0 ? "No limit" : `${timeLimit} minutes`,
            isValid: false
          });
        }
      } catch (error) {
        console.error('Error loading time limit info:', error);
        setInfo({
          label: timeLimit === 0 ? "No limit" : `${timeLimit} minutes`,
          isValid: false
        });
      }
    };

    if (typeof timeLimit === 'number') {
      loadInfo();
    }
  }, [timeLimit]);

  return info;
};

/**
 * Hook to get valid player options for a specific game mode
 */
export const useValidPlayersForGameMode = (gameMode: string) => {
  const [validPlayers, setValidPlayers] = useState<number[]>([]);

  useEffect(() => {
    const loadValidPlayers = async () => {
      try {
        const players = await getValidNumberOfPlayersForGameMode(gameMode);
        setValidPlayers(players);
      } catch (error) {
        console.error('Error loading valid players for game mode:', error);
        setValidPlayers([2]); // Fallback
      }
    };

    if (gameMode) {
      loadValidPlayers();
    }
  }, [gameMode]);

  return validPlayers;
};
