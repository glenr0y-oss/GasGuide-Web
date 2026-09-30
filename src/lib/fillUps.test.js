import { describe, expect, it } from 'vitest';
import {
  MIN_VALID_INTERVALS,
  STALE_PRICE_DAYS,
  computeRealEfficiency,
  daysSince,
  describeExclusion,
  isPriceStale,
  lastLoggedPrice,
  maxGapMiles,
  sortFillUps,
  todayISO,
  validateFillUp,
} from './fillUps';

// 2022 Camry from the mock fleet: 32 mpg combined, 15.8 gal tank.
const camry = { id: 'v1', fuelKind: 'gas', combinedMpg: 32, tankSizeGallons: 15.8 };
const tesla = { id: 'v6', fuelKind: 'ev', efficiencyMiPerKwh: 4.0, batteryKwh: 57.5 };
const mystery = { id: 'x', fuelKind: 'gas', combinedMpg: null, tankSizeGallons: null };

const NOW = new Date(2026, 8, 29, 12, 0, 0); // Sep 29 2026, local

let seq = 0;
const fill = (date, odometer, units, fullTank = true, pricePerUnit = 3.29) => ({
  id: `f${++seq}`,
  date,
  odometer,
  units,
  pricePerUnit,
  fullTank,
});

// SPEC.md §8 worked example.
const specLog = [
  fill('2026-09-01', 45000, 11.0),
  fill('2026-09-08', 45320, 10.2),
  fill('2026-09-12', 45500, 5.0, false, 3.19),
  fill('2026-09-16', 45650, 6.0),
];

