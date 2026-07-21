import { createContext, useContext, useState, useMemo } from 'react';
import { getVehicleOptions, getAdjustedEfficiency } from '../data/mockVehicles';

const VehicleContext = createContext(null);

export function VehicleProvider({ children }) {
  const vehicles = getVehicleOptions();
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0].id);
  // Keyed by vehicle id — condition factors are specific to one vehicle's
  // wear and tear, so flagging an issue on one car must not silently carry
  // that penalty over when the user switches to a different vehicle.
  const [factorsByVehicle, setFactorsByVehicle] = useState({});

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0];
  const activeFactorIds = factorsByVehicle[selectedVehicleId] ?? [];
  const adjustedEfficiency = useMemo(
    () => getAdjustedEfficiency(selectedVehicle, activeFactorIds),
    [selectedVehicle, activeFactorIds]
  );

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
    selectedVehicle,
    selectedVehicleId,
    setSelectedVehicleId,
    activeFactorIds,
    toggleFactor,
    adjustedEfficiency,
  };

  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>;
}

export function useVehicle() {
  const ctx = useContext(VehicleContext);
  if (!ctx) throw new Error('useVehicle must be used inside <VehicleProvider>');
  return ctx;
}
