/**
 * Componentes Reutilizables para el Sistema de Configuración Dinámica
 * Estos componentes pueden ser usados en cualquier parte de la aplicación
 */

import React, { memo } from 'react';
import { useGameOptions } from '../hooks/useGameConfig';

// Props base para selectores
interface BaseSelectorProps {
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

// Selector de Modo de Juego
interface GameModeSelectorProps extends BaseSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const GameModeSelector = memo<GameModeSelectorProps>(({ 
  value, 
  onChange, 
  disabled = false, 
  className = "",
  placeholder = "Select game mode..."
}) => {
  const { options, loading } = useGameOptions();

  if (loading) {
    return (
      <div className={`h-10 bg-gray-200 dark:bg-zinc-700 rounded-md animate-pulse ${className}`} />
    );
  }

  return (
    <select 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      disabled={disabled}
      className={`w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <option value="">{placeholder}</option>
      {options?.gameModes.map(mode => (
        <option key={mode.value} value={mode.value}>
          {mode.label} {mode.description && `- ${mode.description}`}
        </option>
      ))}
    </select>
  );
});

// Selector de Puntos
interface PointsSelectorProps extends BaseSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

export const PointsSelector = memo<PointsSelectorProps>(({ 
  value, 
  onChange, 
  disabled = false, 
  className = "",
  placeholder = "Select points to win..."
}) => {
  const { options, loading } = useGameOptions();

  if (loading) {
    return (
      <div className={`h-10 bg-gray-200 dark:bg-zinc-700 rounded-md animate-pulse ${className}`} />
    );
  }

  return (
    <select 
      value={value} 
      onChange={e => onChange(parseInt(e.target.value))} 
      disabled={disabled}
      className={`w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <option value={0}>{placeholder}</option>
      {options?.pointsOptions.map(option => (
        <option key={option.value} value={option.value}>
          {option.label} {option.description && `(${option.description})`}
        </option>
      ))}
    </select>
  );
});

// Selector de Reglas
interface RulesetSelectorProps extends BaseSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const RulesetSelector = memo<RulesetSelectorProps>(({ 
  value, 
  onChange, 
  disabled = false, 
  className = "",
  placeholder = "Select ruleset..."
}) => {
  const { options, loading } = useGameOptions();

  if (loading) {
    return (
      <div className={`h-10 bg-gray-200 dark:bg-zinc-700 rounded-md animate-pulse ${className}`} />
    );
  }

  return (
    <select 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      disabled={disabled}
      className={`w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-700 dark:border-zinc-600 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <option value="">{placeholder}</option>
      {options?.rulesets.map(ruleset => (
        <option key={ruleset.value} value={ruleset.value}>
          {ruleset.label} {ruleset.description && `- ${ruleset.description}`}
        </option>
      ))}
    </select>
  );
});

// Componente Combinado para Configuración Completa de Juego
interface GameConfigFormProps {
  value: {
    gameMode: string;
    points: number;
    ruleset: string;
  };
  onChange: (config: { gameMode: string; points: number; ruleset: string; }) => void;
  disabled?: boolean;
  showLabels?: boolean;
}

export const GameConfigForm = memo<GameConfigFormProps>(({ 
  value, 
  onChange, 
  disabled = false,
  showLabels = true
}) => {
  const handleGameModeChange = (gameMode: string) => {
    onChange({ ...value, gameMode });
  };

  const handlePointsChange = (points: number) => {
    onChange({ ...value, points });
  };

  const handleRulesetChange = (ruleset: string) => {
    onChange({ ...value, ruleset });
  };

  return (
    <div className="space-y-4">
      <div>
        {showLabels && (
          <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
            Game Mode
          </label>
        )}
        <GameModeSelector
          value={value.gameMode}
          onChange={handleGameModeChange}
          disabled={disabled}
        />
      </div>

      <div>
        {showLabels && (
          <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
            Points to Win
          </label>
        )}
        <PointsSelector
          value={value.points}
          onChange={handlePointsChange}
          disabled={disabled}
        />
      </div>

      <div>
        {showLabels && (
          <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
            Game Rules
          </label>
        )}
        <RulesetSelector
          value={value.ruleset}
          onChange={handleRulesetChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
});

// Ejemplo de uso del componente combinado
export const ExampleUsage: React.FC = () => {
  const [gameConfig, setGameConfig] = React.useState({
    gameMode: '',
    points: 0,
    ruleset: ''
  });

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Game Configuration</h2>
      
      <GameConfigForm
        value={gameConfig}
        onChange={setGameConfig}
        showLabels={true}
      />

      <div className="mt-6 p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
        <h3 className="font-medium mb-2">Current Selection:</h3>
        <pre className="text-sm">
          {JSON.stringify(gameConfig, null, 2)}
        </pre>
      </div>
      
      <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">
          🎯 Benefits
        </h3>
        <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
          <li>• Dynamic options from configuration</li>
          <li>• Automatic skeleton loading</li>
          <li>• Consistent styling across app</li>
          <li>• Type-safe with validation</li>
          <li>• Memoized for performance</li>
        </ul>
      </div>
    </div>
  );
};
