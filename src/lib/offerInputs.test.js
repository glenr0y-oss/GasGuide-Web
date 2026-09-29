import { describe, expect, it } from 'vitest';
import { resolveOfferEfficiency, resolveOfferPrice } from './offerInputs';

const NOW = new Date(2026, 8, 29, 12);

describe('resolveOfferEfficiency — SPEC §6.1 priority', () => {
  const civic = { fuelKind: 'gas', combinedMpg: 35 };
  const civicWithCity = { ...civic, cityMpg: 31 };

  it('prefers real MPG from the fill-up log, untouched by condition factors', () => {
    expect(resolveOfferEfficiency({ vehicle: civicWithCity, activeFactorIds: ['tires'], realEfficiency: 29.4 })).toEqual({
      value: 29.4,
      source: 'real',
      base: 29.4,
      penaltyPct: 0,
    });
  });

  it('falls back to EPA city, adjusted for flagged factors', () => {
    const r = resolveOfferEfficiency({ vehicle: civicWithCity, activeFactorIds: ['tires', 'alignment'] });
    expect(r.source).toBe('epa-city');
    expect(r.base).toBe(31);
    expect(r.penaltyPct).toBe(8);
    expect(r.value).toBeCloseTo(31 * 0.92, 10);
  });

  it('uses EPA combined when no city figure exists (SPEC Example 2: 35 × 0.97)', () => {
    const r = resolveOfferEfficiency({ vehicle: civic, activeFactorIds: ['tires'] });
    expect(r.source).toBe('epa-combined');
    expect(r.value).toBeCloseTo(33.95, 10);
  });

  it('returns no value — and so no verdict — when nothing is known', () => {
    expect(resolveOfferEfficiency({ vehicle: { fuelKind: 'gas', combinedMpg: null } })).toMatchObject({
      value: null,
      source: null,
    });
  });

  it('reads mi/kWh fields for an EV', () => {
    const ev = { fuelKind: 'ev', efficiencyMiPerKwh: 4.0, cityMiPerKwh: 4.4 };
    expect(resolveOfferEfficiency({ vehicle: ev }).value).toBe(4.4);
    expect(resolveOfferEfficiency({ vehicle: { ...ev, cityMiPerKwh: null } }).value).toBe(4.0);
  });

  it('ignores a zero or missing real figure', () => {
    expect(resolveOfferEfficiency({ vehicle: civic, realEfficiency: 0 }).source).toBe('epa-combined');
  });
});

describe('resolveOfferPrice — SPEC §6.2 priority', () => {
  const log = [
    { id: 'a', date: '2026-09-10', odometer: 100, units: 10, pricePerUnit: 3.15, fullTank: true },
    { id: 'b', date: '2026-09-27', odometer: 400, units: 10, pricePerUnit: 3.29, fullTank: true },
  ];

  it("takes the driver's override first", () => {
    expect(resolveOfferPrice({ fillUps: log, override: '$3.05', now: NOW })).toEqual({ value: 3.05, source: 'override' });
  });

  it('marks a garbage override as invalid instead of silently falling back', () => {
    expect(resolveOfferPrice({ fillUps: log, override: '3..0', now: NOW })).toEqual({ value: null, source: 'invalid' });
  });

  it('otherwise uses the most recent logged price, with its age', () => {
    expect(resolveOfferPrice({ fillUps: log, now: NOW })).toEqual({
      value: 3.29,
      source: 'logged',
      date: '2026-09-27',
      daysAgo: 2,
      stale: false,
    });
  });

  it('flags a logged price older than 14 days as stale but still uses it', () => {
    const r = resolveOfferPrice({ fillUps: [log[0]], now: NOW });
    expect(r).toMatchObject({ value: 3.15, source: 'logged', daysAgo: 19, stale: true });
  });

  it('falls back to the best nearby station, by name', () => {
    expect(resolveOfferPrice({ fillUps: [], fuelKind: 'gas', now: NOW })).toEqual({
      value: 3.19,
      source: 'nearby',
      stationName: 'Northgate Gas',
    });
    expect(resolveOfferPrice({ fillUps: [], fuelKind: 'ev', now: NOW })).toMatchObject({
      value: 0.38,
      source: 'nearby',
    });
  });
});
