import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { getFirestore, doc, updateDoc, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

interface UsernameSetupProps {
  user: User;
  onComplete: () => void;
}

const UsernameSetup: React.FC<UsernameSetupProps> = ({ user, onComplete }) => {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [hasExistingUsername, setHasExistingUsername] = useState(false);

  // Check if user already has a username
  useEffect(() => {
    const checkExistingUsername = async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.hasSetUsername === true || userData.username) {
            // User already has a username, skip setup
            setHasExistingUsername(true);
            onComplete();
          }
        }
        setIsLoading(false);
      } catch (err) {
        console.error("Error checking existing username:", err);
        setIsLoading(false);
      }
    };
    
    checkExistingUsername();
  }, [user.uid, onComplete]);

  // Username validation
  const validateUsername = (value: string): boolean => {
    // Reset states
    setError(null);
    setIsAvailable(null);

    // Check if empty
    if (!value.trim()) {
      setError("Username cannot be empty");
      return false;
    }

    // Check length
    if (value.length < 3) {
      setError("Username must be at least 3 characters");
      return false;
    }

    if (value.length > 20) {
      setError("Username must be less than 20 characters");
      return false;
    }

    // Check format (alphanumeric and underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setError("Username can only contain letters, numbers, and underscores");
      return false;
    }

    return true;
  };

  // Check if username is available
  const checkUsernameAvailability = async (value: string) => {
    if (!validateUsername(value)) return;

    setIsChecking(true);
    try {
      // Query Firestore to check if username exists
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", value.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setError("Username is already taken");
        setIsAvailable(false);
      } else {
        setIsAvailable(true);
      }
    } catch (err) {
      console.error("Error checking username:", err);
      setError("Error checking username availability");
    } finally {
      setIsChecking(false);
    }
  };

  // Handle username change with debounce
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    
    // Basic validation on change
    validateUsername(value);
    
    // Debounce the availability check
    if (value.length >= 3) {
      const timeoutId = setTimeout(() => {
        checkUsernameAvailability(value);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  };

  // Submit username
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateUsername(username) || !isAvailable) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get user document reference
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        // Update existing user document
        await updateDoc(userRef, {
          username: username.toLowerCase(),
          displayName: username
        });
      } else {
        // Create new user document
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          photoURL: user.photoURL,
          username: username.toLowerCase(),
          displayName: username,
          createdAt: new Date(),
          stats: {
            gamesPlayed: 0,
            gamesWon: 0,
            totalPoints: 0
          }
        });
      }
      
      // Complete the setup
      onComplete();
    } catch (err) {
      console.error("Error setting username:", err);
      setError("An error occurred while setting your username");
    } finally {
      setIsLoading(false);
    }
  };

  // If already has username or still loading, don't show the component
  if (hasExistingUsername || isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 mx-4">
        <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white">Welcome to USA Domino!</h2>
        <p className="mb-4 text-zinc-600 dark:text-zinc-300">
          Please choose a username to continue. This will be visible to other players.
        </p>
        <p className="mb-6 text-amber-600 dark:text-amber-400 font-medium">
          Important: Your username is permanent and cannot be changed after setup.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={handleUsernameChange}
              className={`w-full p-2 border rounded-md focus:outline-none focus:ring-2 
                ${error ? 'border-red-500 focus:ring-red-500' : isAvailable ? 'border-green-500 focus:ring-green-500' : 'border-gray-300 focus:ring-blue-500'}
                dark:bg-zinc-700 dark:border-zinc-600 dark:text-white
              `}
              placeholder="Choose a username"
              disabled={isLoading}
              autoFocus
            />
            
            {/* Error message */}
            {error && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            
            {/* Success message */}
            {isAvailable && !error && (
              <p className="mt-1 text-sm text-green-600 dark:text-green-400">Username is available!</p>
            )}
            
            {/* Checking indicator */}
            {isChecking && (
              <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">Checking availability...</p>
            )}
            
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Usernames must be 3-20 characters and can only contain letters, numbers, and underscores.
            </p>
          </div>
          
          <button
            type="submit"
            disabled={isLoading || !isAvailable || Boolean(error)}
            className={`w-full py-2 rounded-md font-medium 
              ${isLoading || !isAvailable || Boolean(error)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400'
                : 'bg-blue-600 text-white hover:bg-blue-700'}
            `}
          >
            {isLoading ? "Setting up your account..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UsernameSetup;