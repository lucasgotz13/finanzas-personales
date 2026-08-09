import { vi } from 'vitest';

/** fetch stub that also exposes vitest's call records for assertions. */
export type MockFetch = typeof fetch & {
  mock: { calls: Array<[string | URL | Request, (RequestInit | undefined)?]> };
};

/** fetch stub resolving with a JSON body and an optional status. */
export function jsonFetch(body: unknown, status = 200): MockFetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as MockFetch;
}

/** fetch stub whose body is not JSON (res.json() rejects). */
export function malformedJsonFetch(status = 200): typeof fetch {
  return vi.fn(async () => new Response('<html>oops</html>', { status })) as unknown as typeof fetch;
}

/** fetch stub that never resolves and rejects with AbortError when the signal fires. */
export function abortingFetch(): typeof fetch {
  return (async (_input: string | URL | Request, init?: RequestInit) => {
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted', 'AbortError'));
      });
    });
  }) as unknown as typeof fetch;
}
