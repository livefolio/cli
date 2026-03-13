import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { holdingsAction } from './holdings.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockGetHoldings = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    broker: { getHoldings: mockGetHoldings },
  }),
}));

// ---------------------------------------------------------------------------
// Capture stdout / stderr
// ---------------------------------------------------------------------------

let stdout: string;
let stderr: string;
let originalExitCode: number | undefined;

beforeEach(() => {
  stdout = '';
  stderr = '';
  originalExitCode = process.exitCode;
  process.exitCode = undefined;
  vi.spyOn(console, 'log').mockImplementation((msg: string) => { stdout += msg + '\n'; });
  vi.spyOn(process.stderr, 'write').mockImplementation((msg: string) => { stderr += msg; return true; });
});

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('holdingsAction', () => {
  it('passes accountId and outputs holdings as JSON', async () => {
    const holdings = {
      positions: [{ symbol: 'SPY', units: 10, price: 590.25 }],
      balances: [{ cash: 5000 }],
    };

    mockGetHoldings.mockResolvedValue(holdings);

    await holdingsAction('acct-1');

    expect(mockGetHoldings).toHaveBeenCalledWith('acct-1');
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed.positions[0].symbol).toBe('SPY');
    expect(parsed.balances[0].cash).toBe(5000);
  });

  it('prints Error message to stderr on failure', async () => {
    mockGetHoldings.mockRejectedValue(new Error('Account not found'));

    await holdingsAction('acct-bad');

    expect(stderr).toBe('Error: Account not found\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockGetHoldings.mockRejectedValue('unexpected');

    await holdingsAction('acct-1');

    expect(stderr).toBe('Error: unexpected\n');
    expect(process.exitCode).toBe(1);
  });
});
