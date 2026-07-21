// Placeholder station + price data. In production this list comes from
// your backend, seeded by real user fill-up reports (see "The price +
// MPG loop" in CLAUDE.md) rather than a static array like this one.
//
// Coordinates below are just spaced-out placeholders so the map has
// something to render — replace with real station data once the map
// screen is pulling from your backend. lastReportMinutesAgo drives the
// "reported 12m ago" freshness label in the UI.

export const mockStations = [
  { id: 's1', name: 'Cedar Street Fuel', address: '142 Cedar St', lat: 41.70, lng: -72.68, price: 3.29, lastReportMinutesAgo: 12, stationKind: 'gas' },
  { id: 's2', name: 'Northgate Gas', address: '87 Northgate Ave', lat: 41.706, lng: -72.686, price: 3.19, lastReportMinutesAgo: 40, stationKind: 'gas' },
  { id: 's3', name: 'Riverside Fuel Stop', address: '310 Riverside Dr', lat: 41.694, lng: -72.672, price: 3.35, lastReportMinutesAgo: 5, stationKind: 'gas' },
  { id: 's4', name: 'Broad Street Gas', address: '22 Broad St', lat: 41.702, lng: -72.677, price: 3.24, lastReportMinutesAgo: 95, stationKind: 'gas' },
  { id: 's5', name: 'Cedar Street Charging', address: '150 Cedar St', lat: 41.701, lng: -72.679, price: 0.42, lastReportMinutesAgo: 22, stationKind: 'ev' },
  { id: 's6', name: 'Northgate Supercharger', address: '90 Northgate Ave', lat: 41.707, lng: -72.685, price: 0.38, lastReportMinutesAgo: 8, stationKind: 'ev' },
  { id: 's7', name: 'Riverside EV Hub', address: '305 Riverside Dr', lat: 41.693, lng: -72.671, price: 0.45, lastReportMinutesAgo: 60, stationKind: 'ev' },
];

export function getNearbyStations(fuelKind = 'gas') {
  // Replace with a real backend call once you have one — this function
  // is the seam every screen already calls through.
  return mockStations.filter((s) => s.stationKind === fuelKind).sort((a, b) => a.price - b.price);
}

export function getBestPrice(fuelKind = 'gas') {
  const stations = getNearbyStations(fuelKind);
  return stations.length ? stations[0] : null;
}

// Display helper so screens never have to hardcode "gal" — wrong unit for
// a charging station's $/kWh price.
export function getPriceUnitLabel(stationKind) {
  return stationKind === 'ev' ? 'kWh' : 'gal';
}

// --- The crowdsourced price + real-MPG loop -------------------------------
// Mechanically: a geofence detects a stop at a listed station -> once the
// user is back on the road, a single low-friction prompt asks what they
// paid per gallon -> that one answer does two things at once:
//   1. Feeds the community price map (anonymized, aggregated)
//   2. Combined with miles driven since the last fill-up, produces real
//      MPG for that specific vehicle instance
// This file only models the math. The geofence trigger itself belongs in
// a native module (see CLAUDE.md "Next integration" section) since it
// needs expo-location's background region-monitoring APIs, which only run
// inside a real device build, not Expo Go.

/**
 * @param {number} pricePerUnit - what the user says they paid, per gallon
 *   or per kWh depending on the vehicle's fuelKind
 * @param {number} milesSinceLastFillUp - from trip tracking (GPS)
 * @param {number} unitsPurchased - gallons or kWh, user-entered or derived
 *   from a total-spend field divided by pricePerUnit
 * @returns {{ realEfficiency: number|null, pricePerUnit: number }}
 */
export function processFillUpReport({ pricePerUnit, milesSinceLastFillUp, unitsPurchased }) {
  const realEfficiency =
    milesSinceLastFillUp && unitsPurchased
      ? Math.round((milesSinceLastFillUp / unitsPurchased) * 10) / 10
      : null;
  return { realEfficiency, pricePerUnit };
}
