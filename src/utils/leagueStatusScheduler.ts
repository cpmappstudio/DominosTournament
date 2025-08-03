/**
 * League Status Scheduler
 * 
 * Utility functions for scheduling and executing automatic league status updates.
 * This can be used with cron jobs, cloud functions, or browser-based intervals.
 */

import { updateAllLeagueStatusesBySeasons, cleanupOrphanedLeagueSeasons } from '../firebase';

interface SchedulerOptions {
  interval?: number; // Interval in milliseconds (default: 1 hour)
  onUpdate?: (result: { updated: number; errors: number; total: number }) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

class LeagueStatusScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private options: Required<SchedulerOptions>;
  private lastSuccessfulRun = 0;
  private consecutiveNoUpdates = 0;
  private runCount = 0;
  private readonly MAX_NO_UPDATE_CYCLES = 5; // After 5 cycles with no updates, increase interval
  private readonly CLEANUP_INTERVAL = 24; // Run cleanup every 24 runs (about once per day with 4h intervals)

  constructor(options: SchedulerOptions = {}) {
    this.options = {
      interval: options.interval || 4 * 60 * 60 * 1000, // 4 hours default instead of 1
      onUpdate: options.onUpdate || (() => {}),
      onError: options.onError || console.error,
      enabled: options.enabled !== false
    };
  }

  /**
   * Start the automatic scheduler
   */
  start(): void {
    if (this.isRunning || !this.options.enabled) {
      return;
    }
    
    // Run immediately
    this.runUpdate();
    
    // Schedule recurring updates
    this.intervalId = setInterval(() => {
      this.runUpdate();
    }, this.options.interval);
    
    this.isRunning = true;
  }

