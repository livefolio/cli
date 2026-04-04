import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { statusAction } from './status.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockList = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    autodeploy: { list: mockList },
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

describe('statusAction', () => {
  it('outputs auto-deploy configurations as JSON', async () => {
    const deploys = [
      {
        userId: 'user-1',
        strategyId: 1,
        strategyLinkId: 'abc123',
        accountId: 'acct-1',
        waitlisted: false,
        createdAt: '2025-06-15T12:00:00.000Z',
        updatedAt: '2025-06-15T12:00:00.000Z',
      },
    ];

    mockList.mockResolvedValue(deploys);

    await statusAction();

    expect(mockList).toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].strategyLinkId).toBe('abc123');
    expect(parsed[0].accountId).toBe('acct-1');
  });

  it('outputs empty array when no deploys exist', async () => {
    mockList.mockResolvedValue([]);

    await statusAction();

    const parsed = JSON.parse(stdout);
    expect(parsed).toEqual([]);
  });

  it('prints Error message to stderr on failure', async () => {
    mockList.mockRejectedValue(new Error('AutoDeployModule requires a userId'));

    await statusAction();

    expect(stderr).toBe('Error: AutoDeployModule requires a userId\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockList.mockRejectedValue(42);

    await statusAction();

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
