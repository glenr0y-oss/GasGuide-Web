// Resolves the two numbers the verdict needs from the rest of the app —
// fuel economy and gas price — and says where each came from, so the screen
// can always print its source (SPEC.md §6.1, §6.2, §11). Pure.

import { applyConditionFactors, getConditionPenaltyPct } from '../data/mockVehicles';
import { getBestPrice } from '../data/mockStations';
import { daysSince, isPriceStale, lastLoggedPrice } from './fillUps';
import { parseAmount } from './offerMath';

/**
 * Priority: real (fill-up log) → EPA city → EPA combined → none.
 * Condition factors adjust EPA figures only; real MPG already reflects them.
 *
 * @returns {{value: number|null, source: 'real'|'epa-city'|'epa-combined'|null, base: number|null, penaltyPct: number}}
 */
export function resolveOfferEfficiency({ vehicle, activeFactorIds = [], realEfficiency = null }) {
  if (typeof realEfficiency === 'number' && realEfficiency > 0) {
    return { value: realEfficiency, source: 'real', base: realEfficiency, penaltyPct: 0 };
  }
  const isEv = vehicle?.fuelKind === 'ev';
  const city = isEv ? vehicle?.cityMiPerKwh : vehicle?.cityMpg;
  const combined = isEv ? vehicle?.efficiencyMiPerKwh : vehicle?.combinedMpg;
  const penaltyPct = getConditionPenaltyPct(activeFactorIds);
  if (typeof city === 'number' && city > 0) {
    return { value: applyConditionFactors(city, activeFactorIds), source: 'epa-city', base: city, penaltyPct };
  }
  if (typeof combined === 'number' && combined > 0) {
    return { value: applyConditionFactors(combined, activeFactorIds), source: 'epa-combined', base: combined, penaltyPct };
  }
  return { value: null, source: null, base: null, penaltyPct };
}

/**
 * Priority: the driver's override for this session → the latest logged
 * fill-up price → the best nearby station price → none.
 *
 * @returns {{value: number|null, source: 'override'|'logged'|'nearby'|'invalid'|null, date?: string, daysAgo?: number, stale?: boolean, stationName?: string}}
 */
export function resolveOfferPrice({ fillUps = [], fuelKind = 'gas', override = '', now = new Date() }) {
  if (override != null && String(override).trim() !== '') {
    const value = parseAmount(override);
    return value > 0 ? { value, source: 'override' } : { value: null, source: 'invalid' };
  }
  const logged = lastLoggedPrice(fillUps);
  if (logged) {
    return {
      value: logged.pricePerUnit,
      source: 'logged',
      date: logged.date,
      daysAgo: daysSince(logged.date, now),
      stale: isPriceStale(logged.date, now),
    };
  }
  const best = getBestPrice(fuelKind);
  if (best) return { value: best.price, source: 'nearby', stationName: best.name };
  return { value: null, source: null };
}
