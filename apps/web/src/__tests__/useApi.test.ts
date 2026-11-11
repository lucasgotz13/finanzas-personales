import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useApi } from '../hooks/useApi';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useApi', () => {
  it('ignores a slow response for previous deps that resolves after the current one', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<string>>>();
    const { result, rerender } = renderHook(
      ({ month }: { month: string }) =>
        useApi(() => {
          const d = deferred<string>();
          pending.set(month, d);
          return d.promise;
        }, [month]),
      { initialProps: { month: '2026-11' } },
    );

    rerender({ month: '2026-10' });
    await act(async () => pending.get('2026-10')!.resolve('october'));
    await waitFor(() => expect(result.current.data).toBe('october'));

    await act(async () => pending.get('2026-11')!.resolve('november'));
    expect(result.current.data).toBe('october');
    expect(result.current.loading).toBe(false);
  });
});
