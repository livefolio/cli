import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAction } from './get.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockGet = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    strategy: { get: mockGet },
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

describe('getAction', () => {
  it('prints error and sets exit code when strategy is not found', async () => {
    mockGet.mockResolvedValue(null);

    await getAction('abc123');

    expect(mockGet).toHaveBeenCalledWith('abc123');
    expect(stderr).toBe('Error: strategy not found for link ID "abc123"\n');
    expect(process.exitCode).toBe(1);
  });

  it('outputs strategy as JSON on success', async () => {
    const strategy = {
      linkId: 'abc123',
      name: 'Test Strategy',
      signals: [{ name: 'SMA > EMA' }],
      allocations: [{ name: 'Default', holdings: [{ ticker: { symbol: 'SPY', leverage: 1 }, weight: 1 }] }],
    };

    mockGet.mockResolvedValue(strategy);

    await getAction('abc123');

    expect(mockGet).toHaveBeenCalledWith('abc123');
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed.linkId).toBe('abc123');
    expect(parsed.name).toBe('Test Strategy');
    expect(parsed.signals).toHaveLength(1);
    expect(parsed.allocations[0].name).toBe('Default');
  });

  it('prints Error message to stderr on failure', async () => {
    mockGet.mockRejectedValue(new Error('Network timeout'));

    await getAction('abc123');

    expect(stderr).toBe('Error: Network timeout\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockGet.mockRejectedValue(42);

    await getAction('abc123');

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
