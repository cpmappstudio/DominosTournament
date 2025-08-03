import { useState, useEffect, useCallback } from 'react';
import { auth, Game } from '../firebase';
import { getFirestore, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

export function useActiveGames() {
  const [inProgressGames, setInProgressGames] = useState<Game[]>([]);
  const [hasInProgressGames, setHasInProgressGames] = useState(false);
  const [loading, setLoading] = useState(true);

  // Manual refresh function (kept for compatibility)
  const refreshActiveGames = useCallback(async () => {
    // The real-time listener handles updates automatically
    // This is just a placeholder for manual refresh if needed
  }, []);

  useEffect(() => {
    let unsubscribeGames: (() => void) | undefined;

    // Listen for auth state changes
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setLoading(true);
        
        try {
          const db = getFirestore();
          const userId = user.uid;
          
          // Create query for games where user is either creator or opponent and status is in_progress
          const gamesQuery = query(
            collection(db, 'games'),
            where('status', '==', 'in_progress'),
            orderBy('createdAt', 'desc')
          );

          // Set up real-time listener for active games
          unsubscribeGames = onSnapshot(gamesQuery, (snapshot) => {
            const activeGames: Game[] = [];
            
            snapshot.forEach((doc) => {
              const gameData = { id: doc.id, ...doc.data() } as Game;
              
              // Check if current user is involved in this game
              if (gameData.createdBy === userId || gameData.opponent === userId) {
                activeGames.push(gameData);
              }
            });
            
            setInProgressGames(activeGames);
            setHasInProgressGames(activeGames.length > 0);
            setLoading(false);
          }, (error) => {
            console.error('Error listening to active games:', error);
            setInProgressGames([]);
            setHasInProgressGames(false);
            setLoading(false);
          });

        } catch (error) {
          console.error('Error setting up active games listener:', error);
          setInProgressGames([]);
          setHasInProgressGames(false);
          setLoading(false);
        }
      } else {
        // User is not authenticated
        setInProgressGames([]);
        setHasInProgressGames(false);
        setLoading(false);
        
        // Clean up existing listener
        if (unsubscribeGames) {
          unsubscribeGames();
          unsubscribeGames = undefined;
        }
      }
    });

    // Cleanup function
    return () => {
      unsubscribeAuth();
      if (unsubscribeGames) {
        unsubscribeGames();
      }
    };
  }, []); // Empty dependency array - this effect should only run once

  return { 
    inProgressGames, 
    hasInProgressGames, 
    loading,
    count: inProgressGames.length,
    refresh: refreshActiveGames
  };
}
