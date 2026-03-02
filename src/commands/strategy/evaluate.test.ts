import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { evaluateAction } from './evaluate.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockEvaluate = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    strategy: { get: mockGet, evaluate: mockEvaluate },
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

describe('evaluateAction', () => {
  it('prints error and sets exit code when strategy is not found', async () => {
    mockGet.mockResolvedValue(null);

    await evaluateAction('abc123');

    expect(mockGet).toHaveBeenCalledWith('abc123');
    expect(stderr).toBe('Error: strategy not found for link ID "abc123"\n');
    expect(process.exitCode).toBe(1);
    expect(mockEvaluate).not.toHaveBeenCalled();
  });

  it('outputs JSON with allocation, signals, indicators, and evaluatedAt on success', async () => {
    const strategy = { linkId: 'abc123', name: 'Test Strategy' };
    const evaluation = {
      evaluatedAt: new Date('2025-06-15T12:00:00.000Z'),
      allocation: { name: 'Default', holdings: [{ ticker: { symbol: 'SPY', leverage: 1 }, weight: 1 }] },
      signals: { 'SMA > EMA': true },
      indicators: { SMA: { timestamp: '2025-06-15', value: 450.5 } },
    };

    mockGet.mockResolvedValue(strategy);
    mockEvaluate.mockResolvedValue(evaluation);

    await evaluateAction('abc123');

    expect(mockGet).toHaveBeenCalledWith('abc123');
    expect(mockEvaluate).toHaveBeenCalledWith(strategy, expect.any(Date));
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed.evaluatedAt).toBe('2025-06-15T12:00:00.000Z');
    expect(parsed.allocation.name).toBe('Default');
    expect(parsed.signals['SMA > EMA']).toBe(true);
    expect(parsed.indicators.SMA.value).toBe(450.5);
  });

  it('prints Error message to stderr on failure', async () => {
    mockGet.mockRejectedValue(new Error('Network timeout'));

    await evaluateAction('abc123');

    expect(stderr).toBe('Error: Network timeout\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockGet.mockRejectedValue(42);

    await evaluateAction('abc123');

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
