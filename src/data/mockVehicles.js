// Placeholder vehicle data, standing in for real calls to:
//   - NHTSA vPIC API (decode a VIN or list makes/models/years, free, no key)
//     https://vpic.nhtsa.dot.gov/api/
//   - fueleconomy.gov API (EPA city/highway/combined MPG, free, no key)
//     https://www.fueleconomy.gov/ws/rest/
// Swap getVehicleOptions() below for real fetch calls once you're ready —
// every screen already reads through this function, not the array directly.

export const mockVehicles = [
  { id: 'v1', make: 'Toyota', model: 'Camry', year: 2022, fuelKind: 'gas', combinedMpg: 32, tankSizeGallons: 15.8, fuelType: 'Regular' },
  { id: 'v2', make: 'Honda', model: 'Civic', year: 2021, fuelKind: 'gas', combinedMpg: 35, tankSizeGallons: 12.4, fuelType: 'Regular' },
  { id: 'v3', make: 'Ford', model: 'F-150', year: 2023, fuelKind: 'gas', combinedMpg: 20, tankSizeGallons: 26.0, fuelType: 'Regular' },
  { id: 'v4', make: 'Jeep', model: 'Grand Cherokee', year: 2020, fuelKind: 'gas', combinedMpg: 22, tankSizeGallons: 24.6, fuelType: 'Regular' },
  { id: 'v5', make: 'Subaru', model: 'Outback', year: 2022, fuelKind: 'gas', combinedMpg: 29, tankSizeGallons: 18.5, fuelType: 'Regular' },
  { id: 'v6', make: 'Tesla', model: 'Model 3', year: 2023, fuelKind: 'ev', efficiencyMiPerKwh: 4.0, batteryKwh: 57.5, fuelType: 'Electric' },
  { id: 'v7', make: 'Chevrolet', model: 'Bolt EUV', year: 2023, fuelKind: 'ev', efficiencyMiPerKwh: 3.9, batteryKwh: 65.0, fuelType: 'Electric' },
];

export function getVehicleOptions() {
  // Replace with a real fetch to fueleconomy.gov / NHTSA once you have
  // the vehicle picker wired up. Keeping this as a function (not a bare
  // export) means every screen already calls it the same way a real
  // async API call would be called.
  return mockVehicles;
}

// Plug-and-play condition adjustments — deliberately manual and
// user-reported rather than auto-detected. Nobody knows a car's quirks
// better than the person driving it. Percentages are directional,
// modeled on published DOE / fueleconomy.gov research on how each issue
// affects real-world fuel economy — swap in the exact figures if you want
// to cite them in-app.
export const conditionFactors = [
  { id: 'tires', label: 'Tires underinflated', mpgPenaltyPct: 3 },
  { id: 'alignment', label: 'Alignment or worn suspension', mpgPenaltyPct: 5 },
  { id: 'airFilter', label: 'Air filter overdue', mpgPenaltyPct: 4 },
  { id: 'oldOil', label: 'Oil change overdue', mpgPenaltyPct: 2 },
  { id: 'cargoRack', label: 'Roof rack or regularly loaded down', mpgPenaltyPct: 6 },
];

// Combines a vehicle's rated efficiency (MPG for gas, mi/kWh for EVs) with
// whichever condition factors the user has flagged. This is the entire
// "damage" model for v1: additive, transparent, and editable by the user at
// any time. The penalty applies the same way regardless of fuel kind —
// bad alignment or underinflated tires waste energy whether it's gas or
// battery.
export function getAdjustedEfficiency(vehicle, activeFactorIds) {
  const baseEfficiency = vehicle?.fuelKind === 'ev' ? vehicle?.efficiencyMiPerKwh : vehicle?.combinedMpg;
  if (baseEfficiency == null) return null;
  const totalPenaltyPct = conditionFactors
    .filter((f) => activeFactorIds.includes(f.id))
    .reduce((sum, f) => sum + f.mpgPenaltyPct, 0);
  const adjusted = baseEfficiency * (1 - totalPenaltyPct / 100);
  return Math.max(adjusted, 1);
}

// Small display helper so screens never have to hardcode "mpg" — a unit
// that's simply wrong for an EV.
export function getEfficiencyUnitLabel(vehicle) {
  return vehicle?.fuelKind === 'ev' ? 'mi/kWh' : 'mpg';
}