describe('computeRealEfficiency — SPEC §8', () => {
  it('counts partial fills toward the next full-to-full interval: 30.7 mpg', () => {
    const r = computeRealEfficiency(specLog, camry);
    expect(r.validIntervals.map((i) => [i.miles, i.units])).toEqual([
      [320, 10.2],
      [330, 11.0],
    ]);
    expect(r.validIntervals[0].efficiency).toBeCloseTo(31.37, 2);
    expect(r.validIntervals[1].efficiency).toBeCloseTo(30.0, 10);
    expect(r.efficiency).toBeCloseTo(650 / 21.2, 10);
    expect(r.efficiency.toFixed(1)).toBe('30.7');
    expect(r.fullTankCount).toBe(3);
    expect(r.intervalsNeeded).toBe(0);
    expect(r.fullFillUpsNeeded).toBe(0);
  });

  it('is distance-weighted, not an average of per-tank averages', () => {
    const r = computeRealEfficiency(specLog, camry);
    const naiveAverage = (r.validIntervals[0].efficiency + r.validIntervals[1].efficiency) / 2;
    expect(r.efficiency).not.toBeCloseTo(naiveAverage, 3);
  });

  it('excludes the tank where a fill-up was never logged (skipped log)', () => {
    const skipped = specLog.filter((f) => f.fullTank); // the 5-gallon partial is missing
    const r = computeRealEfficiency(skipped, camry);
    expect(r.excludedIntervals).toHaveLength(1);
    expect(r.excludedIntervals[0]).toMatchObject({ miles: 330, units: 6, reason: 'implausible' });
    expect(r.excludedIntervals[0].efficiency).toBeCloseTo(55, 10); // > 1.6 × 32 = 51.2
    expect(r.validIntervals).toHaveLength(1);
    expect(r.efficiency).toBeNull(); // still waiting on a second good tank
    expect(r.intervalsNeeded).toBe(1);
    expect(r.fullFillUpsNeeded).toBe(1);
  });

  it('excludes a gap longer than a tank can go (odometer typo with an extra digit)', () => {
    const log = [
      fill('2026-09-01', 45000, 11.0),
      fill('2026-09-08', 45320, 10.2),
      fill('2026-09-16', 456500, 11.0), // meant 45,650
    ];
    const r = computeRealEfficiency(log, camry);
    expect(r.excludedIntervals.map((i) => i.reason)).toEqual(['range']);
    expect(r.validIntervals).toHaveLength(1);
    expect(r.efficiency).toBeNull();
  });

  it('flags a range problem even when a partial fill sits between the full ones', () => {
    const log = [
      fill('2026-09-01', 45000, 11),
      fill('2026-09-05', 46200, 5, false), // 1,200 mi on a ~632 mi tank: a missed log
      fill('2026-09-08', 46400, 10),
    ];
    const r = computeRealEfficiency(log, camry);
    expect(r.excludedIntervals[0].reason).toBe('range');
  });

  it('ignores a partial fill that comes before the first full fill', () => {
    const log = [fill('2026-08-28', 44800, 4, false), ...specLog];
    const r = computeRealEfficiency(log, camry);
    expect(r.efficiency).toBeCloseTo(650 / 21.2, 10);
  });

  it('needs 3 full-tank fill-ups (2 intervals) before calling anything real', () => {
    expect(MIN_VALID_INTERVALS).toBe(2);
    expect(computeRealEfficiency([], camry)).toMatchObject({ efficiency: null, fullFillUpsNeeded: 3 });
    expect(computeRealEfficiency(specLog.slice(0, 1), camry)).toMatchObject({
      efficiency: null,
      fullFillUpsNeeded: 2,
    });
    expect(computeRealEfficiency(specLog.slice(0, 2), camry)).toMatchObject({
      efficiency: null,
      fullFillUpsNeeded: 1,
    });
    expect(computeRealEfficiency(specLog, camry).efficiency).not.toBeNull();
  });

  it('only partial fills → nothing measured, 3 full fills still needed', () => {
    const log = [fill('2026-09-01', 1000, 5, false), fill('2026-09-05', 1150, 5, false)];
    expect(computeRealEfficiency(log, camry)).toMatchObject({ efficiency: null, fullTankCount: 0, fullFillUpsNeeded: 3 });
  });

  it('sorts by odometer, so entry order in storage does not matter', () => {
    const shuffled = [specLog[3], specLog[0], specLog[2], specLog[1]];
    expect(computeRealEfficiency(shuffled, camry).efficiency).toBeCloseTo(650 / 21.2, 10);
  });

  it('uses fixed sanity limits when the vehicle has no EPA rating or tank size', () => {
    const log = [fill('2026-09-01', 1000, 10), fill('2026-09-05', 1300, 10), fill('2026-09-09', 1600, 10)];
    const r = computeRealEfficiency(log, mystery);
    expect(r.efficiency).toBeCloseTo(30, 10);
    const wild = [fill('2026-09-01', 1000, 1), fill('2026-09-05', 1100, 1), fill('2026-09-09', 1200, 10)];
    expect(computeRealEfficiency(wild, mystery).excludedIntervals[0].reason).toBe('implausible'); // 100 mpg
  });

  it('works for EVs in mi/kWh', () => {
    const log = [
      fill('2026-09-01', 5000, 40, true, 0.42),
      fill('2026-09-06', 5150, 38, true, 0.42),
      fill('2026-09-11', 5310, 42, true, 0.4),
    ];
    const r = computeRealEfficiency(log, tesla);
    expect(r.efficiency).toBeCloseTo(310 / 80, 10);
  });

  it('explains every exclusion reason in words', () => {
    for (const reason of ['range', 'implausible', 'odometer']) {
      expect(describeExclusion(reason)).toMatch(/\w/);
    }
  });
});

