import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { connectionsAction } from './connections.js';

// ---------------------------------------------------------------------------
// Mock getLivefolio
// ---------------------------------------------------------------------------

const mockListConnections = vi.fn();

vi.mock('../../config.js', () => ({
  getLivefolio: () => ({
    broker: { listConnections: mockListConnections },
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

describe('connectionsAction', () => {
  it('outputs connections as JSON on success', async () => {
    const connections = [
      {
        authorizationId: 'auth-1',
        brokerageName: 'Alpaca',
        logoUrl: null,
        disabled: false,
        type: 'trade',
        accounts: [{ id: 'acct-1', name: 'Main', number: '123', institutionName: 'Alpaca', balance: null, isPaper: false }],
      },
    ];

    mockListConnections.mockResolvedValue(connections);

    await connectionsAction();

    expect(mockListConnections).toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();

    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].authorizationId).toBe('auth-1');
    expect(parsed[0].brokerageName).toBe('Alpaca');
  });

  it('outputs empty array when no connections exist', async () => {
    mockListConnections.mockResolvedValue([]);

    await connectionsAction();

    const parsed = JSON.parse(stdout);
    expect(parsed).toEqual([]);
  });

  it('prints Error message to stderr on failure', async () => {
    mockListConnections.mockRejectedValue(new Error('BrokerModule requires a SnapTrade client'));

    await connectionsAction();

    expect(stderr).toBe('Error: BrokerModule requires a SnapTrade client\n');
    expect(process.exitCode).toBe(1);
  });

  it('coerces non-Error thrown values to string', async () => {
    mockListConnections.mockRejectedValue(42);

    await connectionsAction();

    expect(stderr).toBe('Error: 42\n');
    expect(process.exitCode).toBe(1);
  });
});
