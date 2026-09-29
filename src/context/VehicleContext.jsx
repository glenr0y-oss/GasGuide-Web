import { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { getVehicleOptions, getAdjustedEfficiency } from '../data/mockVehicles';
import { computeRealEfficiency, sortFillUps } from '../lib/fillUps';

const ADDED_VEHICLES_KEY = 'gasguide.addedVehicles';
const SELECTED_VEHICLE_KEY = 'gasguide.selectedVehicleId';
const FACTORS_KEY = 'gasguide.factorsByVehicle';
// The fill-up log itself, per vehicle. Real MPG is always derived from it
// (full-to-full, see src/lib/fillUps.js) and never stored on its own — the
// old single-fill 'gasguide.realEfficiencyByVehicle' value is no longer read.
const FILL_UPS_KEY = 'gasguide.fillUpsByVehicle';

function newFillUpId() {
  return globalThis.crypto?.randomUUID?.() ?? `fill-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
  // Also keyed by vehicle id — one car's fill-ups say nothing about another's
  // mileage.
  const [fillUpsByVehicle, setFillUpsByVehicle] = useState(() => loadJson(FILL_UPS_KEY, {}));

  useEffect(() => {
    localStorage.setItem(FACTORS_KEY, JSON.stringify(factorsByVehicle));
  }, [factorsByVehicle]);

  useEffect(() => {
    localStorage.setItem(FILL_UPS_KEY, JSON.stringify(fillUpsByVehicle));
  }, [fillUpsByVehicle]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0];
  const activeFactorIds = factorsByVehicle[selectedVehicleId] ?? [];
  const adjustedEfficiency = useMemo(
    () => getAdjustedEfficiency(selectedVehicle, activeFactorIds),
    [selectedVehicle, activeFactorIds]
  );
  const fillUps = useMemo(
    () => sortFillUps(fillUpsByVehicle[selectedVehicleId] ?? []),
    [fillUpsByVehicle, selectedVehicleId]
  );
  const realEfficiencySummary = useMemo(
    () => computeRealEfficiency(fillUps, selectedVehicle),
    [fillUps, selectedVehicle]
  );
  // Measured from full-to-full fill-ups — more accurate than the sticker, so
  // it takes over from the condition-factor estimate once it exists (3 full
  // tanks logged, per SPEC.md §8).
  const realEfficiency = realEfficiencySummary.efficiency;
  const effectiveEfficiency = realEfficiency ?? adjustedEfficiency;

  // `entry` has already passed validateFillUp(); this only stores it.
  function recordFillUp(entry, vehicleId = selectedVehicleId) {
    const saved = { id: newFillUpId(), ...entry };
    setFillUpsByVehicle((current) => ({
      ...current,
      [vehicleId]: [...(current[vehicleId] ?? []), saved],
    }));
    return saved;
  }

  function deleteFillUp(id, vehicleId = selectedVehicleId) {
    setFillUpsByVehicle((current) => ({
      ...current,
      [vehicleId]: (current[vehicleId] ?? []).filter((f) => f.id !== id),
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
    realEfficiencySummary,
    effectiveEfficiency,
    fillUps,
    recordFillUp,
    deleteFillUp,
  };

  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>;
}

export function useVehicle() {
  const ctx = useContext(VehicleContext);
  if (!ctx) throw new Error('useVehicle must be used inside <VehicleProvider>');
  return ctx;
}
