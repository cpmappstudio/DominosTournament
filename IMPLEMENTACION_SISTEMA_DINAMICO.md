# Guía de Implementación: Sistema de Configuración Dinámica

## 🎯 Cómo Usar el Sistema en Otros Componentes

Esta guía te muestra cómo implementar el sistema de configuración dinámica en cualquier componente de la aplicación.

## 📦 Imports Necesarios

```typescript
// Para obtener configuraciones dinámicas
import { useGameConfig } from "../config/gameConfig";

// Para hooks especializados
import { 
  useGameDefaults, 
  useGameOptions, 
  useGameValidation,
  useGameModeInfo,
  usePointsInfo,
  useRulesetInfo 
} from "../hooks/useGameConfig";

// Para funciones utilitarias
import { 
  getGamePreferences, 
  saveGamePreferences, 
  validateGameParameters 
} from "../utils/gamePreferences";
```

## 🔧 Patrones de Implementación

### 1. Componente de Creación/Configuración
```typescript
const MyGameComponent: React.FC = () => {
  // Obtener configuraciones dinámicas
  const { config, loading, error } = useGameConfig();
  const { defaults } = useGameDefaults();
  const { options } = useGameOptions();

  // Estado local usando defaults
  const [gameSettings, setGameSettings] = useState({
    gameMode: '',
    points: 0,
    ruleset: ''
  });

  // Inicializar con defaults del usuario
  useEffect(() => {
    if (defaults) {
      setGameSettings({
        gameMode: defaults.gameMode,
        points: defaults.points,
        ruleset: defaults.ruleset
      });
    }
  }, [defaults]);

  // Renderizar opciones dinámicamente
  return (
    <div>
      {/* Game Mode Selection */}
      <select onChange={e => setGameSettings(prev => ({...prev, gameMode: e.target.value}))}>
        {options?.gameModes.map(mode => (
          <option key={mode.value} value={mode.value}>
            {mode.label} - {mode.description}
          </option>
        ))}
      </select>

      {/* Points Selection */}
      <select onChange={e => setGameSettings(prev => ({...prev, points: parseInt(e.target.value)}))}>
        {options?.pointsOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.description})
          </option>
        ))}
      </select>

      {/* Ruleset Selection */}
      <select onChange={e => setGameSettings(prev => ({...prev, ruleset: e.target.value}))}>
        {options?.rulesets.map(ruleset => (
          <option key={ruleset.value} value={ruleset.value}>
            {ruleset.label} - {ruleset.description}
          </option>
        ))}
      </select>
    </div>
  );
};
```

### 2. Componente de Visualización/Display
```typescript
const GameInfoDisplay: React.FC<{ gameData: Game }> = ({ gameData }) => {
  const gameModeInfo = useGameModeInfo(gameData.settings.gameMode);
  const pointsInfo = usePointsInfo(gameData.settings.pointsToWin);
  const rulesetInfo = useRulesetInfo(gameData.settings.useBoricuaRules ? 'boricua' : 'standard');

  return (
    <div className="game-info">
      <div>
        <span>Mode:</span>
        <span>
          {gameModeInfo?.label || gameData.settings.gameMode}
          {!gameModeInfo?.isValid && <span className="text-red-500">(Legacy)</span>}
        </span>
        {gameModeInfo?.description && <p>{gameModeInfo.description}</p>}
      </div>

      <div>
        <span>Points:</span>
        <span>
          {pointsInfo?.label || `${gameData.settings.pointsToWin} points`}
          {!pointsInfo?.isValid && <span className="text-red-500">(Custom)</span>}
        </span>
      </div>

      <div>
        <span>Rules:</span>
        <span>
          {rulesetInfo?.label || (gameData.settings.useBoricuaRules ? 'Boricua' : 'Standard')}
        </span>
      </div>
    </div>
  );
};
```

### 3. Validación de Parámetros
```typescript
const CreateGameComponent: React.FC = () => {
  const { validateGameParameters } = useGameValidation();

  const handleSubmit = async () => {
    // Validar parámetros antes de crear el juego
    const validation = await validateGameParameters({
      gameMode: selectedGameMode,
      points: selectedPoints,
      ruleset: selectedRuleset
    });

    if (!validation.isValid) {
      setError('Invalid game parameters selected');
      return;
    }

    // Continuar con la creación del juego...
  };
};
```

