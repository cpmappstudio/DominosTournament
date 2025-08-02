import { useState, useCallback } from 'react';
import { FirestoreError } from 'firebase/firestore';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseAsyncFirestoreOptions {
  onError?: (error: Error) => void;
  retryAttempts?: number;
  retryDelay?: number;
}

export function useAsyncFirestore<T>(
  options: UseAsyncFirestoreOptions = {}
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const { onError, retryAttempts = 2, retryDelay = 1000 } = options;

  const execute = useCallback(
    async (asyncFunction: () => Promise<T>, attempts = 0): Promise<T | null> => {
      setState({ data: null, loading: true, error: null });

      try {
        const result = await asyncFunction();
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (error) {
        const err = error as Error;
        
        // Check if this is a retryable error
        const isRetryable = isRetryableError(err);
        
        if (isRetryable && attempts < retryAttempts) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempts + 1)));
          return execute(asyncFunction, attempts + 1);
        }

        // Final error state
        setState({ data: null, loading: false, error: err });
        
        // Call error handler if provided
        onError?.(err);
        
        // Re-throw for external handling if needed
        console.error('Firestore operation failed:', err);
        return null;
      }
    },
    [onError, retryAttempts, retryDelay]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
    isRetryableError: state.error ? isRetryableError(state.error) : false,
  };
}

// Helper function to determine if an error is retryable
function isRetryableError(error: Error): boolean {
  // Network/connection errors
  if (error.message.includes('network') || 
      error.message.includes('offline') ||
      error.message.includes('connection')) {
    return true;
  }

  // Firestore specific retryable errors
  if (error instanceof FirestoreError) {
    return error.code === 'unavailable' || 
           error.code === 'deadline-exceeded' ||
           error.code === 'internal' ||
           error.code === 'resource-exhausted';
  }

  // Temporary server errors
  if (error.message.includes('503') || 
      error.message.includes('502') ||
      error.message.includes('timeout')) {
    return true;
  }

  return false;
}

// Helper function to get user-friendly error messages
export function getFirestoreErrorMessage(error: Error): string {
  if (error instanceof FirestoreError) {
    switch (error.code) {
      case 'permission-denied':
        return 'You don\'t have permission to access this data. Please try logging in again.';
      case 'unavailable':
        return 'The service is temporarily unavailable. Please try again in a moment.';
      case 'deadline-exceeded':
        return 'The request took too long. Please check your connection and try again.';
      case 'resource-exhausted':
        return 'Too many requests. Please wait a moment and try again.';
      case 'unauthenticated':
        return 'You need to be logged in to access this feature.';
      case 'not-found':
        return 'The requested data was not found.';
      case 'already-exists':
        return 'This data already exists.';
      case 'failed-precondition':
        return 'The operation cannot be completed due to current conditions.';
      case 'out-of-range':
        return 'The request is outside the valid range.';
      case 'unimplemented':
        return 'This feature is not yet implemented.';
      case 'internal':
        return 'An internal error occurred. Please try again.';
      case 'cancelled':
        return 'The operation was cancelled.';
      case 'data-loss':
        return 'Data loss occurred. Please contact support.';
      case 'unknown':
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  // Network/connection errors
  if (error.message.includes('network') || 
      error.message.includes('offline') ||
      error.message.includes('connection')) {
    return 'Connection problem. Please check your internet connection and try again.';
  }

  // Generic fallback
  return 'An error occurred. Please try again.';
}
