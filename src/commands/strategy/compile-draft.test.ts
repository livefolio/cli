import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compileDraftAction } from './compile-draft.js';

const mockCompileDraftStrategy = vi.fn();
const mockReadFile = vi.fn();

vi.mock('@livefolio/sdk/strategy-builder', () => ({
  compileDraftStrategy: (...args: unknown[]) => mockCompileDraftStrategy(...args),
}));

vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

let stdout: string;
let stderr: string;
let originalExitCode: number | undefined;

beforeEach(() => {
  stdout = '';
  stderr = '';
  originalExitCode = process.exitCode;
  process.exitCode = undefined;
  mockCompileDraftStrategy.mockReset();
  mockReadFile.mockReset();
  vi.spyOn(console, 'log').mockImplementation((msg: string) => { stdout += msg + '\n'; });
  vi.spyOn(process.stderr, 'write').mockImplementation((msg: string) => { stderr += msg; return true; });
});

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe('compileDraftAction', () => {
  it('prints compiled strategy JSON on success', async () => {
    const draft = { name: 'Draft' };
    mockReadFile.mockResolvedValue(JSON.stringify(draft));
    mockCompileDraftStrategy.mockReturnValue({ linkId: 'custom-strategy', name: 'Draft' });

    await compileDraftAction('/tmp/draft.json');

    expect(mockReadFile).toHaveBeenCalledWith('/tmp/draft.json', 'utf8');
    expect(mockCompileDraftStrategy).toHaveBeenCalledWith(draft);
    expect(JSON.parse(stdout)).toEqual({ linkId: 'custom-strategy', name: 'Draft' });
  });

  it('prints errors to stderr and sets exit code', async () => {
    mockReadFile.mockRejectedValue(new Error('missing file'));

    await compileDraftAction('/tmp/missing.json');

    expect(stderr).toBe('Error: missing file\n');
    expect(process.exitCode).toBe(1);
  });
});
