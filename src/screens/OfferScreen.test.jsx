// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PreferencesProvider } from '../context/PreferencesContext';
import { VehicleProvider } from '../context/VehicleContext';
import { todayISO } from '../lib/fillUps';
import OfferScreen from './OfferScreen';

const daysAgo = (n) => todayISO(new Date(Date.now() - n * 86400000));

// Three full tanks at exactly 29.4 mpg on the 2022 Camry (v1), last one
// bought at $3.29 two days ago — SPEC Example 1's setup.
function seedRealMpgLog() {
  const log = [
    { id: 'a', date: daysAgo(12), odometer: 10000, units: 10, pricePerUnit: 3.19, fullTank: true },
    { id: 'b', date: daysAgo(7), odometer: 10294, units: 10, pricePerUnit: 3.25, fullTank: true },
    { id: 'c', date: daysAgo(2), odometer: 10588, units: 10, pricePerUnit: 3.29, fullTank: true },
  ];
  localStorage.setItem('gasguide.fillUpsByVehicle', JSON.stringify({ v1: log }));
}

function renderScreen() {
  return render(
    <PreferencesProvider>
      <VehicleProvider>
        <OfferScreen />
      </VehicleProvider>
    </PreferencesProvider>
  );
}

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const verdictCard = () => document.querySelector('.verdict-card');

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('OfferScreen', () => {
  it('asks for the offer before showing any verdict', () => {
    renderScreen();
    expect(verdictCard()).toHaveProperty('className', expect.stringContaining('verdict-empty'));
    expect(screen.getByText('Type the payout, miles and minutes from the offer.')).toBeTruthy();
  });

  it('SPEC Example 1 end to end: real MPG, logged price, Borderline', () => {
    seedRealMpgLog();
    renderScreen();
    type('Payout', '7.50');
    type('Miles', '5.2');
    type('Minutes', '22');
    type('Miles back to your zone', '2.0');

    const card = within(verdictCard());
    expect(card.getByText('Borderline')).toBeTruthy();
    expect(card.getByText('$6.69')).toBeTruthy();
    expect(card.getByText('$15.45')).toBeTruthy();
    expect(card.getByText('$0.93')).toBeTruthy();
    expect(card.getByText('$2.55/hr under your $18.00 floor')).toBeTruthy();
    expect(card.getByText('7¢/mi under your $1.00 floor')).toBeTruthy();
    expect(card.getByText('after gas')).toBeTruthy();

    expect(document.querySelector('.source-line').textContent).toContain('Using your real 29.4 mpg');
    expect(screen.getByText(/per gal · logged 2 days ago/)).toBeTruthy();
  });

  it('changing a floor changes the verdict, and floors survive a reload', () => {
    seedRealMpgLog();
    const { unmount } = renderScreen();
    type('Payout', '7.50');
    type('Miles', '5.2');
    type('Minutes', '22');
    type('Miles back to your zone', '2.0');
    type('Per hour', '15');
    type('Per mile', '0.90');
    expect(within(verdictCard()).getByText('Take it')).toBeTruthy();

    unmount();
    renderScreen();
    expect(screen.getByLabelText('Per hour').value).toBe('15');
    expect(screen.getByLabelText('Miles back to your zone').value).toBe('2.0');
    // The offer itself is per-offer and does not persist.
    expect(screen.getByLabelText('Payout').value).toBe('');
  });

  it('names the missing field instead of guessing', () => {
    renderScreen();
    type('Payout', '7.50');
    type('Miles', '5.2');
    expect(screen.getByText('Still need the minutes.')).toBeTruthy();
    expect(document.querySelector('.verdict-word')).toBeNull();
  });

  it('falls back to EPA combined and the best nearby price, and says so', () => {
    renderScreen();
    type('Payout', '12');
    type('Miles', '4.5');
    type('Minutes', '18');
    type('Miles back to your zone', '1');
    expect(within(verdictCard()).getByText('Take it')).toBeTruthy();
    const source = document.querySelector('.source-line').textContent;
    expect(source).toContain('EPA 32 mpg (combined)');
    expect(source).toContain('3 more full fill-ups to use your real mpg');
    expect(screen.getByText(/best nearby · Northgate Gas/)).toBeTruthy();
    // 5.5 mi ÷ 32 mpg × $3.19 = $0.55 of gas → $11.45 kept.
    expect(within(verdictCard()).getByText('$11.45')).toBeTruthy();
  });

  it('adds wear as its own labeled cost when turned on', () => {
    renderScreen();
    type('Payout', '12');
    type('Miles', '4.5');
    type('Minutes', '18');
    fireEvent.click(screen.getByRole('checkbox', { name: /Count wear/ }));
    expect(screen.getByText('Enter your wear cost in cents per mile, or turn wear off.')).toBeTruthy();
    type('Wear cost (cents per mile)', '10');
    expect(within(verdictCard()).getByText('after gas & wear')).toBeTruthy();
  });

  it('asks the driver to double-check an implausible number but still answers', () => {
    renderScreen();
    type('Payout', '40');
    type('Miles', '700');
    type('Minutes', '30');
    expect(screen.getByText('Double-check the miles — 700 is a lot for one offer.')).toBeTruthy();
    expect(document.querySelector('.verdict-word')).not.toBeNull();
  });

  it('lets the driver override the price for this session', () => {
    renderScreen();
    type('Payout', '7.50');
    type('Miles', '5.2');
    type('Minutes', '22');
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    type('Price per gal', '4.10');
    fireEvent.click(screen.getByRole('button', { name: 'Use it' }));
    expect(screen.getByText(/per gal · your price for now/)).toBeTruthy();
  });
});
