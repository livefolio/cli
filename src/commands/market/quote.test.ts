import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { quoteAction } from './quote.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockGetBatchQuotes = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    market: { getBatchQuotes: mockGetBatchQuotes },
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

describe('quoteAction', () => {
  it('prints error and sets exit code when symbols array is empty', async () => {
    await quoteAction([]);

    expect(stderr).toBe('Error: at least one symbol is required\n');
    expect(process.exitCode).toBe(1);
    expect(mockGetBatchQuotes).not.toHaveBeenCalled();
  });

  it('uppercases symbols and calls getBatchQuotes', async () => {
    mockGetBatchQuotes.mockResolvedValue({
      SPY: { timestamp: '2025-01-12T19:15:00.000Z', value: 590.25 },
    });

    await quoteAction(['spy']);

    expect(mockGetBatchQuotes).toHaveBeenCalledWith(['SPY']);
  });

  it('outputs CSV with header for a single symbol', async () => {
    mockGetBatchQuotes.mockResolvedValue({
      SPY: { timestamp: '2025-01-12T19:15:00.000Z', value: 590.25 },
    });

    await quoteAction(['SPY']);

    expect(stdout).toBe(
      'symbol,timestamp,price\n' +
      'SPY,2025-01-12T19:15:00.000Z,590.25\n'
    );
  });

  it('outputs CSV for multiple symbols in order', async () => {
    mockGetBatchQuotes.mockResolvedValue({
      SPY: { timestamp: '2025-01-12T19:15:00.000Z', value: 590.25 },
      QQQ: { timestamp: '2025-01-12T19:15:00.000Z', value: 480.1 },
    });

    await quoteAction(['SPY', 'QQQ']);

    expect(stdout).toBe(
      'symbol,timestamp,price\n' +
      'SPY,2025-01-12T19:15:00.000Z,590.25\n' +
      'QQQ,2025-01-12T19:15:00.000Z,480.1\n'
    );
  });

  it('omits row when symbol is missing from result', async () => {
    mockGetBatchQuotes.mockResolvedValue({
      SPY: { timestamp: '2025-01-12T19:15:00.000Z', value: 590.25 },
    });

    await quoteAction(['SPY', 'INVALID']);

    expect(stdout).toBe(
      'symbol,timestamp,price\n' +
      'SPY,2025-01-12T19:15:00.000Z,590.25\n'
    );
  });

  it('outputs header only when result is empty', async () => {
    mockGetBatchQuotes.mockResolvedValue({});

    await quoteAction(['SPY']);

    expect(stdout).toBe('symbol,timestamp,price\n');
  });

  it('prints Error message to stderr on failure', async () => {
    mockGetBatchQuotes.mockRejectedValue(new Error('Function invocation failed'));

    await quoteAction(['SPY']);

    expect(stderr).toBe('Error: Function invocation failed\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockGetBatchQuotes.mockRejectedValue(42);

    await quoteAction(['SPY']);

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
