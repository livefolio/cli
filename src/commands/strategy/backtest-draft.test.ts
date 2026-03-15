import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { backtestDraftAction } from './backtest-draft.js';

const mockRunDraftBacktest = vi.fn();
const mockReadFile = vi.fn();

vi.mock('@livefolio/sdk/strategy-builder', () => ({
  runDraftBacktest: (...args: unknown[]) => mockRunDraftBacktest(...args),
}));

vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    market: { getBatchSeriesFromDb: vi.fn(), getTradingDays: vi.fn() },
  }),
}));

let stdout: string;
let stderr: string;
let originalExitCode: number | undefined;

beforeEach(() => {
  stdout = '';
  stderr = '';
  originalExitCode = process.exitCode;
  process.exitCode = undefined;
  mockRunDraftBacktest.mockReset();
  mockReadFile.mockReset();
  vi.spyOn(console, 'log').mockImplementation((msg: string) => { stdout += msg + '\n'; });
  vi.spyOn(process.stderr, 'write').mockImplementation((msg: string) => { stderr += msg; return true; });
});

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe('backtestDraftAction', () => {
  it('runs the SDK draft backtest and prints the result', async () => {
    const draft = { name: 'Draft' };
    mockReadFile.mockResolvedValue(JSON.stringify(draft));
    mockRunDraftBacktest.mockResolvedValue({ summary: { tradeCount: 1 } });

    await backtestDraftAction('/tmp/draft.json', {
      start: '2026-01-01',
      end: '2026-12-31',
      initialCapital: '100000',
    });

    expect(mockRunDraftBacktest).toHaveBeenCalledWith(
      expect.any(Object),
      draft,
      {
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        initialCapital: 100000,
      },
    );
    expect(JSON.parse(stdout)).toEqual({ summary: { tradeCount: 1 } });
  });

  it('rejects invalid option values', async () => {
    await backtestDraftAction('/tmp/draft.json', { start: 'bad', end: '2026-12-31' });

    expect(stderr).toBe('Error: --start must be in YYYY-MM-DD format.\n');
    expect(process.exitCode).toBe(1);
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});
