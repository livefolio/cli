import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { seriesAction } from './series.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockGetBatchSeries = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    market: { getBatchSeries: mockGetBatchSeries },
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

describe('seriesAction', () => {
  it('prints error and sets exit code when symbols array is empty', async () => {
    await seriesAction([]);

    expect(stderr).toBe('Error: at least one symbol is required\n');
    expect(process.exitCode).toBe(1);
    expect(mockGetBatchSeries).not.toHaveBeenCalled();
  });

  it('uppercases symbols and calls getBatchSeries', async () => {
    mockGetBatchSeries.mockResolvedValue({
      SPY: [{ timestamp: '2025-01-10T16:00:00Z', value: 590.25 }],
    });

    await seriesAction(['spy']);

    expect(mockGetBatchSeries).toHaveBeenCalledWith(['SPY']);
  });

  it('outputs CSV with header for a single symbol', async () => {
    mockGetBatchSeries.mockResolvedValue({
      SPY: [
        { timestamp: '2025-01-10T16:00:00Z', value: 590.25 },
        { timestamp: '2025-01-11T16:00:00Z', value: 592.1 },
      ],
    });

    await seriesAction(['SPY']);

    expect(stdout).toBe(
      'symbol,timestamp,price\n' +
      'SPY,2025-01-10T16:00:00Z,590.25\n' +
      'SPY,2025-01-11T16:00:00Z,592.1\n'
    );
  });

  it('outputs CSV for multiple symbols in order', async () => {
    mockGetBatchSeries.mockResolvedValue({
      SPY: [{ timestamp: '2025-01-10T16:00:00Z', value: 590.25 }],
      QQQ: [{ timestamp: '2025-01-10T16:00:00Z', value: 480.1 }],
    });

    await seriesAction(['SPY', 'QQQ']);

    expect(stdout).toBe(
      'symbol,timestamp,price\n' +
      'SPY,2025-01-10T16:00:00Z,590.25\n' +
      'QQQ,2025-01-10T16:00:00Z,480.1\n'
    );
  });

  it('outputs header only when symbol has no observations', async () => {
    mockGetBatchSeries.mockResolvedValue({ SPY: [] });

    await seriesAction(['SPY']);

    expect(stdout).toBe('symbol,timestamp,price\n');
  });

  it('handles symbol missing from batch result (defaults to empty)', async () => {
    mockGetBatchSeries.mockResolvedValue({});

    await seriesAction(['SPY']);

    expect(stdout).toBe('symbol,timestamp,price\n');
  });

  it('prints Error message to stderr on failure', async () => {
    mockGetBatchSeries.mockRejectedValue(new Error('Network timeout'));

    await seriesAction(['SPY']);

    expect(stderr).toBe('Error: Network timeout\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockGetBatchSeries.mockRejectedValue('unexpected string error');

    await seriesAction(['SPY']);

    expect(stderr).toBe('Error: unexpected string error\n');
    expect(process.exitCode).toBe(1);
  });
});
