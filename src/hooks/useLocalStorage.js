import { useState, useCallback } from 'react';

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setStoredValue = useCallback(
    (newValue) => {
      const val = typeof newValue === 'function' ? newValue(value) : newValue;
      setValue(val);
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch {
        console.warn('localStorage quota exceeded');
      }
    },
    [key, value]
  );

  return [value, setStoredValue];
}
