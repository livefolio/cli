import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable } from 'node:stream';
import { streamAction } from './stream.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockCreateStreamer = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    strategy: { get: mockGet, createStreamer: mockCreateStreamer },
  }),
}));

// ---------------------------------------------------------------------------
// Capture stdout / stderr
// ---------------------------------------------------------------------------

let stdout: string;
let stderr: string;
let originalExitCode: number | undefined;
let originalStdin: typeof process.stdin;

beforeEach(() => {
  stdout = '';
  stderr = '';
  originalExitCode = process.exitCode;
  originalStdin = process.stdin;
  process.exitCode = undefined;
  mockGet.mockReset();
  mockCreateStreamer.mockReset();
  vi.spyOn(console, 'log').mockImplementation((msg: string) => { stdout += msg + '\n'; });
  vi.spyOn(process.stderr, 'write').mockImplementation((msg: string) => { stderr += msg; return true; });
});

afterEach(() => {
  process.exitCode = originalExitCode;
  Object.defineProperty(process, 'stdin', { value: originalStdin, writable: true });
  vi.restoreAllMocks();
});

function setStdin(lines: string[]) {
  const readable = Readable.from(lines.map(l => l + '\n'));
  Object.defineProperty(process, 'stdin', { value: readable, writable: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('streamAction', () => {
  it('prints error and sets exit code when strategy is not found', async () => {
    mockGet.mockResolvedValue(null);
    setStdin([]);

    await streamAction('abc123');

    expect(mockGet).toHaveBeenCalledWith('abc123');
    expect(stderr).toBe('Error: strategy not found for link ID "abc123"\n');
    expect(process.exitCode).toBe(1);
    expect(mockCreateStreamer).not.toHaveBeenCalled();
  });

  it('reads JSONL from stdin and writes evaluation JSONL to stdout', async () => {
    const strategy = { linkId: 'abc123', name: 'Test Strategy' };
    const evaluation = {
      asOf: '2025-01-10T19:30:00.000Z',
      allocation: { name: 'Aggressive', holdings: [] },
      signals: { 'SPY > SMA': true },
      indicators: {},
    };

    const mockUpdate = vi.fn().mockReturnValue(evaluation);
    mockGet.mockResolvedValue(strategy);
    mockCreateStreamer.mockResolvedValue({ update: mockUpdate });

    setStdin([
      '{"symbol":"SPY","timestamp":"2025-01-10T19:30:00Z","value":110}',
    ]);

    await streamAction('abc123');

    expect(mockGet).toHaveBeenCalledWith('abc123');
    expect(mockCreateStreamer).toHaveBeenCalledWith(strategy);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      symbol: 'SPY',
      timestamp: '2025-01-10T19:30:00Z',
      value: 110,
    });

    const parsed = JSON.parse(stdout.trim());
    expect(parsed.allocation.name).toBe('Aggressive');
  });

  it('handles multiple stdin lines', async () => {
    const strategy = { linkId: 'abc123', name: 'Test Strategy' };
    const evaluation1 = { asOf: '2025-01-10T19:30:00Z', allocation: { name: 'A' }, signals: {}, indicators: {} };
    const evaluation2 = { asOf: '2025-01-10T19:35:00Z', allocation: { name: 'B' }, signals: {}, indicators: {} };

    const mockUpdate = vi.fn()
      .mockReturnValueOnce(evaluation1)
      .mockReturnValueOnce(evaluation2);
    mockGet.mockResolvedValue(strategy);
    mockCreateStreamer.mockResolvedValue({ update: mockUpdate });

    setStdin([
      '{"symbol":"SPY","timestamp":"2025-01-10T19:30:00Z","value":110}',
      '{"symbol":"SPY","timestamp":"2025-01-10T19:35:00Z","value":111}',
    ]);

    await streamAction('abc123');

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).allocation.name).toBe('A');
    expect(JSON.parse(lines[1]).allocation.name).toBe('B');
  });

  it('skips blank lines in stdin', async () => {
    const strategy = { linkId: 'abc123', name: 'Test Strategy' };
    const evaluation = { asOf: '2025-01-10T19:30:00Z', allocation: { name: 'A' }, signals: {}, indicators: {} };

    const mockUpdate = vi.fn().mockReturnValue(evaluation);
    mockGet.mockResolvedValue(strategy);
    mockCreateStreamer.mockResolvedValue({ update: mockUpdate });

    setStdin([
      '',
      '{"symbol":"SPY","timestamp":"2025-01-10T19:30:00Z","value":110}',
      '  ',
    ]);

    await streamAction('abc123');

    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('writes per-line errors to stderr without crashing', async () => {
    const strategy = { linkId: 'abc123', name: 'Test Strategy' };
    const mockUpdate = vi.fn().mockImplementation(() => { throw new Error('bad observation'); });
    mockGet.mockResolvedValue(strategy);
    mockCreateStreamer.mockResolvedValue({ update: mockUpdate });

    setStdin([
      '{"symbol":"SPY","timestamp":"2025-01-10T19:30:00Z","value":110}',
    ]);

    await streamAction('abc123');

    expect(stderr).toContain('Error: bad observation');
    // Should NOT set exitCode for per-line errors
    expect(process.exitCode).toBeUndefined();
  });

  it('handles invalid JSON on stdin gracefully', async () => {
    const strategy = { linkId: 'abc123', name: 'Test Strategy' };
    const mockUpdate = vi.fn();
    mockGet.mockResolvedValue(strategy);
    mockCreateStreamer.mockResolvedValue({ update: mockUpdate });

    setStdin(['not-json']);

    await streamAction('abc123');

    expect(stderr).toContain('Error:');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('prints Error message to stderr on top-level failure', async () => {
    mockGet.mockRejectedValue(new Error('Network timeout'));
    setStdin([]);

    await streamAction('abc123');

    expect(stderr).toBe('Error: Network timeout\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockGet.mockRejectedValue(42);
    setStdin([]);

    await streamAction('abc123');

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });

  it('produces no output on empty stdin', async () => {
    const strategy = { linkId: 'abc123', name: 'Test Strategy' };
    const mockUpdate = vi.fn();
    mockGet.mockResolvedValue(strategy);
    mockCreateStreamer.mockResolvedValue({ update: mockUpdate });

    setStdin([]);

    await streamAction('abc123');

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(stdout).toBe('');
    expect(process.exitCode).toBeUndefined();
  });
});
