import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamAction, parseCsvObservations } from './stream.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReadStdin = vi.fn();
vi.mock('../../lib/stdin.js', () => ({
  readStdin: () => mockReadStdin(),
}));

const mockGet = vi.fn();
const mockStream = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    strategy: { get: mockGet, stream: mockStream },
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
  mockReadStdin.mockReset();
  mockGet.mockReset();
  mockStream.mockReset();
  vi.spyOn(console, 'log').mockImplementation((msg: string) => { stdout += msg + '\n'; });
  vi.spyOn(process.stderr, 'write').mockImplementation((msg: string) => { stderr += msg; return true; });
});

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// parseCsvObservations unit tests
// ---------------------------------------------------------------------------

describe('parseCsvObservations', () => {
  it('parses valid CSV with header', () => {
    const csv = 'symbol,timestamp,price\nSPY,2025-01-10T19:30:00Z,602.5\nBND,2025-01-10T19:30:00Z,71.2';
    const obs = parseCsvObservations(csv);
    expect(obs).toEqual([
      { symbol: 'SPY', timestamp: '2025-01-10T19:30:00Z', value: 602.5 },
      { symbol: 'BND', timestamp: '2025-01-10T19:30:00Z', value: 71.2 },
    ]);
  });

  it('parses valid CSV without header', () => {
    const csv = 'SPY,2025-01-10T19:30:00Z,602.5';
    const obs = parseCsvObservations(csv);
    expect(obs).toEqual([
      { symbol: 'SPY', timestamp: '2025-01-10T19:30:00Z', value: 602.5 },
    ]);
  });

  it('throws on empty input', () => {
    expect(() => parseCsvObservations('')).toThrow('no data rows');
  });

  it('throws on header-only CSV', () => {
    expect(() => parseCsvObservations('symbol,timestamp,price')).toThrow('no data rows');
  });

  it('throws on wrong number of fields', () => {
    expect(() => parseCsvObservations('SPY,2025-01-10T19:30:00Z')).toThrow('expected 3 fields, got 2');
  });

  it('throws on non-numeric price', () => {
    expect(() => parseCsvObservations('SPY,2025-01-10T19:30:00Z,abc')).toThrow('not a number');
  });
});

// ---------------------------------------------------------------------------
// streamAction integration tests
// ---------------------------------------------------------------------------

describe('streamAction', () => {
  it('outputs JSON evaluation on success', async () => {
    const csv = 'symbol,timestamp,price\nSPY,2025-01-10T19:30:00Z,602.5';
    mockReadStdin.mockResolvedValue(csv);

    const strategy = { linkId: 'abc-123', name: 'Test' };
    mockGet.mockResolvedValue(strategy);

    const evaluation = {
      asOf: '2025-01-10T19:30:00.000Z',
      allocation: { name: 'Default', holdings: [] },
      signals: {},
      indicators: {},
    };
    mockStream.mockResolvedValue(evaluation);

    await streamAction('abc-123');

    expect(mockGet).toHaveBeenCalledWith('abc-123');
    expect(mockStream).toHaveBeenCalledWith(strategy, [
      { symbol: 'SPY', timestamp: '2025-01-10T19:30:00Z', value: 602.5 },
    ]);
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed.allocation.name).toBe('Default');
  });

  it('prints error when strategy is not found', async () => {
    mockReadStdin.mockResolvedValue('SPY,2025-01-10T19:30:00Z,602.5');
    mockGet.mockResolvedValue(null);

    await streamAction('abc-123');

    expect(stderr).toBe('Error: strategy not found for link ID "abc-123"\n');
    expect(process.exitCode).toBe(1);
  });

  it('prints error on empty stdin', async () => {
    mockReadStdin.mockResolvedValue('');

    await streamAction('abc-123');

    expect(stderr).toContain('no data rows');
    expect(process.exitCode).toBe(1);
  });

  it('prints error on malformed CSV row', async () => {
    mockReadStdin.mockResolvedValue('SPY,2025-01-10T19:30:00Z');

    await streamAction('abc-123');

    expect(stderr).toContain('expected 3 fields');
    expect(process.exitCode).toBe(1);
  });

  it('prints error on non-numeric price', async () => {
    mockReadStdin.mockResolvedValue('SPY,2025-01-10T19:30:00Z,abc');

    await streamAction('abc-123');

    expect(stderr).toContain('not a number');
    expect(process.exitCode).toBe(1);
  });

  it('prints error on header-only CSV', async () => {
    mockReadStdin.mockResolvedValue('symbol,timestamp,price');

    await streamAction('abc-123');

    expect(stderr).toContain('no data rows');
    expect(process.exitCode).toBe(1);
  });

  it('prints Error message to stderr on failure', async () => {
    mockReadStdin.mockResolvedValue('SPY,2025-01-10T19:30:00Z,602.5');
    mockGet.mockRejectedValue(new Error('Network timeout'));

    await streamAction('abc-123');

    expect(stderr).toBe('Error: Network timeout\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockReadStdin.mockResolvedValue('SPY,2025-01-10T19:30:00Z,602.5');
    mockGet.mockRejectedValue(42);

    await streamAction('abc-123');

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
