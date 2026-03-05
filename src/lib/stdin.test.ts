import { describe, it, expect, vi, afterEach } from 'vitest';
import { readStdin } from './stdin.js';
import { EventEmitter } from 'node:events';

describe('readStdin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('buffers chunks and resolves on end', async () => {
    const emitter = new EventEmitter();
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(emitter as any);

    const promise = readStdin();
    emitter.emit('data', Buffer.from('hello '));
    emitter.emit('data', Buffer.from('world'));
    emitter.emit('end');

    await expect(promise).resolves.toBe('hello world');
  });

  it('rejects on error', async () => {
    const emitter = new EventEmitter();
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(emitter as any);

    const promise = readStdin();
    emitter.emit('error', new Error('read fail'));

    await expect(promise).rejects.toThrow('read fail');
  });
});
