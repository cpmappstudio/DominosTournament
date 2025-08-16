// Configuration file using environment variables
// This ensures sensitive data is not hardcoded in the source code

const config = {
    // Firebase configuration from environment variables
    firebase: {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    },

    // Query limits and performance settings
    maxQueryLimit: 50,
    defaultPageSize: 20,

    // App settings
    app: {
        name: "USA Domino Federation",
        version: "1.0.0",
        environment: import.meta.env.MODE || "development",
    },

    // Game settings
    game: {
        defaultPointsToWin: 100,
        maxPointsToWin: 200,
        minPointsToWin: 50,
    },

    // UI settings
    ui: {
        theme: "system", // "light", "dark", or "system"
        defaultPageSize: 10,
    }
};

// Validate required environment variables
const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
] as const;

const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);

if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars.join(', '));
    console.error('Please check your .env file and ensure all required variables are set.');
}

export default config;
