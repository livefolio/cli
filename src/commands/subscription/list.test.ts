import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listAction } from './list.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockList = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    subscription: { list: mockList },
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

describe('listAction', () => {
  it('outputs subscriptions as JSON on success', async () => {
    const subscriptions = [
      {
        userId: 'user-1',
        strategyId: 1,
        strategyLinkId: 'abc123',
        accountId: null,
        createdAt: '2025-06-15T12:00:00.000Z',
        updatedAt: '2025-06-15T12:00:00.000Z',
      },
    ];

    mockList.mockResolvedValue(subscriptions);

    await listAction();

    expect(mockList).toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].strategyLinkId).toBe('abc123');
  });

  it('outputs empty array when no subscriptions exist', async () => {
    mockList.mockResolvedValue([]);

    await listAction();

    const parsed = JSON.parse(stdout);
    expect(parsed).toEqual([]);
  });

  it('prints Error message to stderr on failure', async () => {
    mockList.mockRejectedValue(new Error('Authenticated user required'));

    await listAction();

    expect(stderr).toBe('Error: Authenticated user required\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockList.mockRejectedValue(42);

    await listAction();

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
