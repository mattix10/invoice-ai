import { formatVatRate, lineNet } from './intake-money';

describe('lineNet', () => {
  it('calculates invoice line net without floating point rounding', () => {
    expect(lineNet({ position: 1, name: 'Item', quantity: 10, unitNet: '820.00' })).toBe('8200.00');
    expect(lineNet({ position: 2, name: 'Item', quantity: 3, unitNet: '0.11' })).toBe('0.33');
  });

  it('does not present a total for an incomplete line', () => {
    expect(lineNet({ position: 1, name: null, quantity: null, unitNet: null })).toBe('—');
  });
});

describe('formatVatRate', () => {
  it('formats decimal VAT rates as percentages without changing the stored value', () => {
    expect(formatVatRate('0.23')).toBe('23%');
    expect(formatVatRate('0.0550')).toBe('5.5%');
    expect(formatVatRate('0')).toBe('0%');
  });

  it('does not present invalid or missing rates as percentages', () => {
    expect(formatVatRate(null)).toBe('—');
    expect(formatVatRate('1.2')).toBe('—');
  });
});
