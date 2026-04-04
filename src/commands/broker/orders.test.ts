import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ordersAction } from './orders.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockListRecentOrders = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    broker: { listRecentOrders: mockListRecentOrders },
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

describe('ordersAction', () => {
  it('passes accountId and outputs orders as JSON', async () => {
    const orders = [
      { orderId: 'ord-1', symbol: 'SPY', action: 'BUY', quantity: 10, status: 'filled' },
    ];

    mockListRecentOrders.mockResolvedValue(orders);

    await ordersAction('acct-1');

    expect(mockListRecentOrders).toHaveBeenCalledWith('acct-1');
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].orderId).toBe('ord-1');
  });

  it('outputs empty array when no orders exist', async () => {
    mockListRecentOrders.mockResolvedValue([]);

    await ordersAction('acct-1');

    const parsed = JSON.parse(stdout);
    expect(parsed).toEqual([]);
  });

  it('prints Error message to stderr on failure', async () => {
    mockListRecentOrders.mockRejectedValue(new Error('Unauthorized'));

    await ordersAction('acct-1');

    expect(stderr).toBe('Error: Unauthorized\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockListRecentOrders.mockRejectedValue('bad request');

    await ordersAction('acct-1');

    expect(stderr).toBe('Error: bad request\n');
    expect(process.exitCode).toBe(1);
  });
});
