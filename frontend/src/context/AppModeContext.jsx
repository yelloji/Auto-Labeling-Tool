import React, { createContext, useContext, useState, useEffect } from 'react';

const AppModeContext = createContext(null);

const STORAGE_KEY = 'gevis_app_mode';

export const APP_MODES = {
  FULL: 'full',
  RETRAINING: 'retraining',
};

export function AppModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || APP_MODES.FULL;
    } catch {
      return APP_MODES.FULL;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  const isRetrainingMode = mode === APP_MODES.RETRAINING;
  const isFullMode = mode === APP_MODES.FULL;

  function switchToFull() { setMode(APP_MODES.FULL); }
  function switchToRetraining() { setMode(APP_MODES.RETRAINING); }
  function toggleMode() {
    setMode(prev => prev === APP_MODES.FULL ? APP_MODES.RETRAINING : APP_MODES.FULL);
  }

  return (
    <AppModeContext.Provider value={{ mode, isFullMode, isRetrainingMode, switchToFull, switchToRetraining, toggleMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error('useAppMode must be used inside AppModeProvider');
  return ctx;
}

export default AppModeContext;
