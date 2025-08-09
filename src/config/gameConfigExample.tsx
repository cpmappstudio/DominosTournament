/**
 * Example: Game Configuration Admin Panel
 * This shows how easy it would be to change game configurations
 * without touching any code - just updating the configuration
 */

import React, { useState } from 'react';
import { GameConfigurationSchema } from './gameConfig';

// Example of how you could easily change the game configuration
export const FUTURE_GAME_CONFIG_EXAMPLE: GameConfigurationSchema = {
  version: "2.0.0",
  lastUpdated: new Date().toISOString(),
  
  // Look how easy it is to change game modes!
  gameModes: [
    {
      value: "individual",  // Changed from "single"
      label: "Individual",  // Changed from "Single"
      description: "cada jugador juega solo",
      isDefault: true
    },
    {
      value: "parejas",     // Changed from "double" 
      label: "Parejas",     // Changed from "Double"
      description: "2 vs 2 - Formato tradicional puertorriqueño",
      isDefault: false
    },
    {
      // New mode! Just add it to config
      value: "tournament",
      label: "Tournament",
      description: "elimination style tournament play",
      isDefault: false
    }
  ],
  
  // Easy to modify point options
  pointsOptions: [
    {
      value: 75,           // New option
      label: "75 puntos",
      description: "juego rápido",
      isDefault: false
    },
    {
      value: 100,
      label: "100 puntos",
      description: "juego corto",
      isDefault: false
    },
    {
      value: 150,
      label: "150 puntos", 
      description: "partida estándar",
      isDefault: true
    },
    {
      value: 200,
      label: "200 puntos",
      description: "partida formal", 
      isDefault: false
    },
    {
      value: 300,          // New option
      label: "300 puntos",
      description: "partida extendida",
      isDefault: false
    }
  ],
  
  // Flexible ruleset system
  rulesets: [
    {
      value: "standard",
      label: "Reglas Estándar",
      description: "Reglas internacionales de dominó",
      isDefault: false
    },
    {
      value: "boricua",
      label: "Reglas Boricuas",
      description: "Reglas tradicionales puertorriqueñas",
      isDefault: true
    },
    {
      // New ruleset - just add to config!
      value: "european",
      label: "Reglas Europeas",
      description: "Estilo europeo de dominó",
      isDefault: false
    },
    {
      // Another new ruleset
      value: "custom",
      label: "Reglas Personalizadas",
      description: "Reglas definidas por el administrador",
      isDefault: false
    }
  ],

  // Starting player options
  startingPlayerOptions: [
    {
      value: "creator",
      label: "Creador del Juego",
      description: "El creador del juego inicia",
      isDefault: true
    },
    {
      value: "opponent",
      label: "Oponente",
      description: "El oponente inicia",
      isDefault: false
    },
    {
      value: "random",
      label: "Aleatorio",
      description: "Se selecciona al azar",
      isDefault: false
    }
  ],

  // Time limit options
  timeLimitOptions: [
    {
      value: 0,
      label: "Sin límite",
      description: "No hay límite de tiempo",
      isDefault: true
    },
    {
      value: 30,
      label: "30 minutos",
      description: "Partida rápida",
      isDefault: false
    },
    {
      value: 60,
      label: "1 hora",
      description: "Partida estándar",
      isDefault: false
    },
    {
      value: 120,
      label: "2 horas",
      description: "Partida extendida",
      isDefault: false
    }
  ],

  // Number of players options
  numberOfPlayersOptions: [
    {
      value: 2,
      label: "2 jugadores",
      description: "Juego individual",
      isDefault: false,
      requiredGameModes: ["single", "individual"]
    },
    {
      value: 4,
      label: "4 jugadores",
      description: "Juego en parejas",
      isDefault: true,
      requiredGameModes: ["double", "parejas"]
    }
  ],

  // Future features can be added easily
  features: {
    enableTimeouts: true,
    allowSpectators: true,
    enableChat: true,
    maxPlayersPerGame: 4
  }
};

// Example admin component to show how easy config changes are
export const GameConfigAdmin: React.FC = () => {
  const [config, setConfig] = useState<GameConfigurationSchema>(FUTURE_GAME_CONFIG_EXAMPLE);

  const addGameMode = () => {
    const newMode = {
      value: `mode_${Date.now()}`,
      label: "New Mode",
      description: "Custom game mode",
      isDefault: false
    };
    
    setConfig(prev => ({
      ...prev,
      gameModes: [...prev.gameModes, newMode]
    }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Game Configuration Admin</h1>
      
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Current Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-medium mb-2">Game Modes</h3>
            <ul className="space-y-1 text-sm">
              {config.gameModes.map(mode => (
                <li key={mode.value} className={mode.isDefault ? "font-semibold" : ""}>
                  {mode.label} {mode.isDefault && "(default)"}
                </li>
              ))}
            </ul>
            <button 
              onClick={addGameMode}
              className="mt-2 text-xs bg-blue-500 text-white px-2 py-1 rounded"
            >
              Add Mode
            </button>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Points Options</h3>
            <ul className="space-y-1 text-sm">
              {config.pointsOptions.map(option => (
                <li key={option.value} className={option.isDefault ? "font-semibold" : ""}>
                  {option.label} {option.isDefault && "(default)"}
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Rulesets</h3>
            <ul className="space-y-1 text-sm">
              {config.rulesets.map(ruleset => (
                <li key={ruleset.value} className={ruleset.isDefault ? "font-semibold" : ""}>
                  {ruleset.label} {ruleset.isDefault && "(default)"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">
          🎯 Benefits of Dynamic Configuration
        </h3>
        <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
          <li>• No code changes needed to modify game options</li>
          <li>• Automatic migration of existing user preferences</li>
          <li>• Backward compatibility with deprecated options</li>
          <li>• Easy A/B testing of new game modes</li>
          <li>• Centralized configuration management</li>
          <li>• Cache-optimized for performance</li>
        </ul>
      </div>
    </div>
  );
};
