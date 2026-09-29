import { createContext, useContext, useEffect, useState } from 'react';
import { readJson, writeJson } from '../utils/storage';

const STORAGE_KEY = 'gasguide.preferences';

const DEFAULT_PREFERENCES = {
  askAtPump: true,
  findStationsNearMe: true,
  // "Worth it?" screen. Stored as the strings the driver typed so the
  // inputs round-trip exactly ("1.00" stays "1.00"); src/lib parses them.
  offerFloors: { hourly: '18', perMile: '1.00' },
  offerReturnMiles: '',
  offerWear: { enabled: false, centsPerMile: '' },
};

function loadPreferences() {
  const stored = readJson(STORAGE_KEY, null);
  return stored && typeof stored === 'object' ? { ...DEFAULT_PREFERENCES, ...stored } : DEFAULT_PREFERENCES;
}

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(loadPreferences);

  useEffect(() => {
    writeJson(STORAGE_KEY, preferences);
  }, [preferences]);

  function togglePreference(key) {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }

  function setPreference(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  const value = { preferences, togglePreference, setPreference };

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
}
