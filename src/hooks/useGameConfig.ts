/**
 * Custom hooks for using dynamic game configuration throughout the app
 */

import { useState, useEffect, useCallback } from 'react';
import { getGameConfig, GameConfigurationSchema } from '../config/gameConfig';
import { getGamePreferences, GamePreferences } from '../utils/gamePreferences';

/**
 * Hook to get current game defaults based on user preferences and configuration
 */
export const useGameDefaults = () => {
  const [defaults, setDefaults] = useState<{
    gameMode: string;
    points: number;
    ruleset: string;
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
        ruleset: preferences.defaultRuleset
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
          rulesets: config.rulesets.filter(ruleset => !ruleset.deprecated)
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
          : true
      };

      return {
        isValid: validation.gameMode && validation.points && validation.ruleset,
        validation
      };
    } catch (error) {
      console.error('Error validating game parameters:', error);
      return {
        isValid: false,
        validation: { gameMode: false, points: false, ruleset: false }
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
