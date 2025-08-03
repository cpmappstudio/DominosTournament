/**
 * League Status Updater Utility
 * 
 * This utility handles automatic status updates for leagues based on their associated seasons.
 * It ensures that leagues transition correctly between upcoming, active, and completed states.
 */

import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  Timestamp,
  limit,
} from "firebase/firestore";
import { Season } from "../models/league";

interface LeagueForUpdate {
  id: string;
  status: string;
  seasonIds?: string[];
  updatedAt?: Timestamp;
}

interface SeasonData {
  id: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: string;
}

/**
 * Determines the appropriate league status based on season dates
 */
const determineLeagueStatus = (seasons: SeasonData[], currentStatus: string): string => {
  if (!seasons || seasons.length === 0) {
    // No seasons associated, keep current status unless it's time-based
    return currentStatus === "upcoming" ? "active" : currentStatus;
  }

  const now = new Date();
  
  // Find the most relevant season (active, then upcoming, then most recent)
  let relevantSeason: SeasonData | null = null;
  
  // First priority: active seasons
  const activeSeasons = seasons.filter(season => {
    const start = season.startDate.toDate();
    const end = season.endDate.toDate();
    return start <= now && now <= end;
  });
  
  if (activeSeasons.length > 0) {
    // League should be active if any associated season is active
    relevantSeason = activeSeasons[0];
    return "active";
  }
  
  // Second priority: upcoming seasons
  const upcomingSeasons = seasons.filter(season => {
    const start = season.startDate.toDate();
    return start > now;
  }).sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());
  
  if (upcomingSeasons.length > 0) {
    relevantSeason = upcomingSeasons[0];
    return "upcoming";
  }
  
  // Third priority: completed seasons (all seasons are in the past)
  const completedSeasons = seasons.filter(season => {
    const end = season.endDate.toDate();
    return end < now;
  });
  
  if (completedSeasons.length > 0) {
    return "completed";
  }
  
  // Fallback to current status
  return currentStatus;
};

/**
 * Updates a single league's status based on its associated seasons
 */
export const updateLeagueStatus = async (leagueId: string): Promise<string | null> => {
  try {
    const db = getFirestore();
    
    // Get league data
    const leagueDoc = await getDocs(query(
      collection(db, "leagues"),
      where("__name__", "==", leagueId),
      limit(1)
    ));
    
    if (leagueDoc.empty) {
      console.warn(`League ${leagueId} not found`);
      return null;
    }
    
    const leagueData = leagueDoc.docs[0].data() as LeagueForUpdate;
    const currentStatus = leagueData.status;
    
    // Get associated seasons
    const leagueSeasonsQuery = query(
      collection(db, "leagueSeasons"),
      where("leagueId", "==", leagueId),
      where("status", "==", "active")
    );
    
    const leagueSeasonsSnap = await getDocs(leagueSeasonsQuery);
    const seasonIds = leagueSeasonsSnap.docs.map(doc => doc.data().seasonId);
    
    if (seasonIds.length === 0) {
      // No seasons associated, don't auto-update
      return currentStatus;
    }
    
    // Get season details
    const seasonsPromises = seasonIds.map(async (seasonId) => {
      const seasonDoc = await getDocs(query(
        collection(db, "seasons"),
        where("__name__", "==", seasonId),
        limit(1)
      ));
      
      if (!seasonDoc.empty) {
        const seasonData = seasonDoc.docs[0].data();
        return {
          id: seasonId,
          startDate: seasonData.startDate,
          endDate: seasonData.endDate,
          status: seasonData.status,
        } as SeasonData;
      }
      return null;
    });
    
    const seasons = (await Promise.all(seasonsPromises)).filter(s => s !== null) as SeasonData[];
    
    // Determine new status
    const newStatus = determineLeagueStatus(seasons, currentStatus);
    
    // Update if status has changed
    if (newStatus !== currentStatus) {
      const leagueRef = doc(db, "leagues", leagueId);
      await updateDoc(leagueRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
        // Add metadata about the status update
        lastStatusUpdate: serverTimestamp(),
        statusUpdateReason: "automatic_season_based_update"
      });
      
      console.log(`League ${leagueId} status updated from ${currentStatus} to ${newStatus}`);
      return newStatus;
    }
    
    return currentStatus;
  } catch (error) {
    console.error(`Error updating league status for ${leagueId}:`, error);
    return null;
  }
};

/**
 * Updates all leagues' statuses based on their associated seasons
 * This function should be called periodically (e.g., daily via a cron job or cloud function)
 */
