import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamAction } from './stream.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

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
// Tests
// ---------------------------------------------------------------------------

describe('streamAction', () => {
  it('prints error when strategy is not found', async () => {
    mockGet.mockResolvedValue(null);

    await streamAction('abc123', { symbol: 'SPY', price: '590.25' });

    expect(stderr).toBe('Error: strategy not found for link ID "abc123"\n');
    expect(process.exitCode).toBe(1);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('prints error when --symbol is missing', async () => {
    mockGet.mockResolvedValue({ linkId: 'abc123', name: 'Test' });

    await streamAction('abc123', { price: '590.25' });

    expect(stderr).toBe('Error: --symbol and --price are required for stream\n');
    expect(process.exitCode).toBe(1);
  });

  it('prints error when --price is missing', async () => {
    mockGet.mockResolvedValue({ linkId: 'abc123', name: 'Test' });

    await streamAction('abc123', { symbol: 'SPY' });

    expect(stderr).toBe('Error: --symbol and --price are required for stream\n');
    expect(process.exitCode).toBe(1);
  });

  it('prints error for invalid --price', async () => {
    mockGet.mockResolvedValue({ linkId: 'abc123', name: 'Test' });

    await streamAction('abc123', { symbol: 'SPY', price: 'abc' });

    expect(stderr).toBe('Error: invalid price "abc"\n');
    expect(process.exitCode).toBe(1);
  });

  it('prints error for invalid --timestamp', async () => {
    mockGet.mockResolvedValue({ linkId: 'abc123', name: 'Test' });

    await streamAction('abc123', { symbol: 'SPY', price: '590', timestamp: 'not-a-date' });

    expect(stderr).toBe('Error: invalid timestamp "not-a-date"\n');
    expect(process.exitCode).toBe(1);
  });

  it('evaluates stream with observation and outputs JSON', async () => {
    const strategy = { linkId: 'abc123', name: 'Test Strategy' };
    const evaluation = {
      asOf: new Date('2025-06-15T16:00:00.000Z'),
      allocation: { name: 'Default', holdings: [] },
      signals: {},
      indicators: {},
    };

    mockGet.mockResolvedValue(strategy);
    mockStream.mockResolvedValue(evaluation);

    await streamAction('abc123', {
      symbol: 'spy',
      price: '590.25',
      timestamp: '2025-06-15T16:00:00.000Z',
    });

    expect(mockGet).toHaveBeenCalledWith('abc123');
    expect(mockStream).toHaveBeenCalledWith(strategy, {
      symbol: 'SPY',
      timestamp: '2025-06-15T16:00:00.000Z',
      value: 590.25,
    });
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed.allocation.name).toBe('Default');
  });

  it('uppercases the symbol', async () => {
    const strategy = { linkId: 'abc123', name: 'Test Strategy' };
    mockGet.mockResolvedValue(strategy);
    mockStream.mockResolvedValue({ asOf: new Date(), allocation: {}, signals: {}, indicators: {} });

    await streamAction('abc123', {
      symbol: 'qqq',
      price: '480',
      timestamp: '2025-06-15T16:00:00.000Z',
    });

    expect(mockStream).toHaveBeenCalledWith(strategy, expect.objectContaining({ symbol: 'QQQ' }));
  });

  it('prints Error message to stderr on failure', async () => {
    mockGet.mockRejectedValue(new Error('Network timeout'));

    await streamAction('abc123', { symbol: 'SPY', price: '590' });

    expect(stderr).toBe('Error: Network timeout\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockGet.mockRejectedValue(42);

    await streamAction('abc123', { symbol: 'SPY', price: '590' });

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
