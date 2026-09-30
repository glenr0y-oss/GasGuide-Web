// Fill-up log math: validation on save, and real fuel economy from
// full-to-full intervals (SPEC.md §8). Pure — no React, no storage.
// Works for gas (gallons, mpg, $/gal) and EVs (kWh, mi/kWh, $/kWh).
// Pinned by src/lib/fillUps.test.js.

import { parseAmount } from './offerMath';

/** Real fuel economy needs this many valid full-to-full intervals (= 3 full fills). */
export const MIN_VALID_INTERVALS = 2;

/** An interval outside this share of the EPA rating is treated as a data problem. */
export const EFFICIENCY_BAND = { low: 0.5, high: 1.6 };

/** A gap between fill-ups longer than a full tank's range × this is suspicious. */
export const RANGE_SLACK = 1.25;

/** A logged price older than this still works, but the screen asks for an update. */
export const STALE_PRICE_DAYS = 14;

/** Limits used when the vehicle's tank size or EPA rating isn't known. */
export const FALLBACK_LIMITS = {
  gas: { maxUnits: 40, maxPrice: 20, maxGapMiles: 700, minEfficiency: 5, maxEfficiency: 80 },
  ev: { maxUnits: 150, maxPrice: 2, maxGapMiles: 700, minEfficiency: 1, maxEfficiency: 8 },
};

const DAY_MS = 86400000;

function kindOf(vehicle) {
  return vehicle?.fuelKind === 'ev' ? 'ev' : 'gas';
}

/** EPA combined rating used as the sanity baseline (mpg or mi/kWh), or null. */
export function ratedEfficiency(vehicle) {
  const value = kindOf(vehicle) === 'ev' ? vehicle?.efficiencyMiPerKwh : vehicle?.combinedMpg;
  return typeof value === 'number' && value > 0 ? value : null;
}

/** Tank size (gal) or battery size (kWh), or null when unknown. */
export function tankCapacity(vehicle) {
  const value = kindOf(vehicle) === 'ev' ? vehicle?.batteryKwh : vehicle?.tankSizeGallons;
  return typeof value === 'number' && value > 0 ? value : null;
}

/** Longest believable drive between two logged fill-ups, in miles. */
export function maxGapMiles(vehicle) {
  const capacity = tankCapacity(vehicle);
  const rated = ratedEfficiency(vehicle);
  return capacity && rated ? capacity * rated * RANGE_SLACK : FALLBACK_LIMITS[kindOf(vehicle)].maxGapMiles;
}

/** Local calendar date as YYYY-MM-DD. */
export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISODate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof value === 'string' ? value : '');
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.getMonth() === Number(m[2]) - 1 && date.getDate() === Number(m[3]) ? date : null;
}

/** Whole days from a YYYY-MM-DD date to today (local). Null if unparseable. */
export function daysSince(dateISO, now = new Date()) {
  const then = parseISODate(dateISO);
  if (!then) return null;
  const today = parseISODate(todayISO(now));
  return Math.round((today - then) / DAY_MS);
}

export function isPriceStale(dateISO, now = new Date()) {
  const days = daysSince(dateISO, now);
  return days != null && days > STALE_PRICE_DAYS;
}

/** Fill-ups in driving order. The odometer is the ground truth; date breaks ties. */
export function sortFillUps(fillUps) {
  return [...(fillUps ?? [])].sort((a, b) => a.odometer - b.odometer || String(a.date).localeCompare(String(b.date)));
}

/** Most recently logged price (by date, then odometer), or null. */
export function lastLoggedPrice(fillUps) {
  const latest = [...(fillUps ?? [])]
    .filter((f) => f.pricePerUnit > 0)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.odometer - a.odometer)[0];
  return latest ? { pricePerUnit: latest.pricePerUnit, date: latest.date } : null;
}

/**
 * Validates a fill-up before it's saved.
 *
 * `errors` block the save (keyed by field, with a message the screen shows
 * as-is); `warnings` don't. `entry` is the normalized record to store when
 * there are no errors.
 *
 * @param {{date: string, odometer: string|number, units: string|number, pricePerUnit: string|number, fullTank: boolean}} raw
 * @param {Array<object>} existing  this vehicle's fill-ups
 * @param {object} vehicle
 * @param {Date} [now]
 */
