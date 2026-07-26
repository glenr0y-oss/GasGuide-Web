import { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { getVehicleOptions, getAdjustedEfficiency } from '../data/mockVehicles';

const ADDED_VEHICLES_KEY = 'gasguide.addedVehicles';
const SELECTED_VEHICLE_KEY = 'gasguide.selectedVehicleId';

function loadAddedVehicles() {
  try {
    const raw = localStorage.getItem(ADDED_VEHICLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
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
  const [factorsByVehicle, setFactorsByVehicle] = useState({});
  // Also keyed by vehicle id — the real MPG a fill-up report produces for
  // one car has nothing to say about a different one.
  const [realEfficiencyByVehicle, setRealEfficiencyByVehicle] = useState({});

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
