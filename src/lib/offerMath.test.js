import { describe, expect, it } from 'vitest';
import {
  BORDERLINE_BAND,
  DEFAULT_FLOORS,
  RETURN_MINUTES_PER_MILE,
  computeOffer,
  describeReason,
  formatMoney,
  formatSmallMoney,
  judge,
  parseAmount,
} from './offerMath';

const floors = { hourly: '18', perMile: '1.00' };

// SPEC.md §9, Example 1 — real MPG, Borderline.
const example1 = {
  payout: '7.50',
  offerMiles: '5.2',
  offerMinutes: '22',
  returnMiles: '2.0',
  fuelEconomy: 29.4,
  pricePerUnit: 3.29,
  floors,
};

// SPEC.md §9, Example 2 — EPA fallback (35 × 0.97) + wear, Decline.
const example2 = {
  payout: '5.25',
  offerMiles: '6.8',
  offerMinutes: '24',
  returnMiles: '3.0',
  fuelEconomy: 35 * 0.97,
  pricePerUnit: 3.19,
  floors,
  wearEnabled: true,
  wearCentsPerMile: '10',
};

describe('SPEC worked examples', () => {
  it('Example 1 is Borderline at $6.69 net, $15.45/hr, $0.93/mi', () => {
    const r = computeOffer(example1);
    expect(r.ok).toBe(true);
    expect(r.totalMiles).toBeCloseTo(7.2, 10);
    expect(r.totalMinutes).toBe(26);
    expect(r.fuelUsed).toBeCloseTo(0.244898, 6);
    expect(r.fuelCost).toBeCloseTo(0.805714, 6);
    expect(r.net).toBeCloseTo(6.694286, 6);
    expect(r.hourly).toBeCloseTo(15.448352, 6);
    expect(r.perMile).toBeCloseTo(0.929762, 6);
    expect(formatMoney(r.net)).toBe('$6.69');
    expect(formatMoney(r.hourly)).toBe('$15.45');
    expect(formatMoney(r.perMile)).toBe('$0.93');
    expect(r.verdict).toBe('borderline');
    expect(r.reasons.map(describeReason)).toEqual([
      '$2.55/hr under your $18.00 floor',
      '7¢/mi under your $1.00 floor',
    ]);
  });

  it('Example 2 is a Decline at $3.35 net with a separate $0.98 wear line', () => {
    const r = computeOffer(example2);
    expect(r.ok).toBe(true);
    expect(r.totalMiles).toBeCloseTo(9.8, 10);
    expect(r.totalMinutes).toBe(30);
    expect(formatMoney(r.fuelCost)).toBe('$0.92');
    expect(r.wearCost).toBeCloseTo(0.98, 10);
    expect(formatMoney(r.net)).toBe('$3.35');
    expect(formatMoney(r.hourly)).toBe('$6.70');
    expect(formatMoney(r.perMile)).toBe('$0.34');
    expect(r.verdict).toBe('decline');
    expect(describeReason(r.reasons[0])).toBe('$11.30/hr under your $18.00 floor');
    expect(describeReason(r.reasons[1])).toBe('66¢/mi under your $1.00 floor');
  });

  it('the acceptance-criteria Take: $12 · 4.5 mi · 18 min · 1 mi back at 32 mpg, $3.29', () => {
    const r = computeOffer({
      payout: 12,
      offerMiles: 4.5,
      offerMinutes: 18,
      returnMiles: 1,
      fuelEconomy: 32,
      pricePerUnit: 3.29,
      floors,
    });
    expect(r.verdict).toBe('take');
    expect(formatMoney(r.net)).toBe('$11.43');
    expect(formatMoney(r.hourly)).toBe('$34.30');
    expect(formatMoney(r.perMile)).toBe('$2.08');
    // The hourly floor is the tighter one (1.9× vs 2.1×), so that's the margin shown.
    expect(describeReason(r.reasons[0])).toBe('$16.30/hr over your $18.00 floor');
  });

  it('works the same way for an EV in kWh', () => {
    const r = computeOffer({
      payout: 9,
      offerMiles: 6,
      offerMinutes: 25,
      returnMiles: 2,
      fuelEconomy: 4.0, // mi/kWh
      pricePerUnit: 0.42, // $/kWh
      floors,
    });
    expect(r.fuelUsed).toBeCloseTo(2, 10); // kWh
    expect(r.fuelCost).toBeCloseTo(0.84, 10);
    expect(r.net).toBeCloseTo(8.16, 10);
    expect(r.perMile).toBeCloseTo(1.02, 10);
    expect(r.verdict).toBe('borderline');
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons[0].metric).toBe('hourly');
  });
});

