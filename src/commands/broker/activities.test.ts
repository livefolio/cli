import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { activitiesAction } from './activities.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockListActivities = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    broker: { listActivities: mockListActivities },
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

describe('activitiesAction', () => {
  it('passes accountId and outputs activities as JSON', async () => {
    const activities = [
      { type: 'DIVIDEND', symbol: 'SPY', amount: 1.25, date: '2025-06-15' },
    ];

    mockListActivities.mockResolvedValue(activities);

    await activitiesAction('acct-1');

    expect(mockListActivities).toHaveBeenCalledWith('acct-1');
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe('DIVIDEND');
  });

  it('outputs empty array when no activities exist', async () => {
    mockListActivities.mockResolvedValue([]);

    await activitiesAction('acct-1');

    const parsed = JSON.parse(stdout);
    expect(parsed).toEqual([]);
  });

  it('prints Error message to stderr on failure', async () => {
    mockListActivities.mockRejectedValue(new Error('Network timeout'));

    await activitiesAction('acct-1');

    expect(stderr).toBe('Error: Network timeout\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockListActivities.mockRejectedValue(42);

    await activitiesAction('acct-1');

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