  /**
   * Stop the automatic scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Run a single update cycle
   */
  async runUpdate(): Promise<void> {
    try {
      this.runCount++;
      
      // Run cleanup occasionally to remove orphaned data
      if (this.runCount % this.CLEANUP_INTERVAL === 0) {
        try {
          await cleanupOrphanedLeagueSeasons();
        } catch (error) {
          // Silent cleanup failure
        }
      }
      
      const result = await updateAllLeagueStatusesBySeasons();
      
      // Track update patterns for adaptive scheduling
      if (result.updated > 0) {
        this.consecutiveNoUpdates = 0;
        this.lastSuccessfulRun = Date.now();
      } else {
        this.consecutiveNoUpdates++;
        
        // If we haven't had updates for several cycles, increase the interval temporarily
        if (this.consecutiveNoUpdates >= this.MAX_NO_UPDATE_CYCLES && this.isRunning) {
          const extendedInterval = this.options.interval * 2; // Double the interval
          
          // Restart with extended interval
          this.stop();
          this.intervalId = setTimeout(() => {
            this.runUpdate();
            // Reset to normal interval after extended run
            if (this.isRunning) {
              this.intervalId = setInterval(() => {
                this.runUpdate();
              }, this.options.interval);
            }
          }, extendedInterval);
          this.isRunning = true;
          return;
        }
      }
      
      this.options.onUpdate(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error during update');
      this.options.onError(err);
      this.consecutiveNoUpdates++;
    }
  }

  /**
   * Update scheduler options
   */
  updateOptions(newOptions: Partial<SchedulerOptions>): void {
    const oldInterval = this.options.interval;
    this.options = { ...this.options, ...newOptions };
    
    // Only restart if interval changed and scheduler is running and the interval is actually different
    if (newOptions.interval && this.isRunning && newOptions.interval !== oldInterval) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<SchedulerOptions> {
    return { ...this.options };
  }
}

// Global scheduler instance
let globalScheduler: LeagueStatusScheduler | null = null;

/**
 * Initialize the global league status scheduler
 */
export const initializeLeagueStatusScheduler = (options: SchedulerOptions = {}): LeagueStatusScheduler => {
  // Only stop and recreate if options have changed or scheduler doesn't exist
  if (globalScheduler) {
    const currentConfig = globalScheduler.getConfig();
    const newInterval = options.interval || 60 * 60 * 1000;
    
    // If the interval hasn't changed and scheduler exists, return current instance
    if (currentConfig.interval === newInterval && currentConfig.enabled === (options.enabled !== false)) {
      return globalScheduler;
    }
    
    // Stop only if we need to change configuration
    globalScheduler.stop();
  }
  
  globalScheduler = new LeagueStatusScheduler(options);
  return globalScheduler;
};

/**
 * Get the global scheduler instance
 */
export const getLeagueStatusScheduler = (): LeagueStatusScheduler | null => {
  return globalScheduler;
};

/**
 * Start the global scheduler if not already running
 */
export const startGlobalScheduler = (options: SchedulerOptions = {}): void => {
  if (!globalScheduler) {
    initializeLeagueStatusScheduler(options);
  } else {
    // If scheduler exists but with different options, update it
    const currentConfig = globalScheduler.getConfig();
    const newInterval = options.interval || 60 * 60 * 1000;
    
    if (currentConfig.interval !== newInterval || currentConfig.enabled !== (options.enabled !== false)) {
      globalScheduler.updateOptions(options);
    }
  }
  
  if (globalScheduler && !globalScheduler.isActive()) {
    globalScheduler.start();
  }
};

/**
 * Stop the global scheduler
 */
export const stopGlobalScheduler = (): void => {
  if (globalScheduler) {
    globalScheduler.stop();
  }
};

/**
 * Browser-specific scheduler utilities
 */
export const browserScheduler = {
  /**
   * Start scheduler when page becomes visible
   */
  startOnVisible: (options: SchedulerOptions = {}) => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startGlobalScheduler(options);
      } else {
        stopGlobalScheduler();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Start immediately if page is visible
    if (document.visibilityState === 'visible') {
      startGlobalScheduler(options);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopGlobalScheduler();
    };
  },

  /**
   * Start scheduler with smart intervals based on user activity
   */
  startWithSmartIntervals: (options: SchedulerOptions = {}) => {
    // Check if scheduler is already running with smart intervals
    if (globalScheduler && globalScheduler.isActive()) {
      return () => {}; // Return empty cleanup function
    }

    let activeInterval = options.interval || 60 * 60 * 1000; // 1 hour when active
    let inactiveInterval = 4 * 60 * 60 * 1000; // 4 hours when inactive
    let isUserActive = true;
    let activityTimeout: NodeJS.Timeout;
    let currentInterval = activeInterval;
    
    // Throttle activity detection to prevent excessive updates
    let lastActivityTime = 0;
    const ACTIVITY_THROTTLE = 5000; // 5 seconds throttle

    const resetActivityTimer = () => {
      const now = Date.now();
      
      // Throttle activity detection
      if (now - lastActivityTime < ACTIVITY_THROTTLE) {
        return;
      }
      lastActivityTime = now;

      isUserActive = true;
      clearTimeout(activityTimeout);
      
      // Only update interval if it actually changed
      if (currentInterval !== activeInterval && globalScheduler) {
        currentInterval = activeInterval;
        globalScheduler.updateOptions({ interval: activeInterval });
      }
      
      activityTimeout = setTimeout(() => {
        isUserActive = false;
        // Update scheduler interval if it's running and interval actually changed
        if (globalScheduler && currentInterval !== inactiveInterval) {
          currentInterval = inactiveInterval;
          globalScheduler.updateOptions({ interval: inactiveInterval });
        }
      }, 30 * 60 * 1000); // 30 minutes of inactivity
    };

    // Use less aggressive event listeners with throttling
    const throttledActivityHandler = resetActivityTimer;
    
    // Only listen to meaningful user interactions, not mousemove
    ['mousedown', 'keypress', 'scroll', 'click', 'touchstart'].forEach(event => {
      document.addEventListener(event, throttledActivityHandler, { passive: true });
    });

    // Start with active interval
    startGlobalScheduler({ ...options, interval: activeInterval });
    currentInterval = activeInterval;
    resetActivityTimer();

    return () => {
      clearTimeout(activityTimeout);
      ['mousedown', 'keypress', 'scroll', 'click', 'touchstart'].forEach(event => {
        document.removeEventListener(event, throttledActivityHandler);
      });
      stopGlobalScheduler();
    };
  }
};

/**
 * Development utilities
 */
export const devUtils = {
  /**
   * Run immediate update (for testing)
   */
  runNow: async () => {
    if (!globalScheduler) {
      console.warn('No scheduler initialized. Creating temporary scheduler...');
      const tempScheduler = new LeagueStatusScheduler();
      await tempScheduler.runUpdate();
    } else {
      await globalScheduler.runUpdate();
    }
  },

  /**
   * Get scheduler status
   */
  getStatus: () => {
    if (!globalScheduler) {
      return { active: false, config: null };
    }
    
    return {
      active: globalScheduler.isActive(),
      config: globalScheduler.getConfig()
    };
  }
};

export { LeagueStatusScheduler };
export default {
  initializeLeagueStatusScheduler,
  getLeagueStatusScheduler,
  startGlobalScheduler,
  stopGlobalScheduler,
  browserScheduler,
  devUtils
};
