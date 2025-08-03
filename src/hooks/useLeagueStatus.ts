/**
 * Custom React Hook for League Status Management
 * 
 * This hook provides functionality to manage and monitor league status
 * based on associated seasons, including automatic updates and validation.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  updateLeagueStatusBySeason, 
  validateAndUpdateLeagueStatus,
  updateAllLeagueStatusesBySeasons,
  getLeagueSeasons 
} from '../firebase';
import { Season } from '../models/league';

interface LeagueStatusHookResult {
  status: string;
  loading: boolean;
  error: string | null;
  nextTransition: {
    status: string;
    date: Date;
    daysUntil: number;
  } | null;
  validateStatus: () => Promise<void>;
  forceUpdate: () => Promise<void>;
}

/**
 * Hook to manage and monitor a single league's status
 */
export const useLeagueStatus = (leagueId: string, initialStatus?: string): LeagueStatusHookResult => {
  const [status, setStatus] = useState(initialStatus || 'active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextTransition, setNextTransition] = useState<{
    status: string;
    date: Date;
    daysUntil: number;
  } | null>(null);

  // Calculate next status transition
  const calculateNextTransition = useCallback(async (leagueId: string) => {
    try {
      const seasons = await getLeagueSeasons(leagueId);
      if (seasons.length === 0) return null;

      const now = new Date();
      const allDates = [];

      // Collect all relevant transition dates
      seasons.forEach(season => {
        const startDate = season.startDate.toDate();
        const endDate = season.endDate.toDate();
        
        if (startDate > now) {
          allDates.push({ date: startDate, status: "active" });
        }
        if (endDate > now) {
          allDates.push({ date: endDate, status: "completed" });
        }
      });

      // Sort by date and find next transition
      allDates.sort((a, b) => a.date.getTime() - b.date.getTime());

      if (allDates.length > 0) {
        const nextTransition = allDates[0];
        const daysUntil = Math.ceil((nextTransition.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          status: nextTransition.status,
          date: nextTransition.date,
          daysUntil
        };
      }

      return null;
    } catch (error) {
      console.error('Error calculating next transition:', error);
      return null;
    }
  }, []);

  // Validate and update status
  const validateStatus = useCallback(async () => {
    if (!leagueId) return;
    
    setLoading(true);
    setError(null);

    try {
      const newStatus = await validateAndUpdateLeagueStatus(leagueId);
      setStatus(newStatus);
      
      // Calculate next transition
      const transition = await calculateNextTransition(leagueId);
      setNextTransition(transition);
    } catch (err) {
      console.error('Error validating league status:', err);
      setError(err instanceof Error ? err.message : 'Failed to validate status');
    } finally {
      setLoading(false);
    }
  }, [leagueId, calculateNextTransition]);

  // Force update status (bypasses recent update check)
  const forceUpdate = useCallback(async () => {
    if (!leagueId) return;
    
    setLoading(true);
    setError(null);

    try {
      const wasUpdated = await updateLeagueStatusBySeason(leagueId);
      if (wasUpdated) {
        // Re-validate to get the new status
        const newStatus = await validateAndUpdateLeagueStatus(leagueId);
        setStatus(newStatus);
      }
      
      // Calculate next transition
      const transition = await calculateNextTransition(leagueId);
      setNextTransition(transition);
    } catch (err) {
      console.error('Error force updating league status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setLoading(false);
    }
  }, [leagueId, calculateNextTransition]);

  // Auto-validate on mount and when leagueId changes
  useEffect(() => {
    if (leagueId) {
      validateStatus();
    }
  }, [leagueId, validateStatus]);

  return {
    status,
    loading,
    error,
    nextTransition,
    validateStatus,
    forceUpdate
  };
};

interface BatchUpdateResult {
  updated: number;
  errors: number;
  total: number;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to manage batch updates of all league statuses
 */
export const useLeagueStatusBatchUpdater = (): {
  updateAll: () => Promise<void>;
  result: BatchUpdateResult;
  lastUpdate: Date | null;
} => {
  const [result, setResult] = useState<BatchUpdateResult>({
    updated: 0,
    errors: 0,
    total: 0,
    loading: false,
    error: null
  });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const updateAll = useCallback(async () => {
    setResult(prev => ({ ...prev, loading: true, error: null }));

    try {
      const updateResult = await updateAllLeagueStatusesBySeasons();
      setResult({
        ...updateResult,
        loading: false,
        error: null
      });
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error in batch update:', err);
      setResult(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Batch update failed'
      }));
    }
  }, []);

  return {
    updateAll,
    result,
    lastUpdate
  };
};

/**
 * Hook to monitor league status changes for multiple leagues
 */
export const useMultipleLeagueStatuses = (leagueIds: string[]): {
  statuses: Record<string, string>;
  loading: boolean;
  error: string | null;
  validateAll: () => Promise<void>;
} => {
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAll = useCallback(async () => {
    if (leagueIds.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const statusPromises = leagueIds.map(async (leagueId) => {
        try {
          const status = await validateAndUpdateLeagueStatus(leagueId);
          return { leagueId, status };
        } catch (err) {
          console.error(`Error validating status for league ${leagueId}:`, err);
          return { leagueId, status: 'active' }; // fallback
        }
      });

      const results = await Promise.all(statusPromises);
      const newStatuses = results.reduce((acc, { leagueId, status }) => {
        acc[leagueId] = status;
        return acc;
      }, {} as Record<string, string>);

      setStatuses(newStatuses);
    } catch (err) {
      console.error('Error validating multiple league statuses:', err);
      setError(err instanceof Error ? err.message : 'Failed to validate statuses');
    } finally {
      setLoading(false);
    }
  }, [leagueIds]);

  // Auto-validate when leagueIds change
  useEffect(() => {
    if (leagueIds.length > 0) {
      validateAll();
    }
  }, [leagueIds, validateAll]);

  return {
    statuses,
    loading,
    error,
    validateAll
  };
};

/**
 * Hook to get status display information (colors, labels, etc.)
 */
export const useLeagueStatusDisplay = (status: string) => {
  return {
    color: {
      upcoming: 'bg-yellow-500',
      active: 'bg-green-500',
      completed: 'bg-gray-500',
      canceled: 'bg-red-500'
    }[status] || 'bg-gray-500',
    
    textColor: {
      upcoming: 'text-yellow-700',
      active: 'text-green-700',
      completed: 'text-gray-700',
      canceled: 'text-red-700'
    }[status] || 'text-gray-700',
    
    bgColor: {
      upcoming: 'bg-yellow-50',
      active: 'bg-green-50',
      completed: 'bg-gray-50',
      canceled: 'bg-red-50'
    }[status] || 'bg-gray-50',
    
    label: {
      upcoming: 'Upcoming',
      active: 'Active',
      completed: 'Completed',
      canceled: 'Canceled'
    }[status] || 'Unknown',
    
    description: {
      upcoming: 'League will start soon',
      active: 'Currently accepting games',
      completed: 'League has ended',
      canceled: 'League was canceled'
    }[status] || 'Status unknown'
  };
};

export default {
  useLeagueStatus,
  useLeagueStatusBatchUpdater,
  useMultipleLeagueStatuses,
  useLeagueStatusDisplay
};
