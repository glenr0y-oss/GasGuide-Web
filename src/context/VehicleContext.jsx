import { createContext, useContext, useState, useMemo } from 'react';
import { getVehicleOptions, getAdjustedEfficiency } from '../data/mockVehicles';

const VehicleContext = createContext(null);

export function VehicleProvider({ children }) {
  const vehicles = getVehicleOptions();
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0].id);
  const [activeFactorIds, setActiveFactorIds] = useState([]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0];
  const adjustedEfficiency = useMemo(
    () => getAdjustedEfficiency(selectedVehicle, activeFactorIds),
    [selectedVehicle, activeFactorIds]
  );

  function toggleFactor(id) {
    setActiveFactorIds((current) =>
      current.includes(id) ? current.filter((f) => f !== id) : [...current, id]
    );
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
