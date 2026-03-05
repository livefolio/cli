import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { symbolsAction } from './symbols.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockExtractSymbols = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    strategy: { get: mockGet, extractSymbols: mockExtractSymbols },
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

describe('symbolsAction', () => {
  it('prints error and sets exit code when strategy is not found', async () => {
    mockGet.mockResolvedValue(null);

    await symbolsAction('abc123');

    expect(mockGet).toHaveBeenCalledWith('abc123');
    expect(stderr).toBe('Error: strategy not found for link ID "abc123"\n');
    expect(process.exitCode).toBe(1);
  });

  it('outputs one symbol per line on success', async () => {
    const strategy = { linkId: 'abc123', name: 'Test' };
    mockGet.mockResolvedValue(strategy);
    mockExtractSymbols.mockReturnValue(['SPY', 'QQQ', 'TLT']);

    await symbolsAction('abc123');

    expect(mockGet).toHaveBeenCalledWith('abc123');
    expect(mockExtractSymbols).toHaveBeenCalledWith(strategy);
    expect(process.exitCode).toBeUndefined();
    expect(stdout).toBe('SPY\nQQQ\nTLT\n');
  });

  it('prints Error message to stderr on failure', async () => {
    mockGet.mockRejectedValue(new Error('Network timeout'));

    await symbolsAction('abc123');

    expect(stderr).toBe('Error: Network timeout\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockGet.mockRejectedValue(42);

    await symbolsAction('abc123');

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
