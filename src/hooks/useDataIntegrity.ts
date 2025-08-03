import { useEffect, useCallback, useState } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc as firestoreDoc,
} from 'firebase/firestore';

interface UseDataIntegrityOptions {
  leagueId: string;
  autoCleanInterval?: number; // in milliseconds, default 5 minutes
  enabled?: boolean;
}

export const useDataIntegrity = ({
  leagueId,
  autoCleanInterval = 5 * 60 * 1000, // 5 minutes
  enabled = true
}: UseDataIntegrityOptions) => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [duplicatesFound, setDuplicatesFound] = useState(0);

  const cleanDuplicateMemberships = useCallback(async () => {
    if (!enabled || !leagueId || isChecking) return;

    setIsChecking(true);
    let totalDuplicatesRemoved = 0;

    try {
      const db = getFirestore();
      
      // Get all memberships for this league
      const membershipsQuery = query(
        collection(db, "leagueMemberships"),
        where("leagueId", "==", leagueId)
      );
      
      const membershipsSnap = await getDocs(membershipsQuery);
      const membershipsByUser = new Map<string, any[]>();
      
      // Group memberships by userId
      membershipsSnap.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as any;
        const userId = data.userId as string;
        
        if (!membershipsByUser.has(userId)) {
          membershipsByUser.set(userId, []);
        }
        membershipsByUser.get(userId)!.push(data);
      });
      
      // For each user, keep only the best membership
      for (const [userId, memberships] of membershipsByUser) {
        if (memberships.length > 1) {
          // Sort to determine which membership to keep
          memberships.sort((a, b) => {
            // Prefer active status
            if (a.status === "active" && b.status !== "active") return -1;
            if (b.status === "active" && a.status !== "active") return 1;
            
            // Prefer more recent joinedAt
            const aTime = a.joinedAt?.toMillis() || 0;
            const bTime = b.joinedAt?.toMillis() || 0;
            if (aTime !== bTime) return bTime - aTime;
            
            // Prefer higher role priority (owner > admin > player)
            const rolePriority = { owner: 3, admin: 2, player: 1 };
            const aPriority = rolePriority[a.role as keyof typeof rolePriority] || 0;
            const bPriority = rolePriority[b.role as keyof typeof rolePriority] || 0;
            if (aPriority !== bPriority) return bPriority - aPriority;
            
            // Finally, use document ID for deterministic ordering
            return a.id.localeCompare(b.id);
          });
          
          // Keep the first (best), delete the rest
          const toDelete = memberships.slice(1);
          
          for (const membership of toDelete) {
            try {
              await deleteDoc(firestoreDoc(db, "leagueMemberships", membership.id));
              totalDuplicatesRemoved++;
            } catch (error) {
              console.error(`Failed to delete duplicate membership ${membership.id}:`, error);
            }
          }
        }
      }
      
      setDuplicatesFound(totalDuplicatesRemoved);
      setLastCheck(new Date());
      
      if (totalDuplicatesRemoved > 0) {
        console.log(`Data integrity check: Removed ${totalDuplicatesRemoved} duplicate memberships`);
      }
      
    } catch (error) {
      console.error("Error during data integrity check:", error);
    } finally {
      setIsChecking(false);
    }

    return totalDuplicatesRemoved;
  }, [leagueId, enabled, isChecking]);

  // Auto-clean on interval
  useEffect(() => {
    if (!enabled || !leagueId) return;

    // Initial cleanup
    cleanDuplicateMemberships();

    // Set up interval for periodic cleanup
    const interval = setInterval(cleanDuplicateMemberships, autoCleanInterval);

    return () => clearInterval(interval);
  }, [leagueId, enabled, autoCleanInterval, cleanDuplicateMemberships]);

  return {
    cleanDuplicateMemberships,
    isChecking,
    lastCheck,
    duplicatesFound,
  };
};
