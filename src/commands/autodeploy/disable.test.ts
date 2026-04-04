import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { disableAction } from './disable.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockDisable = vi.fn();
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
    autodeploy: { disable: mockDisable },
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
  mockDisable.mockReset();
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

describe('disableAction', () => {
  it('resolves linkId, calls disable, and outputs confirmation', async () => {
    mockSingle.mockResolvedValue({ data: { id: 42 } });
    mockDisable.mockResolvedValue(undefined);

    await disableAction('abc123');

    expect(mockDisable).toHaveBeenCalledWith(42);
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed.status).toBe('disabled');
    expect(parsed.strategyLinkId).toBe('abc123');
  });

  it('prints error when supabase lookup returns null', async () => {
    mockSingle.mockResolvedValue({ data: null });

    await disableAction('bad-id');

    expect(stderr).toBe('Error: strategy not found for link ID "bad-id"\n');
    expect(process.exitCode).toBe(1);
    expect(mockDisable).not.toHaveBeenCalled();
  });

  it('prints Error message to stderr on failure', async () => {
    mockSingle.mockRejectedValue(new Error('Network timeout'));

    await disableAction('abc123');

    expect(stderr).toBe('Error: Network timeout\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockSingle.mockRejectedValue(42);

    await disableAction('abc123');

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
