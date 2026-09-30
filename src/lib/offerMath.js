// Pure money math for the "Worth it?" offer verdict (see SPEC.md §6).
// No React, no storage, no DOM: components call computeOffer() and render
// what it returns. Every rule here is pinned by src/lib/offerMath.test.js.

/** Minutes per mile assumed for the drive back to the driver's zone (30 mph). */
export const RETURN_MINUTES_PER_MILE = 2;

/** An offer within 15% under a floor is Borderline; further under is Decline. */
export const BORDERLINE_BAND = 0.85;

/** Starter floors, after costs. Drivers change them on the screen. */
export const DEFAULT_FLOORS = { hourly: 18, perMile: 1 };

/** Above these the screen still computes, but asks the driver to double-check. */
export const SANITY_LIMITS = { payout: 200, offerMiles: 100, returnMiles: 100, offerMinutes: 240 };

/**
 * Parses what a driver typed into a number. Accepts "7.5", "$7.50", "1,200",
 * " 3 " and plain numbers. Returns null for blank, garbage ("7..5", "abc")
 * and non-finite values — the caller decides what null means.
 * @param {string|number|null|undefined} value
 * @returns {number|null}
 */
export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const cleaned = String(value).trim().replace(/[$,\s]/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * @typedef {'take'|'borderline'|'decline'} Verdict
 *
 * @typedef {object} OfferInput
 * @property {string|number} payout            what the offer pays, tip included
 * @property {string|number} offerMiles        pickup + drop-off miles
 * @property {string|number} offerMinutes      the app's time estimate
 * @property {string|number} [returnMiles]     drive back to the zone; blank = 0
 * @property {number|null} fuelEconomy         mpg (gas) or mi/kWh (EV)
 * @property {number|null} pricePerUnit        $/gal or $/kWh
 * @property {{hourly: string|number, perMile: string|number}} [floors]
 * @property {boolean} [wearEnabled]
 * @property {string|number} [wearCentsPerMile]
 */

/**
 * Computes net pay, hourly, per-mile and the verdict for one offer.
 *
 * When a required input is missing or invalid the result has ok: false and
 * `missing` lists the offending fields in screen order — the screen must not
 * show a verdict then (SPEC.md §11). Numbers are returned unrounded; round
 * for display only, never before comparing to floors.
 *
 * @param {OfferInput} input
 */
export function computeOffer(input) {
  const payout = parseAmount(input.payout);
  const offerMiles = parseAmount(input.offerMiles);
  const offerMinutes = parseAmount(input.offerMinutes);
  const rawReturn = input.returnMiles;
  const returnBlank = rawReturn == null || String(rawReturn).trim() === '';
  const returnMiles = returnBlank ? 0 : parseAmount(rawReturn);
  const fuelEconomy = typeof input.fuelEconomy === 'number' ? input.fuelEconomy : null;
  const pricePerUnit = typeof input.pricePerUnit === 'number' ? input.pricePerUnit : null;
  const hourlyFloor = parseAmount(input.floors?.hourly ?? DEFAULT_FLOORS.hourly);
  const perMileFloor = parseAmount(input.floors?.perMile ?? DEFAULT_FLOORS.perMile);
  const wearEnabled = Boolean(input.wearEnabled);
  const wearCents = wearEnabled ? parseAmount(input.wearCentsPerMile) : 0;

  const missing = [];
  if (!(payout > 0)) missing.push('payout');
  if (!(offerMiles > 0)) missing.push('offerMiles');
  if (!(offerMinutes > 0)) missing.push('offerMinutes');
  if (returnMiles == null || returnMiles < 0) missing.push('returnMiles');
  if (!(fuelEconomy > 0)) missing.push('fuelEconomy');
  if (!(pricePerUnit > 0)) missing.push('pricePerUnit');
  if (hourlyFloor == null || hourlyFloor < 0 || perMileFloor == null || perMileFloor < 0) {
    missing.push('floors');
  }
  if (wearEnabled && (wearCents == null || wearCents < 0)) missing.push('wear');

  const warnings = sanityWarnings({ payout, offerMiles, returnMiles, offerMinutes });

  if (missing.length) return { ok: false, missing, warnings };

  const totalMiles = offerMiles + returnMiles;
  const returnMinutes = returnMiles * RETURN_MINUTES_PER_MILE;
  const totalMinutes = offerMinutes + returnMinutes;
  const fuelUsed = totalMiles / fuelEconomy;
  const fuelCost = fuelUsed * pricePerUnit;
  const wearCost = wearEnabled ? (totalMiles * wearCents) / 100 : 0;
  const net = payout - fuelCost - wearCost;
  const hourly = net / (totalMinutes / 60);
  const perMile = net / totalMiles;
  const floors = { hourly: hourlyFloor, perMile: perMileFloor };

  return {
    ok: true,
    missing: [],
    warnings,
    payout,
    offerMiles,
    returnMiles,
    totalMiles,
    offerMinutes,
    returnMinutes,
    totalMinutes,
    fuelEconomy,
    pricePerUnit,
    fuelUsed,
    fuelCost,
    wearEnabled,
    wearCentsPerMile: wearEnabled ? wearCents : 0,
    wearCost,
    net,
    hourly,
    perMile,
    floors,
    ...judge({ net, hourly, perMile, floors }),
  };
}

/**
 * The verdict rule from SPEC.md §6, on unrounded values.
 * @returns {{verdict: Verdict, reasons: Array<object>}}
 */
export function judge({ net, hourly, perMile, floors }) {
  if (!(net > 0)) {
    return { verdict: 'decline', reasons: [{ kind: 'loss', amount: net }] };
  }
  const checks = [
    { metric: 'hourly', value: hourly, floor: floors.hourly },
    { metric: 'perMile', value: perMile, floor: floors.perMile },
  ];
  const misses = checks.filter((c) => c.value < c.floor);
  if (!misses.length) {
    // Margin over the tighter floor, measured relative to that floor so
    // $/hr and $/mi compare fairly. A floor of 0 can't be the tighter one.
    const withFloors = checks.filter((c) => c.floor > 0);
    const tightest = withFloors.length
      ? withFloors.reduce((a, b) => (a.value / a.floor <= b.value / b.floor ? a : b))
      : checks[0];
    return {
      verdict: 'take',
      reasons: [{ kind: 'over', metric: tightest.metric, by: tightest.value - tightest.floor, floor: tightest.floor }],
    };
  }
  const reasons = misses.map((c) => ({ kind: 'under', metric: c.metric, by: c.floor - c.value, floor: c.floor }));
  const farUnder = misses.some((c) => c.value < BORDERLINE_BAND * c.floor);
  return { verdict: farUnder ? 'decline' : 'borderline', reasons };
}

function sanityWarnings({ payout, offerMiles, returnMiles, offerMinutes }) {
  const values = { payout, offerMiles, returnMiles, offerMinutes };
  return Object.keys(SANITY_LIMITS).filter((key) => values[key] != null && values[key] > SANITY_LIMITS[key]);
}

// --- Display helpers ------------------------------------------------------
// Formatting only. Nothing here feeds back into a decision.

export function formatMoney(n) {
  const sign = n < 0 ? '−' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

/** "7¢" under a dollar, "$1.23" at or above. */
export function formatSmallMoney(n) {
  const cents = Math.round(Math.abs(n) * 100);
  return cents < 100 ? `${cents}¢` : `$${(cents / 100).toFixed(2)}`;
}

/** Plain-English line for one reason object from judge(). */
export function describeReason(reason) {
  if (reason.kind === 'loss') return "You'd lose money on this one.";
  const unit = reason.metric === 'hourly' ? '/hr' : '/mi';
  const amount = reason.metric === 'hourly' ? formatMoney(reason.by) : formatSmallMoney(reason.by);
  const floor = formatMoney(reason.floor);
  return reason.kind === 'under'
    ? `${amount}${unit} under your ${floor} floor`
    : `${amount}${unit} over your ${floor} floor`;
}
