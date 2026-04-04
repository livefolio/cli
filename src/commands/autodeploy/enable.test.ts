import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enableAction } from './enable.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockEnable = vi.fn();
const mockSingle = vi.fn();

function createQueryBuilder() {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.single = mockSingle;
  return builder;
}

const mockFrom = vi.fn(() => createQueryBuilder());

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    strategy: { get: mockGet },
    autodeploy: { enable: mockEnable },
    supabase: { from: mockFrom },
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
  mockEnable.mockReset();
  mockSingle.mockReset();
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

describe('enableAction', () => {
  it('resolves linkId, calls enable, and outputs confirmation', async () => {
    mockGet.mockResolvedValue({ linkId: 'abc123', name: 'Test' });
    mockSingle.mockResolvedValue({ data: { id: 42 } });
    mockEnable.mockResolvedValue(undefined);

    await enableAction('abc123', 'acct-1');

    expect(mockGet).toHaveBeenCalledWith('abc123');
    expect(mockEnable).toHaveBeenCalledWith(42, 'acct-1');
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed.status).toBe('enabled');
    expect(parsed.strategyLinkId).toBe('abc123');
    expect(parsed.accountId).toBe('acct-1');
  });

  it('prints error when strategy.get returns null', async () => {
    mockGet.mockResolvedValue(null);

    await enableAction('bad-id', 'acct-1');

    expect(stderr).toBe('Error: strategy not found for link ID "bad-id"\n');
    expect(process.exitCode).toBe(1);
    expect(mockEnable).not.toHaveBeenCalled();
  });

  it('prints error when supabase lookup returns null', async () => {
    mockGet.mockResolvedValue({ linkId: 'abc123', name: 'Test' });
    mockSingle.mockResolvedValue({ data: null });

    await enableAction('abc123', 'acct-1');

    expect(stderr).toBe('Error: strategy not found for link ID "abc123"\n');
    expect(process.exitCode).toBe(1);
    expect(mockEnable).not.toHaveBeenCalled();
  });

  it('prints Error message to stderr on failure', async () => {
    mockGet.mockRejectedValue(new Error('Network timeout'));

    await enableAction('abc123', 'acct-1');

    expect(stderr).toBe('Error: Network timeout\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockGet.mockRejectedValue(42);

    await enableAction('abc123', 'acct-1');

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
