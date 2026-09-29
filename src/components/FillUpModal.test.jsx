// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FillUpModal from './FillUpModal';

const camry = { id: 'v1', make: 'Toyota', model: 'Camry', fuelKind: 'gas', combinedMpg: 32, tankSizeGallons: 15.8 };

const existing = [
  { id: 'a', date: '2026-09-01', odometer: 45000, units: 11, pricePerUnit: 3.25, fullTank: true },
  { id: 'b', date: '2026-09-08', odometer: 45320, units: 10.2, pricePerUnit: 3.29, fullTank: true },
];

function renderModal(onSave = vi.fn((entry) => ({ id: 'new', ...entry }))) {
  render(<FillUpModal vehicle={camry} existingFillUps={existing} onSave={onSave} onClose={() => {}} />);
  return onSave;
}

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

afterEach(cleanup);

describe('FillUpModal', () => {
  it('refuses an odometer lower than the last fill-up and says why', () => {
    const onSave = renderModal();
    type('Price per gallon', '3.29');
    type('Gallons', '10');
    type('Odometer', '4565');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText("That's lower than your last fill-up (45,320). Typo?")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves a good full fill and reports real MPG once 3 full tanks exist', () => {
    const onSave = renderModal();
    type('Price per gallon', '3.29');
    type('Gallons', '11');
    type('Odometer', '45650');
    type('Date', '2026-09-16');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({
      date: '2026-09-16',
      odometer: 45650,
      units: 11,
      pricePerUnit: 3.29,
      fullTank: true,
    });
    // (320 + 330) ÷ (10.2 + 11) = 30.7
    expect(screen.getByText('Your Camry is getting 30.7 mpg — rated 32 mpg.')).toBeTruthy();
  });

  it('warns once about a gap longer than a tank, then saves on the second tap', () => {
    const onSave = renderModal();
    type('Price per gallon', '3.29');
    type('Gallons', '11');
    type('Odometer', '456500');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/411,180 miles since your last fill-up/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save anyway' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Left out of your real MPG/)).toBeTruthy();
  });

  it('logs a partial fill and explains what it counts toward', () => {
    renderModal();
    type('Price per gallon', '3.19');
    type('Gallons', '5');
    type('Odometer', '45500');
    fireEvent.click(screen.getByRole('checkbox', { name: /Filled it all the way up/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText("Partial fill — it'll count toward your next full tank.")).toBeTruthy();
  });
});