export const updateAllLeagueStatuses = async (): Promise<{
  updated: number;
  errors: number;
  total: number;
}> => {
  try {
    const db = getFirestore();
    
    // Get all leagues that have season associations
    const leagueSeasonsQuery = query(
      collection(db, "leagueSeasons"),
      where("status", "==", "active")
    );
    
    const leagueSeasonsSnap = await getDocs(leagueSeasonsQuery);
    const uniqueLeagueIds = [...new Set(leagueSeasonsSnap.docs.map(doc => doc.data().leagueId))];
    
    console.log(`Updating status for ${uniqueLeagueIds.length} leagues with season associations`);
    
    let updated = 0;
    let errors = 0;
    
    // Process leagues in batches to avoid overwhelming Firestore
    const batchSize = 10;
    for (let i = 0; i < uniqueLeagueIds.length; i += batchSize) {
      const batch = uniqueLeagueIds.slice(i, i + batchSize);
      
      const updatePromises = batch.map(async (leagueId) => {
        try {
          const result = await updateLeagueStatus(leagueId);
          if (result !== null) {
            updated++;
          }
        } catch (error) {
          console.error(`Error updating league ${leagueId}:`, error);
          errors++;
        }
      });
      
      await Promise.all(updatePromises);
      
      // Small delay between batches to be nice to Firestore
      if (i + batchSize < uniqueLeagueIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const result = {
      updated,
      errors,
      total: uniqueLeagueIds.length
    };
    
    console.log(`League status update completed:`, result);
    return result;
  } catch (error) {
    console.error("Error in updateAllLeagueStatuses:", error);
    return { updated: 0, errors: 1, total: 0 };
  }
};

/**
 * Validates and updates league status on demand
 * Use this when displaying league information to ensure current status
 */
export const validateLeagueStatus = async (league: any): Promise<string> => {
  try {
    // Quick validation - if league was updated recently, trust the current status
    const lastUpdate = league.lastStatusUpdate || league.updatedAt;
    if (lastUpdate) {
      const lastUpdateTime = lastUpdate.toDate();
      const now = new Date();
      const hoursSinceUpdate = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60 * 60);
      
      // If updated within the last 6 hours, trust the current status
      if (hoursSinceUpdate < 6) {
        return league.status;
      }
    }
    
    // Otherwise, check and update if necessary
    const newStatus = await updateLeagueStatus(league.id);
    return newStatus || league.status;
  } catch (error) {
    console.error(`Error validating league status for ${league.id}:`, error);
    return league.status;
  }
};

/**
 * Get upcoming status transitions for a league
 * Useful for displaying when a league will change status
 */
export const getLeagueStatusTransitions = async (leagueId: string): Promise<{
  current: string;
  nextTransition?: {
    status: string;
    date: Date;
    daysUntil: number;
  };
}> => {
  try {
    const db = getFirestore();
    
    // Get league current status
    const leagueDoc = await getDocs(query(
      collection(db, "leagues"),
      where("__name__", "==", leagueId),
      limit(1)
    ));
    
    if (leagueDoc.empty) {
      throw new Error(`League ${leagueId} not found`);
    }
    
    const currentStatus = leagueDoc.docs[0].data().status;
    
    // Get associated seasons
    const leagueSeasonsQuery = query(
      collection(db, "leagueSeasons"),
      where("leagueId", "==", leagueId),
      where("status", "==", "active")
    );
    
    const leagueSeasonsSnap = await getDocs(leagueSeasonsQuery);
    const seasonIds = leagueSeasonsSnap.docs.map(doc => doc.data().seasonId);
    
    if (seasonIds.length === 0) {
      return { current: currentStatus };
    }
    
    // Get season dates
    const seasonsPromises = seasonIds.map(async (seasonId) => {
      const seasonDoc = await getDocs(query(
        collection(db, "seasons"),
        where("__name__", "==", seasonId),
        limit(1)
      ));
      
      if (!seasonDoc.empty) {
        const seasonData = seasonDoc.docs[0].data();
        return {
          id: seasonId,
          startDate: seasonData.startDate.toDate(),
          endDate: seasonData.endDate.toDate(),
        };
      }
      return null;
    });
    
    const seasons = (await Promise.all(seasonsPromises)).filter(s => s !== null);
    
    if (seasons.length === 0) {
      return { current: currentStatus };
    }
    
    const now = new Date();
    const allDates = [];
    
    // Collect all relevant transition dates
    seasons.forEach(season => {
      if (season.startDate > now) {
        allDates.push({ date: season.startDate, status: "active" });
      }
      if (season.endDate > now) {
        allDates.push({ date: season.endDate, status: "completed" });
      }
    });
    
    // Sort by date and find next transition
    allDates.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    if (allDates.length > 0) {
      const nextTransition = allDates[0];
      const daysUntil = Math.ceil((nextTransition.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        current: currentStatus,
        nextTransition: {
          status: nextTransition.status,
          date: nextTransition.date,
          daysUntil
        }
      };
    }
    
    return { current: currentStatus };
  } catch (error) {
    console.error(`Error getting league status transitions for ${leagueId}:`, error);
    return { current: "unknown" };
  }
};

export default {
  updateLeagueStatus,
  updateAllLeagueStatuses,
  validateLeagueStatus,
  getLeagueStatusTransitions,
};
