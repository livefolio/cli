import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { connectAction } from './connect.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockGetConnectionUrl = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    broker: { getConnectionUrl: mockGetConnectionUrl },
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

describe('connectAction', () => {
  it('outputs connection portal URL on success', async () => {
    mockGetConnectionUrl.mockResolvedValue('https://portal.snaptrade.com/connect?token=abc');

    await connectAction({});

    expect(mockGetConnectionUrl).toHaveBeenCalledWith({
      customRedirect: 'https://app.livefolio.dev/broker/callback',
    });
    expect(process.exitCode).toBeUndefined();
    expect(stdout.trim()).toBe('https://portal.snaptrade.com/connect?token=abc');
  });

  it('uses custom redirect URL when provided', async () => {
    mockGetConnectionUrl.mockResolvedValue('https://portal.snaptrade.com/connect?token=def');

    await connectAction({ redirect: 'https://example.com/callback' });

    expect(mockGetConnectionUrl).toHaveBeenCalledWith({
      customRedirect: 'https://example.com/callback',
    });
  });

  it('prints error when URL is null', async () => {
    mockGetConnectionUrl.mockResolvedValue(null);

    await connectAction({});

    expect(stderr).toBe('Error: could not generate connection portal URL\n');
    expect(process.exitCode).toBe(1);
  });

  it('prints Error message to stderr on failure', async () => {
    mockGetConnectionUrl.mockRejectedValue(new Error('BrokerModule requires a userId'));

    await connectAction({});

    expect(stderr).toBe('Error: BrokerModule requires a userId\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockGetConnectionUrl.mockRejectedValue(42);

    await connectAction({});

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
