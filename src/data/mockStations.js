// Placeholder station + price data. In production this list comes from
// your backend, seeded by real user fill-up reports (see "The price +
// MPG loop" in CLAUDE.md) rather than a static array like this one.
//
// Coordinates below are just spaced-out placeholders so the map has
// something to render — replace with real station data once the map
// screen is pulling from your backend. lastReportMinutesAgo drives the
// "reported 12m ago" freshness label in the UI.

export const mockStations = [
  { id: 's1', name: 'Cedar Street Fuel', address: '142 Cedar St', lat: 41.70, lng: -72.68, price: 3.29, lastReportMinutesAgo: 12 },
  { id: 's2', name: 'Northgate Gas', address: '87 Northgate Ave', lat: 41.706, lng: -72.686, price: 3.19, lastReportMinutesAgo: 40 },
  { id: 's3', name: 'Riverside Fuel Stop', address: '310 Riverside Dr', lat: 41.694, lng: -72.672, price: 3.35, lastReportMinutesAgo: 5 },
  { id: 's4', name: 'Broad Street Gas', address: '22 Broad St', lat: 41.702, lng: -72.677, price: 3.24, lastReportMinutesAgo: 95 },
];

export function getNearbyStations() {
  // Replace with a real backend call once you have one — this function
  // is the seam every screen already calls through.
  return [...mockStations].sort((a, b) => a.price - b.price);
}

export function getBestPrice() {
  const stations = getNearbyStations();
  return stations.length ? stations[0] : null;
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
 * @param {number} pricePerGallon - what the user says they paid
 * @param {number} milesSinceLastFillUp - from trip tracking (GPS)
 * @param {number} gallonsPurchased - user-entered or derived from a
 *   total-spend field divided by pricePerGallon
 * @returns {{ realMpg: number|null, pricePerGallon: number }}
 */
export function processFillUpReport({ pricePerGallon, milesSinceLastFillUp, gallonsPurchased }) {
  const realMpg =
    milesSinceLastFillUp && gallonsPurchased
      ? Math.round((milesSinceLastFillUp / gallonsPurchased) * 10) / 10
      : null;
  return { realMpg, pricePerGallon };
}
