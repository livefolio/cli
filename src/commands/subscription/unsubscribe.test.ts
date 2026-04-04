import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { unsubscribeAction } from './unsubscribe.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockUnsubscribe = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    subscription: { unsubscribe: mockUnsubscribe },
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

describe('unsubscribeAction', () => {
  it('calls unsubscribe and outputs confirmation JSON', async () => {
    mockUnsubscribe.mockResolvedValue(undefined);

    await unsubscribeAction('abc123');

    expect(mockUnsubscribe).toHaveBeenCalledWith('abc123');
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed.status).toBe('unsubscribed');
    expect(parsed.strategyLinkId).toBe('abc123');
  });

  it('prints Error message to stderr on failure', async () => {
    mockUnsubscribe.mockRejectedValue(new Error('Authenticated user required'));

    await unsubscribeAction('abc123');

    expect(stderr).toBe('Error: Authenticated user required\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockUnsubscribe.mockRejectedValue('bad');

    await unsubscribeAction('abc123');

    expect(stderr).toBe('Error: bad\n');
    expect(process.exitCode).toBe(1);
  });
});