describe('validateFillUp', () => {
  const entry = (patch = {}) => ({
    date: '2026-09-20',
    odometer: '45,900',
    units: '10.5',
    pricePerUnit: '3.29',
    fullTank: true,
    ...patch,
  });

  it('accepts a normal fill-up and normalizes the numbers', () => {
    const r = validateFillUp(entry(), specLog, camry, NOW);
    expect(r.ok).toBe(true);
    expect(r.entry).toEqual({ date: '2026-09-20', odometer: 45900, units: 10.5, pricePerUnit: 3.29, fullTank: true });
    expect(r.warnings).toEqual([]);
  });

  it('defaults the date to today', () => {
    const r = validateFillUp(entry({ date: '' }), specLog, camry, NOW);
    expect(r.entry.date).toBe('2026-09-29');
  });

  it('blocks an odometer lower than the last fill-up (dropped digit)', () => {
    const r = validateFillUp(entry({ odometer: '4565' }), specLog, camry, NOW);
    expect(r.ok).toBe(false);
    expect(r.errors.odometer).toBe("That's lower than your last fill-up (45,650). Typo?");
  });

  it('blocks an odometer equal to the last fill-up', () => {
    const r = validateFillUp(entry({ odometer: '45650' }), specLog, camry, NOW);
    expect(r.errors.odometer).toMatch(/^Same as your last fill-up/);
  });

  it('saves a huge jump (extra digit) but warns about it', () => {
    const r = validateFillUp(entry({ odometer: '456500' }), specLog, camry, NOW);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([{ kind: 'range', miles: 456500 - 45650 }]);
  });

  it('checks backfilled entries against both neighbours', () => {
    const ok = validateFillUp(entry({ date: '2026-09-10', odometer: '45400' }), specLog, camry, NOW);
    expect(ok.ok).toBe(true);
    const tooHigh = validateFillUp(entry({ date: '2026-09-10', odometer: '45600' }), specLog, camry, NOW);
    expect(tooHigh.errors.odometer).toMatch(/higher than a later fill-up \(45,500\)/);
  });

  it('blocks more fuel than the tank holds (tank size known)', () => {
    const r = validateFillUp(entry({ units: '18' }), specLog, camry, NOW); // 15.8 × 1.1 = 17.38
    expect(r.errors.units).toBe('More than your tank holds (15.8 gal). Typo?');
  });

  it('falls back to 40 gal when the tank size is unknown', () => {
    expect(validateFillUp(entry({ units: '39' }), [], mystery, NOW).ok).toBe(true);
    expect(validateFillUp(entry({ units: '41' }), [], mystery, NOW).errors.units).toMatch(/Typo\?$/);
  });

  it.each([
    ['0', 'pricePerUnit'],
    ['', 'pricePerUnit'],
    ['32.90', 'pricePerUnit'], // slipped decimal
  ])('blocks a price of %o', (price, field) => {
    expect(validateFillUp(entry({ pricePerUnit: price }), specLog, camry, NOW).errors).toHaveProperty(field);
  });

  it('blocks a missing or zero amount and odometer', () => {
    const r = validateFillUp(entry({ units: '0', odometer: '' }), specLog, camry, NOW);
    expect(Object.keys(r.errors).sort()).toEqual(['odometer', 'units']);
  });

  it('blocks a date in the future and an impossible date', () => {
    expect(validateFillUp(entry({ date: '2026-09-30' }), specLog, camry, NOW).errors.date).toBeTruthy();
    expect(validateFillUp(entry({ date: '2026-02-30' }), specLog, camry, NOW).errors.date).toBeTruthy();
  });

  it('treats an unchecked full-tank box as a partial fill', () => {
    expect(validateFillUp(entry({ fullTank: false }), specLog, camry, NOW).entry.fullTank).toBe(false);
  });

  it('uses kWh limits and wording for an EV', () => {
    const r = validateFillUp(entry({ units: '70', pricePerUnit: '2.5' }), [], tesla, NOW);
    expect(r.errors.units).toBe('More than your battery holds (57.5 kWh). Typo?');
    expect(r.errors.pricePerUnit).toMatch(/per kWh looks like a typo/);
  });

  it('the first fill-up ever has nothing to compare the odometer against', () => {
    expect(validateFillUp(entry({ odometer: '12' }), [], camry, NOW).ok).toBe(true);
  });
});

describe('prices and dates', () => {
  it('lastLoggedPrice takes the most recent fill-up by date', () => {
    expect(lastLoggedPrice(specLog)).toEqual({ pricePerUnit: 3.29, date: '2026-09-16' });
    expect(lastLoggedPrice([])).toBeNull();
  });

  it('breaks same-day ties by the higher odometer', () => {
    const log = [fill('2026-09-20', 100, 5, false, 3.1), fill('2026-09-20', 180, 8, true, 3.4)];
    expect(lastLoggedPrice(log).pricePerUnit).toBe(3.4);
  });

  it('counts days in local calendar days', () => {
    expect(todayISO(NOW)).toBe('2026-09-29');
    expect(daysSince('2026-09-27', NOW)).toBe(2);
    expect(daysSince('2026-09-29', NOW)).toBe(0);
    expect(daysSince('nope', NOW)).toBeNull();
  });

  it(`calls a price stale after ${STALE_PRICE_DAYS} days`, () => {
    expect(isPriceStale('2026-09-15', NOW)).toBe(false); // 14 days
    expect(isPriceStale('2026-09-14', NOW)).toBe(true); // 15 days
  });

  it('sortFillUps does not mutate its input', () => {
    const input = [specLog[2], specLog[0]];
    const copy = [...input];
    sortFillUps(input);
    expect(input).toEqual(copy);
  });

  it('a tank range is capacity × rating × 1.25', () => {
    expect(maxGapMiles(camry)).toBeCloseTo(15.8 * 32 * 1.25, 10);
    expect(maxGapMiles(mystery)).toBe(700);
  });
});
