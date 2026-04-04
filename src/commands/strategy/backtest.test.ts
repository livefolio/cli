import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { backtestAction } from './backtest.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockBacktest = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    strategy: { get: mockGet, backtest: mockBacktest },
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
  mockGet.mockReset();
  mockBacktest.mockReset();
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

describe('backtestAction', () => {
  it('prints error when strategy is not found', async () => {
    mockGet.mockResolvedValue(null);

    await backtestAction('abc123', {});

    expect(mockGet).toHaveBeenCalledWith('abc123');
    expect(stderr).toBe('Error: strategy not found for link ID "abc123"\n');
    expect(process.exitCode).toBe(1);
    expect(mockBacktest).not.toHaveBeenCalled();
  });

  it('runs backtest with default dates and outputs JSON', async () => {
    const strategy = { linkId: 'abc123', name: 'Test Strategy' };
    const result = {
      summary: { totalReturnPct: 25.5, cagrPct: 12.3, maxDrawdownPct: -8.2 },
      timeseries: { dates: ['2020-01-01'], portfolio: [10000] },
      trades: [],
      annualTax: [],
    };

    mockGet.mockResolvedValue(strategy);
    mockBacktest.mockResolvedValue(result);

    await backtestAction('abc123', {});

    expect(mockGet).toHaveBeenCalledWith('abc123');
    expect(mockBacktest).toHaveBeenCalledWith(strategy, {
      startDate: '2020-01-01',
      endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed.summary.totalReturnPct).toBe(25.5);
  });

  it('passes --start and --end options', async () => {
    const strategy = { linkId: 'abc123', name: 'Test Strategy' };
    const result = { summary: {}, timeseries: {}, trades: [], annualTax: [] };

    mockGet.mockResolvedValue(strategy);
    mockBacktest.mockResolvedValue(result);

    await backtestAction('abc123', { start: '2022-01-01', end: '2023-12-31' });

    expect(mockBacktest).toHaveBeenCalledWith(strategy, {
      startDate: '2022-01-01',
      endDate: '2023-12-31',
    });
  });

  it('prints error for invalid --start date', async () => {
    const strategy = { linkId: 'abc123', name: 'Test Strategy' };
    mockGet.mockResolvedValue(strategy);

    await backtestAction('abc123', { start: 'not-a-date' });

    expect(stderr).toBe('Error: invalid start date "not-a-date"\n');
    expect(process.exitCode).toBe(1);
    expect(mockBacktest).not.toHaveBeenCalled();
  });

  it('prints error for invalid --end date', async () => {
    const strategy = { linkId: 'abc123', name: 'Test Strategy' };
    mockGet.mockResolvedValue(strategy);

    await backtestAction('abc123', { end: 'not-a-date' });

    expect(stderr).toBe('Error: invalid end date "not-a-date"\n');
    expect(process.exitCode).toBe(1);
    expect(mockBacktest).not.toHaveBeenCalled();
  });

  it('prints Error message to stderr on failure', async () => {
    mockGet.mockRejectedValue(new Error('Network timeout'));

    await backtestAction('abc123', {});

    expect(stderr).toBe('Error: Network timeout\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockGet.mockRejectedValue(42);

    await backtestAction('abc123', {});

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
