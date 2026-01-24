"use client";

import { useState, useEffect, useCallback } from 'react';

// A little utility function to check if we're on the client
const isClient = typeof window === 'object';

export function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  
  const readValue = useCallback((): T => {
    if (!isClient) {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  }, [initialValue, key]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback(value => {
    if (!isClient) {
        console.warn(`Tried setting localStorage key “${key}” even though the component is not mounted on client`);
        return;
    }

    try {
      const newValue = value instanceof Function ? value(storedValue) : value;
      window.localStorage.setItem(key, JSON.stringify(newValue));
      setStoredValue(newValue);
      // We dispatch a custom event so other tabs can stay in sync
      window.dispatchEvent(new Event("local-storage"));
    } catch (error) {
      console.warn(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, storedValue]);

  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue]);

  // Read the value from local storage on change
  useEffect(() => {
    const handleStorageChange = () => {
      setStoredValue(readValue());
    };

    if (isClient) {
      window.addEventListener("storage", handleStorageChange);
      window.addEventListener("local-storage", handleStorageChange);
    }

    return () => {
      if (isClient) {
        window.removeEventListener("storage", handleStorageChange);
        window.removeEventListener("local-storage", handleStorageChange);
      }
    };
  }, [readValue]);


  return [storedValue, setValue];
}
