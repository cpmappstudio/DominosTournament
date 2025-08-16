// Asset URLs for proper handling in development and production
export const getAssetUrl = (path: string): string => {
  // In production (GitHub Pages), assets will be under /domino-gamer/
  // In development, they'll be under /
  const basePath = import.meta.env.BASE_URL || '/';
  return `${basePath}${path.startsWith('/') ? path.slice(1) : path}`;
};

// Commonly used asset paths
export const ASSETS = {
  LOGO: '/usa-federation.png',
  LOGO_LONG: '/usa-federation-long.png', 
  PROFILE_FALLBACK: '/profile-photo.jpg',
} as const;
