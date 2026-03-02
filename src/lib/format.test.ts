import { describe, it, expect } from 'vitest';
import { formatObservations } from './format.js';

describe('formatObservations', () => {
  it('formats observations as CSV with symbol,timestamp,price header', () => {
    const data = {
      SPY: [
        { timestamp: '2025-01-10T16:00:00Z', value: 590.25 },
        { timestamp: '2025-01-11T16:00:00Z', value: 592.1 },
      ],
    };

    const result = formatObservations(data, ['SPY']);

    expect(result).toBe(
      'symbol,timestamp,price\n' +
      'SPY,2025-01-10T16:00:00Z,590.25\n' +
      'SPY,2025-01-11T16:00:00Z,592.1'
    );
  });

  it('returns header only when observations array is empty', () => {
    const result = formatObservations({ SPY: [] }, ['SPY']);

    expect(result).toBe('symbol,timestamp,price');
  });

  it('returns header only when symbol is missing from data', () => {
    const result = formatObservations({}, ['SPY']);

    expect(result).toBe('symbol,timestamp,price');
  });

  it('interleaves multiple symbols in the requested order', () => {
    const data = {
      SPY: [{ timestamp: '2025-01-10T16:00:00Z', value: 590.25 }],
      QQQ: [{ timestamp: '2025-01-10T16:00:00Z', value: 480.1 }],
    };

    const result = formatObservations(data, ['QQQ', 'SPY']);

    expect(result).toBe(
      'symbol,timestamp,price\n' +
      'QQQ,2025-01-10T16:00:00Z,480.1\n' +
      'SPY,2025-01-10T16:00:00Z,590.25'
    );
  });
});
