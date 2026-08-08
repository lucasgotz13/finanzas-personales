import type {
  BudgetStatus,
  CategoryNode,
  CreateTransactionInput,
  PeriodSummary,
} from './types';

export const API_BASE = '/api/v1';

interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: string[] };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let body: ErrorEnvelope | null = null;
    try {
      body = (await res.json()) as ErrorEnvelope | null;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? `Request failed (${res.status})`,
      body?.error?.details ?? [],
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as Array<[string, string | number]>;
  if (entries.length === 0) return '';
  return `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}`;
}

/** Flattens a category tree into a selectable list (deleted categories are already hidden). */
export function flattenTree(nodes: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = [];
  const walk = (list: CategoryNode[], depth: number): void => {
    for (const node of list) {
      out.push({ ...node, name: depth > 0 ? `${'\u00A0'.repeat(depth * 2)}${node.name}` : node.name });
      walk(node.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return out;
}

export const api = {
  listTransactions(params: { month?: string; direction?: 'expense' | 'income' } = {}): Promise<import('./types').ApiTransaction[]> {
    return request(`/transactions${qs(params)}`);
  },
  createTransaction(input: CreateTransactionInput): Promise<import('./types').ApiTransaction> {
    return request('/transactions', { method: 'POST', body: JSON.stringify(input) });
  },
  getCategoryTree(): Promise<CategoryNode[]> {
    return request('/categories/tree');
  },
  createCategory(input: { name: string; parentId?: number | null }): Promise<CategoryNode> {
    return request('/categories', { method: 'POST', body: JSON.stringify(input) });
  },
  renameCategory(id: number, name: string): Promise<CategoryNode> {
    return request(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
  },
  deleteCategory(id: number): Promise<void> {
    return request(`/categories/${id}`, { method: 'DELETE' });
  },
  getBudgets(): Promise<Record<string, number>> {
    return request('/budgets');
  },
  putBudgets(map: Record<string, number>): Promise<Record<string, number>> {
    return request('/budgets', { method: 'PUT', body: JSON.stringify(map) });
  },
  getBudgetStatus(month: string): Promise<BudgetStatus> {
    return request(`/budgets/status${qs({ month })}`);
  },
  getSummary(period: 'month' | 'quarter' | 'year', date: string): Promise<PeriodSummary> {
    return request(`/summaries${qs({ period, date })}`);
  },
};