export function validateFillUp(raw, existing, vehicle, now = new Date()) {
  const kind = kindOf(vehicle);
  const limits = FALLBACK_LIMITS[kind];
  const unitNoun = kind === 'ev' ? 'kWh' : 'gallons';
  const errors = {};
  const warnings = [];

  const date = typeof raw.date === 'string' && raw.date ? raw.date : todayISO(now);
  if (!parseISODate(date)) errors.date = 'Pick a valid date.';
  else if (date > todayISO(now)) errors.date = "That date hasn't happened yet.";

  const pricePerUnit = parseAmount(raw.pricePerUnit);
  if (pricePerUnit == null || pricePerUnit <= 0) errors.pricePerUnit = 'Enter what you paid per ' + (kind === 'ev' ? 'kWh.' : 'gallon.');
  else if (pricePerUnit >= limits.maxPrice) errors.pricePerUnit = `$${pricePerUnit.toFixed(2)} per ${kind === 'ev' ? 'kWh' : 'gallon'} looks like a typo.`;

  const units = parseAmount(raw.units);
  const capacity = tankCapacity(vehicle);
  const maxUnits = capacity ? capacity * 1.1 : limits.maxUnits;
  if (units == null || units <= 0) errors.units = `Enter how many ${unitNoun} you added.`;
  else if (units > maxUnits) {
    errors.units = capacity
      ? `More than your ${kind === 'ev' ? 'battery' : 'tank'} holds (${capacity} ${kind === 'ev' ? 'kWh' : 'gal'}). Typo?`
      : `${units} ${unitNoun} is more than a ${kind === 'ev' ? 'battery' : 'tank'} holds. Typo?`;
  }

  const odometer = parseAmount(raw.odometer);
  if (odometer == null || odometer <= 0) {
    errors.odometer = 'Enter the odometer reading.';
  } else if (!errors.date) {
    const others = existing ?? [];
    const before = others.filter((f) => f.date <= date);
    const after = others.filter((f) => f.date > date);
    const prev = before.reduce((best, f) => (!best || f.odometer > best.odometer ? f : best), null);
    const next = after.reduce((best, f) => (!best || f.odometer < best.odometer ? f : best), null);
    if (prev && odometer <= prev.odometer) {
      errors.odometer =
        odometer === prev.odometer
          ? `Same as your last fill-up (${prev.odometer.toLocaleString('en-US')}). Typo?`
          : `That's lower than your last fill-up (${prev.odometer.toLocaleString('en-US')}). Typo?`;
    } else if (next && odometer >= next.odometer) {
      errors.odometer = `That's higher than a later fill-up (${next.odometer.toLocaleString('en-US')}). Check the date or the reading.`;
    } else if (prev && odometer - prev.odometer > maxGapMiles(vehicle)) {
      warnings.push({ kind: 'range', miles: odometer - prev.odometer });
    }
  }

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    warnings,
    entry: ok ? { date, odometer, units, pricePerUnit, fullTank: raw.fullTank !== false } : null,
  };
}

/**
 * Real fuel economy from the log, full-to-full (SPEC.md §8).
 *
 * Between two consecutive full-tank fill-ups: miles = odometer difference,
 * fuel = everything added after the first up to and including the second
 * (partials in between count). Result = Σ miles ÷ Σ fuel over valid
 * intervals — distance-weighted, never an average of averages.
 *
 * @returns {{
 *   efficiency: number|null,
 *   validIntervals: Array<object>,
 *   excludedIntervals: Array<object>,
 *   fullTankCount: number,
 *   intervalsNeeded: number,
 *   fullFillUpsNeeded: number,
 * }}
 */
export function computeRealEfficiency(fillUps, vehicle) {
  const kind = kindOf(vehicle);
  const rated = ratedEfficiency(vehicle);
  const low = rated ? rated * EFFICIENCY_BAND.low : FALLBACK_LIMITS[kind].minEfficiency;
  const high = rated ? rated * EFFICIENCY_BAND.high : FALLBACK_LIMITS[kind].maxEfficiency;
  const gapLimit = maxGapMiles(vehicle);

  const sorted = sortFillUps(fillUps);
  const validIntervals = [];
  const excludedIntervals = [];
  let anchor = null;
  let unitsSinceAnchor = 0;
  let gapTooLong = false;
  let prev = null;

  for (const fill of sorted) {
    if (anchor) {
      unitsSinceAnchor += fill.units;
      if (prev && fill.odometer - prev.odometer > gapLimit) gapTooLong = true;
      if (fill.fullTank) {
        const miles = fill.odometer - anchor.odometer;
        const efficiency = unitsSinceAnchor > 0 ? miles / unitsSinceAnchor : null;
        const interval = { fromId: anchor.id, toId: fill.id, miles, units: unitsSinceAnchor, efficiency };
        if (!(miles > 0) || efficiency == null) excludedIntervals.push({ ...interval, reason: 'odometer' });
        else if (gapTooLong) excludedIntervals.push({ ...interval, reason: 'range' });
        else if (efficiency < low || efficiency > high) excludedIntervals.push({ ...interval, reason: 'implausible' });
        else validIntervals.push(interval);
        anchor = fill;
        unitsSinceAnchor = 0;
        gapTooLong = false;
      }
    } else if (fill.fullTank) {
      // A partial fill before the first full one has no starting point, so
      // it can't be part of an interval. Its price still counts elsewhere.
      anchor = fill;
    }
    prev = fill;
  }

  const miles = validIntervals.reduce((sum, i) => sum + i.miles, 0);
  const units = validIntervals.reduce((sum, i) => sum + i.units, 0);
  const intervalsNeeded = Math.max(0, MIN_VALID_INTERVALS - validIntervals.length);

  return {
    efficiency: validIntervals.length >= MIN_VALID_INTERVALS ? miles / units : null,
    validIntervals,
    excludedIntervals,
    fullTankCount: sorted.filter((f) => f.fullTank).length,
    intervalsNeeded,
    // Each further full fill closes one interval; with no full fill yet, the
    // first one only sets the starting point.
    fullFillUpsNeeded: intervalsNeeded === 0 ? 0 : intervalsNeeded + (anchor ? 0 : 1),
  };
}

/** Why an interval was left out, in words the log can show. */
export function describeExclusion(reason) {
  switch (reason) {
    case 'range':
      return 'More than a tank between fill-ups — a missed log or an odometer typo. Left out of your real MPG.';
    case 'implausible':
      return "This tank's mileage doesn't look right — probably a fill-up that wasn't logged. Left out.";
    default:
      return 'Odometer readings are out of order here. Left out.';
  }
}