describe('required inputs (no verdict without them)', () => {
  const base = { ...example1 };

  it.each([
    ['payout', { payout: '' }],
    ['payout', { payout: '0' }],
    ['payout', { payout: '-4' }],
    ['payout', { payout: '7..5' }],
    ['offerMiles', { offerMiles: '' }],
    ['offerMiles', { offerMiles: '0' }],
    ['offerMinutes', { offerMinutes: '' }],
    ['offerMinutes', { offerMinutes: 'abc' }],
    ['returnMiles', { returnMiles: '-1' }],
    ['returnMiles', { returnMiles: 'x' }],
    ['fuelEconomy', { fuelEconomy: null }],
    ['fuelEconomy', { fuelEconomy: 0 }],
    ['pricePerUnit', { pricePerUnit: null }],
    ['floors', { floors: { hourly: '', perMile: '1' } }],
    ['floors', { floors: { hourly: '18', perMile: '-1' } }],
    ['wear', { wearEnabled: true, wearCentsPerMile: '' }],
  ])('missing %s → ok: false, no verdict (%o)', (field, patch) => {
    const r = computeOffer({ ...base, ...patch });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain(field);
    expect(r).not.toHaveProperty('verdict');
  });

  it('lists every missing field in screen order', () => {
    const r = computeOffer({ ...base, payout: '', offerMiles: '', offerMinutes: '' });
    expect(r.missing).toEqual(['payout', 'offerMiles', 'offerMinutes']);
  });

  it('treats a blank return leg as 0 miles, not as missing', () => {
    for (const returnMiles of ['', '   ', undefined, null]) {
      const r = computeOffer({ ...base, returnMiles });
      expect(r.ok).toBe(true);
      expect(r.returnMiles).toBe(0);
      expect(r.returnMinutes).toBe(0);
    }
  });

  it('ignores the wear value when wear is off', () => {
    const r = computeOffer({ ...base, wearEnabled: false, wearCentsPerMile: 'garbage' });
    expect(r.ok).toBe(true);
    expect(r.wearCost).toBe(0);
  });

  it('uses the default floors when none are passed', () => {
    const { floors: _unused, ...noFloors } = base;
    const r = computeOffer(noFloors);
    expect(r.floors).toEqual(DEFAULT_FLOORS);
  });
});