## 🎨 Componentes Reutilizables

### GameModeSelector
```typescript
const GameModeSelector: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const { options, loading } = useGameOptions();

  if (loading) return <div className="animate-pulse bg-gray-200 h-10 rounded" />;

  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
      {options?.gameModes.map(mode => (
        <option key={mode.value} value={mode.value}>
          {mode.label} {mode.description && `- ${mode.description}`}
        </option>
      ))}
    </select>
  );
};
```

### PointsSelector
```typescript
const PointsSelector: React.FC<{
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const { options, loading } = useGameOptions();

  if (loading) return <div className="animate-pulse bg-gray-200 h-10 rounded" />;

  return (
    <select 
      value={value} 
      onChange={e => onChange(parseInt(e.target.value))} 
      disabled={disabled}
    >
      {options?.pointsOptions.map(option => (
        <option key={option.value} value={option.value}>
          {option.label} {option.description && `(${option.description})`}
        </option>
      ))}
    </select>
  );
};
```

### RulesetSelector
```typescript
const RulesetSelector: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const { options, loading } = useGameOptions();

  if (loading) return <div className="animate-pulse bg-gray-200 h-10 rounded" />;

  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
      {options?.rulesets.map(ruleset => (
        <option key={ruleset.value} value={ruleset.value}>
          {ruleset.label} {ruleset.description && `- ${ruleset.description}`}
        </option>
      ))}
    </select>
  );
};
```

## 🏗️ Estados de Carga

### Skeleton Loading
```typescript
const GameConfigSkeleton: React.FC = () => (
  <div className="space-y-4">
    <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
    <div className="h-10 bg-gray-200 rounded animate-pulse" />
    <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
    <div className="h-10 bg-gray-200 rounded animate-pulse" />
  </div>
);

// Uso en componente
const MyComponent: React.FC = () => {
  const { options, loading } = useGameOptions();

  if (loading) return <GameConfigSkeleton />;

  return (
    // Tu componente normal aquí
  );
};
```

## 🔄 Migración de Componentes Existentes

### Antes (hardcodeado)
```typescript
// ❌ Hardcodeado - no flexible
const CreateGame = () => {
  return (
    <select>
      <option value="single">Single</option>
      <option value="double">Double</option>
    </select>
  );
};
```

### Después (dinámico)
```typescript
// ✅ Dinámico - flexible y futuro-compatible
const CreateGame = () => {
  const { options, loading } = useGameOptions();

  return (
    <select>
      {loading ? (
        <option>Loading...</option>
      ) : (
        options?.gameModes.map(mode => (
          <option key={mode.value} value={mode.value}>
            {mode.label} - {mode.description}
          </option>
        ))
      )}
    </select>
  );
};
```

## 🎯 Casos de Uso Específicos

### 1. Formularios de Juego
- Usar `useGameDefaults()` para inicializar con preferencias del usuario
- Usar `useGameOptions()` para mostrar opciones disponibles
- Usar `useGameValidation()` antes del submit

### 2. Displays de Información
- Usar `useGameModeInfo()`, `usePointsInfo()`, `useRulesetInfo()` para mostrar info rica
- Mostrar alertas si los valores son legacy/deprecated

### 3. Listas y Cards
- Usar los hooks de info para mostrar labels y descripciones dinámicas
- Aplicar estilos diferentes para opciones deprecated

### 4. Configuración de Admin
- Usar `useGameConfig()` directamente para modificar la configuración central
- Implementar UI para agregar/editar opciones dinámicamente

## 🚨 Mejores Prácticas

1. **Siempre manejar loading states**
2. **Validar parámetros antes de guardar/enviar**
3. **Mostrar información de legacy/deprecated**
4. **Usar skeleton loaders para mejor UX**
5. **Memoizar componentes pesados**
6. **Manejar errores graciosamente**

Este sistema te permite cambiar configuraciones de juego sin tocar código, mantener compatibilidad hacia atrás, y proporcionar una experiencia rica y dinámica a los usuarios! 🎉
