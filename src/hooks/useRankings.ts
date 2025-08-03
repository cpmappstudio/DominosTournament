import { useState, useCallback, useEffect } from 'react';
import { getAllLeaguesWithRankings, getAllSeasons } from '../firebase';
import { Season } from '../models/league';
import { useDataCache } from './useDataCache';

interface LeagueWithRankings {
  id: string;
  name: string;
  description?: string;
  photoURL?: string;
  createdAt: any;
  status: string;
  currentSeason?: string;
  seasonIds?: string[];
  rankings: any[];
}

interface UseRankingsReturn {
  leagues: LeagueWithRankings[];
  globalSeasons: Season[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  clearCache: () => void;
  clearError: () => void;
}

const RANKINGS_CACHE_KEY = 'rankings_data';
const SEASONS_CACHE_KEY = 'global_seasons';

export function useRankings(): UseRankingsReturn {
  const [leagues, setLeagues] = useState<LeagueWithRankings[]>([]);
  const [globalSeasons, setGlobalSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use cache with 5 minute TTL for rankings data
  const cache = useDataCache<any>({ 
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 50 
  });

  const fetchData = useCallback(async (useCache = true) => {
    setLoading(true);
    setError(null);

    try {
      // Check cache first if useCache is true
      if (useCache) {
        const cachedLeagues = cache.get(RANKINGS_CACHE_KEY);
        const cachedSeasons = cache.get(SEASONS_CACHE_KEY);
        
        if (cachedLeagues && cachedSeasons) {
          setLeagues(cachedLeagues);
          setGlobalSeasons(cachedSeasons);
          setLoading(false);
          return;
        }
      }

      // Fetch fresh data in parallel
      const [leaguesData, seasonsData] = await Promise.all([
        getAllLeaguesWithRankings(),
        getAllSeasons() // Global seasons
      ]);
      
      // Update state
      setLeagues(leaguesData);
      setGlobalSeasons(seasonsData);
      
      // Cache the results
      cache.set(RANKINGS_CACHE_KEY, leaguesData);
      cache.set(SEASONS_CACHE_KEY, seasonsData);
      
    } catch (err) {
      console.error("Error fetching rankings data:", err);
      setError("Failed to load rankings data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []); // Remove cache dependency to prevent re-creation

  // Refetch function for manual refresh
  const refetch = useCallback(async () => {
    await fetchData(false); // Skip cache on manual refetch
  }, [fetchData]);

  // Clear cache function
  const clearCache = useCallback(() => {
    cache.clear();
  }, [cache]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Clear error function
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    leagues,
    globalSeasons,
    loading,
    error,
    refetch,
    clearCache,
    clearError
  };
}

export default useRankings;