describe('verdict rule', () => {
  const f = { hourly: 18, perMile: 1 };

  it('a zero or negative net is always a Decline with a loss reason', () => {
    const r = computeOffer({ ...example1, payout: '0.50' });
    expect(r.net).toBeLessThan(0);
    expect(r.verdict).toBe('decline');
    expect(describeReason(r.reasons[0])).toBe("You'd lose money on this one.");
    expect(judge({ net: 0, hourly: 0, perMile: 0, floors: f }).verdict).toBe('decline');
  });

  it('exactly on both floors counts as meeting them', () => {
    expect(judge({ net: 5, hourly: 18, perMile: 1, floors: f }).verdict).toBe('take');
  });

  it('exactly at 85% of a floor is Borderline; a hair under is Decline', () => {
    const edge = BORDERLINE_BAND * 18;
    expect(judge({ net: 5, hourly: edge, perMile: 2, floors: f }).verdict).toBe('borderline');
    expect(judge({ net: 5, hourly: edge - 1e-9, perMile: 2, floors: f }).verdict).toBe('decline');
  });

  it('one floor met and the other far under is a Decline', () => {
    expect(judge({ net: 5, hourly: 40, perMile: 0.5, floors: f }).verdict).toBe('decline');
  });

  it('compares unrounded values: $17.996/hr displays as $18.00 but is still under', () => {
    const r = judge({ net: 5, hourly: 17.996, perMile: 2, floors: f });
    expect(formatMoney(17.996)).toBe('$18.00');
    expect(r.verdict).toBe('borderline');
  });

  it('a floor of 0 is always met', () => {
    const r = judge({ net: 1, hourly: 2, perMile: 0.01, floors: { hourly: 0, perMile: 0 } });
    expect(r.verdict).toBe('take');
  });

  it('changing a floor changes the verdict', () => {
    expect(computeOffer({ ...example1, floors: { hourly: '15', perMile: '0.90' } }).verdict).toBe('take');
    expect(computeOffer({ ...example1, floors: { hourly: '25', perMile: '1' } }).verdict).toBe('decline');
  });
});

describe('time and distance', () => {
  it('prices the drive back at 30 mph', () => {
    expect(RETURN_MINUTES_PER_MILE).toBe(2);
    const r = computeOffer({ ...example1, returnMiles: '5' });
    expect(r.returnMinutes).toBe(10);
    expect(r.totalMinutes).toBe(32);
    expect(r.totalMiles).toBeCloseTo(10.2, 10);
  });

  it('counts return miles in both fuel and per-mile', () => {
    const without = computeOffer({ ...example1, returnMiles: '' });
    const withReturn = computeOffer(example1);
    expect(withReturn.fuelCost).toBeGreaterThan(without.fuelCost);
    expect(withReturn.perMile).toBeLessThan(without.perMile);
  });
});

describe('double-check warnings', () => {
  it('flags implausible values but still computes', () => {
    const r = computeOffer({ ...example1, offerMiles: '700', offerMinutes: '300', payout: '250' });
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual(['payout', 'offerMiles', 'offerMinutes']);
  });

  it('warns on an implausible return leg too', () => {
    expect(computeOffer({ ...example1, returnMiles: '150' }).warnings).toEqual(['returnMiles']);
  });

  it('has no warnings for a normal offer', () => {
    expect(computeOffer(example1).warnings).toEqual([]);
  });

  it('reports warnings even when a field is missing', () => {
    const r = computeOffer({ ...example1, offerMinutes: '', offerMiles: '900' });
    expect(r.ok).toBe(false);
    expect(r.warnings).toEqual(['offerMiles']);
  });
});

describe('parseAmount', () => {
  it.each([
    ['7.5', 7.5],
    ['$7.50', 7.5],
    [' 3 ', 3],
    ['1,200', 1200],
    ['.5', 0.5],
    ['5.', 5],
    ['-2', -2],
    [12, 12],
  ])('%o → %o', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', '  ', 'abc', '7..5', '1e5', '5-', null, undefined, NaN, Infinity])('%o → null', (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe('formatting', () => {
  it('formats money with a real minus sign', () => {
    expect(formatMoney(-1.234)).toBe('−$1.23');
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('uses cents under a dollar and dollars at or above', () => {
    expect(formatSmallMoney(0.07)).toBe('7¢');
    expect(formatSmallMoney(0.996)).toBe('$1.00');
    expect(formatSmallMoney(1.234)).toBe('$1.23');
  });

  it('writes per-mile shortfalls of a dollar or more in dollars', () => {
    expect(describeReason({ kind: 'under', metric: 'perMile', by: 1.2, floor: 2 })).toBe(
      '$1.20/mi under your $2.00 floor'
    );
  });
});
