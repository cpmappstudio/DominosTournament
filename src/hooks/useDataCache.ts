import { useState, useCallback, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  loading: boolean;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
}

export function useDataCache<T>(options: CacheOptions = {}) {
  const { ttl = 5 * 60 * 1000, maxSize = 100 } = options; // Default 5 minutes TTL, 100 entries max
  const cacheRef = useRef(new Map<string, CacheEntry<T>>());
  const optionsRef = useRef(options); // Stable options reference
  
  // Update options ref when they change
  optionsRef.current = options;

  const get = useCallback((key: string): T | null => {
    const entry = cacheRef.current.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > optionsRef.current.ttl!) {
      cacheRef.current.delete(key);
      return null;
    }

    return entry.data;
  }, []);

  const set = useCallback((key: string, data: T) => {
    const now = Date.now();
    const currentMaxSize = optionsRef.current.maxSize!;
    
    // Implement LRU eviction if cache is full
    if (cacheRef.current.size >= currentMaxSize) {
      const oldestKey = cacheRef.current.keys().next().value;
      if (oldestKey) {
        cacheRef.current.delete(oldestKey);
      }
    }

    cacheRef.current.set(key, {
      data,
      timestamp: now,
      loading: false
    });
  }, []);

  const setLoading = useCallback((key: string, loading: boolean) => {
    const entry = cacheRef.current.get(key);
    if (entry) {
      entry.loading = loading;
    }
  }, []);

  const isLoading = useCallback((key: string): boolean => {
    const entry = cacheRef.current.get(key);
    return entry?.loading ?? false;
  }, []);

  const has = useCallback((key: string): boolean => {
    const entry = cacheRef.current.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > optionsRef.current.ttl!) {
      cacheRef.current.delete(key);
      return false;
    }

    return true;
  }, []);

  const clear = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  const remove = useCallback((key: string) => {
    cacheRef.current.delete(key);
  }, []);

  return {
    get,
    set,
    has,
    clear,
    remove,
    isLoading,
    setLoading,
    get size() { return cacheRef.current.size; }
  };
}

export default useDataCache;
