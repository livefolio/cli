import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rebalanceAction } from './rebalance.js';

// ---------------------------------------------------------------------------
// Mock buildRebalancePlan
// ---------------------------------------------------------------------------

const mockBuildRebalancePlan = vi.fn();

vi.mock('@livefolio/sdk/portfolio', () => ({
  buildRebalancePlan: (...args: unknown[]) => mockBuildRebalancePlan(...args),
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
  mockBuildRebalancePlan.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseOptions() {
  return {
    targets: 'SPY:60,QQQ:40',
    current: 'SPY:800,QQQ:200',
    prices: 'SPY:450,QQQ:380',
    cash: '100',
    total: '1100',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rebalanceAction', () => {
  it('calls buildRebalancePlan with parsed input and outputs JSON when triggered', async () => {
    const plan = {
      triggered: true,
      portfolioDriftPercentPoints: 27.3,
      reason: 'ok',
      orders: [
        { action: 'SELL', symbol: 'SPY', quantity: 0.44, estimatedPrice: 450, estimatedValue: 198 },
        { action: 'BUY', symbol: 'QQQ', quantity: 0.5, estimatedPrice: 380, estimatedValue: 190 },
      ],
    };
    mockBuildRebalancePlan.mockReturnValue(plan);

    await rebalanceAction(baseOptions());

    expect(mockBuildRebalancePlan).toHaveBeenCalledWith({
      targetWeights: { SPY: 60, QQQ: 40 },
      currentValues: { SPY: 800, QQQ: 200 },
      prices: { SPY: 450, QQQ: 380 },
      cashValue: 100,
      totalValue: 1100,
    });
    expect(JSON.parse(stdout)).toEqual(plan);
    expect(process.exitCode).toBeUndefined();
  });

  it('outputs JSON with triggered false when drift is below threshold', async () => {
    const plan = {
      triggered: false,
      portfolioDriftPercentPoints: 5.0,
      reason: 'below_threshold',
      orders: [],
    };
    mockBuildRebalancePlan.mockReturnValue(plan);

    await rebalanceAction(baseOptions());

    expect(JSON.parse(stdout)).toEqual(plan);
    expect(process.exitCode).toBeUndefined();
  });

  it('errors on invalid pair format (no colon)', async () => {
    await rebalanceAction({ ...baseOptions(), targets: 'SPY60' });

    expect(stderr).toContain('invalid targets pair');
    expect(process.exitCode).toBe(1);
    expect(mockBuildRebalancePlan).not.toHaveBeenCalled();
  });

  it('errors on non-numeric value in pair', async () => {
    await rebalanceAction({ ...baseOptions(), targets: 'SPY:abc' });

    expect(stderr).toContain('not a number');
    expect(process.exitCode).toBe(1);
    expect(mockBuildRebalancePlan).not.toHaveBeenCalled();
  });

  it('errors on non-numeric cash value', async () => {
    await rebalanceAction({ ...baseOptions(), cash: 'xyz' });

    expect(stderr).toContain('invalid cash');
    expect(process.exitCode).toBe(1);
    expect(mockBuildRebalancePlan).not.toHaveBeenCalled();
  });

  it('errors on non-numeric total value', async () => {
    await rebalanceAction({ ...baseOptions(), total: 'abc' });

    expect(stderr).toContain('invalid total');
    expect(process.exitCode).toBe(1);
    expect(mockBuildRebalancePlan).not.toHaveBeenCalled();
  });

  it('passes threshold option to buildRebalancePlan', async () => {
    mockBuildRebalancePlan.mockReturnValue({
      triggered: false,
      portfolioDriftPercentPoints: 5.0,
      reason: 'below_threshold',
      orders: [],
    });

    await rebalanceAction({ ...baseOptions(), threshold: '10' });

    expect(mockBuildRebalancePlan).toHaveBeenCalledWith(
      expect.objectContaining({ portfolioDriftThresholdPercentPoints: 10 }),
    );
  });

  it('passes cashSymbol option uppercased to buildRebalancePlan', async () => {
    mockBuildRebalancePlan.mockReturnValue({
      triggered: true,
      portfolioDriftPercentPoints: 30,
      reason: 'ok',
      orders: [],
    });

    await rebalanceAction({ ...baseOptions(), cashSymbol: 'usd' });

    expect(mockBuildRebalancePlan).toHaveBeenCalledWith(
      expect.objectContaining({ cashSymbol: 'USD' }),
    );
  });

  it('handles buildRebalancePlan throwing an error', async () => {
    mockBuildRebalancePlan.mockImplementation(() => { throw new Error('bad input'); });

    await rebalanceAction(baseOptions());

    expect(stderr).toBe('Error: bad input\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockBuildRebalancePlan.mockImplementation(() => { throw 'unexpected'; });

    await rebalanceAction(baseOptions());

    expect(stderr).toBe('Error: unexpected\n');
    expect(process.exitCode).toBe(1);
  });
});
