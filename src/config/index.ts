// Environment configuration with validation
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

interface AppConfig {
  firebase: FirebaseConfig;
  maxQueryLimit: number;
  enableAnalytics: boolean;
}

// Validate required environment variables
const validateEnvVar = (key: string, fallback?: string): string => {
  const value = import.meta.env[key] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

// Application configuration
export const config: AppConfig = {
  firebase: {
    apiKey: validateEnvVar('VITE_FIREBASE_API_KEY'),
    authDomain: validateEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: validateEnvVar('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: validateEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: validateEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: validateEnvVar('VITE_FIREBASE_APP_ID'),
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, // Optional
  },
  maxQueryLimit: parseInt(import.meta.env.VITE_MAX_QUERY_LIMIT || '50', 10),
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
};

// Validate configuration on module load
if (import.meta.env.MODE === 'production') {
  // Additional production validations
  if (!config.firebase.apiKey.startsWith('AIza')) {
    console.warn('Firebase API key format may be incorrect');
  }
}

export default config;
