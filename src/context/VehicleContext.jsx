import { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { getVehicleOptions, getAdjustedEfficiency } from '../data/mockVehicles';

const ADDED_VEHICLES_KEY = 'gasguide.addedVehicles';
const SELECTED_VEHICLE_KEY = 'gasguide.selectedVehicleId';
const FACTORS_KEY = 'gasguide.factorsByVehicle';
const REAL_EFFICIENCY_KEY = 'gasguide.realEfficiencyByVehicle';

function loadAddedVehicles() {
  try {
    const raw = localStorage.getItem(ADDED_VEHICLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

const VehicleContext = createContext(null);

export function VehicleProvider({ children }) {
  // The seed fleet always comes fresh from mockVehicles.js; only vehicles the
  // user has added via VIN lookup need to survive a reload, so just those go
  // to localStorage rather than duplicating the whole catalog there.
  const [addedVehicles, setAddedVehicles] = useState(loadAddedVehicles);
  const vehicles = useMemo(() => [...getVehicleOptions(), ...addedVehicles], [addedVehicles]);

  useEffect(() => {
    localStorage.setItem(ADDED_VEHICLES_KEY, JSON.stringify(addedVehicles));
  }, [addedVehicles]);

  const [selectedVehicleId, setSelectedVehicleIdState] = useState(
    () => localStorage.getItem(SELECTED_VEHICLE_KEY) || vehicles[0].id
  );

  function setSelectedVehicleId(id) {
    setSelectedVehicleIdState(id);
    localStorage.setItem(SELECTED_VEHICLE_KEY, id);
  }
  // Keyed by vehicle id — condition factors are specific to one vehicle's
  // wear and tear, so flagging an issue on one car must not silently carry
  // that penalty over when the user switches to a different vehicle.
  const [factorsByVehicle, setFactorsByVehicle] = useState(() => loadJson(FACTORS_KEY, {}));
  // Also keyed by vehicle id — the real MPG a fill-up report produces for
  // one car has nothing to say about a different one.
  const [realEfficiencyByVehicle, setRealEfficiencyByVehicle] = useState(() =>
    loadJson(REAL_EFFICIENCY_KEY, {})
  );

  useEffect(() => {
    localStorage.setItem(FACTORS_KEY, JSON.stringify(factorsByVehicle));
  }, [factorsByVehicle]);

  useEffect(() => {
    localStorage.setItem(REAL_EFFICIENCY_KEY, JSON.stringify(realEfficiencyByVehicle));
  }, [realEfficiencyByVehicle]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0];
  const activeFactorIds = factorsByVehicle[selectedVehicleId] ?? [];
  const adjustedEfficiency = useMemo(
    () => getAdjustedEfficiency(selectedVehicle, activeFactorIds),
    [selectedVehicle, activeFactorIds]
  );
  const realEfficiency = realEfficiencyByVehicle[selectedVehicleId] ?? null;
  // A logged fill-up is measured, real-world data — per CLAUDE.md's price +
  // MPG loop, that's more accurate than the sticker rating, so it takes
  // over from the condition-factor estimate as soon as one exists.
  const effectiveEfficiency = realEfficiency ?? adjustedEfficiency;

  function recordFillUp(report) {
    if (report?.realEfficiency == null) return;
    setRealEfficiencyByVehicle((current) => ({
      ...current,
      [selectedVehicleId]: report.realEfficiency,
    }));
  }

  function addVehicle(vehicle) {
    setAddedVehicles((current) => [...current, vehicle]);
    setSelectedVehicleId(vehicle.id);
  }

  function toggleFactor(id) {
    setFactorsByVehicle((current) => {
      const currentForVehicle = current[selectedVehicleId] ?? [];
      const updatedForVehicle = currentForVehicle.includes(id)
        ? currentForVehicle.filter((f) => f !== id)
        : [...currentForVehicle, id];
      return { ...current, [selectedVehicleId]: updatedForVehicle };
    });
  }

  const value = {
    vehicles,
    addVehicle,
    selectedVehicle,
    selectedVehicleId,
    setSelectedVehicleId,
    activeFactorIds,
    toggleFactor,
    adjustedEfficiency,
    realEfficiency,
    effectiveEfficiency,
    recordFillUp,
  };

  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>;
}

export function useVehicle() {
  const ctx = useContext(VehicleContext);
  if (!ctx) throw new Error('useVehicle must be used inside <VehicleProvider>');
  return ctx;
}
