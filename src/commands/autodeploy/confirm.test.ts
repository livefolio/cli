import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { confirmAction } from './confirm.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockConfirmBatch = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    autodeploy: { confirmBatch: mockConfirmBatch },
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

describe('confirmAction', () => {
  it('calls confirmBatch and outputs results as JSON', async () => {
    const resultsMap = new Map<number, { snaptradeOrderId: string }>([
      [1, { snaptradeOrderId: 'st-1' }],
      [2, { snaptradeOrderId: 'st-2' }],
    ]);
    mockConfirmBatch.mockResolvedValue({ results: resultsMap });

    await confirmAction('batch-1');

    expect(mockConfirmBatch).toHaveBeenCalledWith('batch-1');
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed.batchId).toBe('batch-1');
    expect(parsed.results['1'].snaptradeOrderId).toBe('st-1');
    expect(parsed.results['2'].snaptradeOrderId).toBe('st-2');
  });

  it('outputs empty results when batch has no orders', async () => {
    mockConfirmBatch.mockResolvedValue({ results: new Map() });

    await confirmAction('batch-empty');

    const parsed = JSON.parse(stdout);
    expect(parsed.batchId).toBe('batch-empty');
    expect(parsed.results).toEqual({});
  });

  it('prints Error message to stderr on failure', async () => {
    mockConfirmBatch.mockRejectedValue(new Error('AutoDeployModule requires a userId'));

    await confirmAction('batch-1');

    expect(stderr).toBe('Error: AutoDeployModule requires a userId\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockConfirmBatch.mockRejectedValue(42);

    await confirmAction('batch-1');

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
