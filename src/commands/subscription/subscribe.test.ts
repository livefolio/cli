import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeAction } from './subscribe.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockSubscribe = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    subscription: { subscribe: mockSubscribe },
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

describe('subscribeAction', () => {
  it('calls subscribe and outputs confirmation JSON', async () => {
    mockSubscribe.mockResolvedValue(undefined);

    await subscribeAction('abc123');

    expect(mockSubscribe).toHaveBeenCalledWith('abc123');
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed.status).toBe('subscribed');
    expect(parsed.strategyLinkId).toBe('abc123');
  });

  it('prints Error message to stderr on failure', async () => {
    mockSubscribe.mockRejectedValue(new Error('Authenticated user required'));

    await subscribeAction('abc123');

    expect(stderr).toBe('Error: Authenticated user required\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockSubscribe.mockRejectedValue(42);

    await subscribeAction('abc123');

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
