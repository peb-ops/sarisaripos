import { describe, expect, it } from 'vitest';
import { formatPeso, parsePeso, pesoInputValue } from './money';

describe('formatPeso', () => {
  it('formats centavos as pesos', () => {
    expect(formatPeso(0)).toBe('₱0.00');
    expect(formatPeso(1050)).toBe('₱10.50');
    expect(formatPeso(123456789)).toBe('₱1,234,567.89');
    expect(formatPeso(-500)).toBe('-₱5.00');
  });

  it('rounds fractional centavos', () => {
    expect(formatPeso(824.6)).toBe('₱8.25');
  });
});

describe('parsePeso', () => {
  it('parses typed amounts', () => {
    expect(parsePeso('45')).toBe(4500);
    expect(parsePeso('45.5')).toBe(4550);
    expect(parsePeso('45.05')).toBe(4505);
    expect(parsePeso('₱1,200.00')).toBe(120000);
    expect(parsePeso(' 20 ')).toBe(2000);
    expect(parsePeso('.5')).toBe(50);
  });

  it('avoids floating point errors', () => {
    expect(parsePeso('0.29')).toBe(29);
    expect(parsePeso('1.15')).toBe(115);
  });

  it('rejects invalid input', () => {
    expect(parsePeso('')).toBeNull();
    expect(parsePeso('abc')).toBeNull();
    expect(parsePeso('-5')).toBeNull();
    expect(parsePeso('1.234')).toBeNull();
    expect(parsePeso('1.2.3')).toBeNull();
  });
});

describe('pesoInputValue', () => {
  it('round-trips with parsePeso', () => {
    for (const c of [0, 100, 1050, 1005, 18000]) expect(parsePeso(pesoInputValue(c))).toBe(c);
    expect(pesoInputValue(18000)).toBe('180');
    expect(pesoInputValue(1050)).toBe('10.50');
  });
});
