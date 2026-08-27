import type { ErrorReason } from '@finanzas/domain';
import type {
  BudgetStatus,
  CategoryNode,
  CreateTransactionInput,
  HistoryResponse,
  IndicatorRefreshResult,
  IndicatorView,
  PeriodSummary,
  PortfolioRefreshResult,
  PortfolioSummary,
  SeriesCurrency,
  SeriesRange,
  Trade,
  TradeInput,
} from './types';

export const API_BASE = '/api/v1';

/** Known backend error messages mapped to es-AR for display (backend copy stays English). */
const API_MESSAGE_TRANSLATIONS: Record<string, string> = {
  'Rate is required when changing currency to a non-ARS currency': 'El tipo de cambio es obligatorio al cambiar a una moneda que no es ARS.',
  'Cannot delete a category with children': 'No se puede borrar una categoría con subcategorías.',
  'Invalid name': 'Nombre inválido.',
  'Invalid parentId': 'Categoría padre inválida.',
  'Nothing to update': 'No hay nada para actualizar.',
  'Invalid category id': 'Identificador de categoría inválido.',
  'Invalid transaction id': 'Identificador de transacción inválido.',
  'Invalid date range': 'Rango de fechas inválido.',
  'Invalid period': 'Período inválido.',
  'Invalid date': 'Fecha inválida.',
  'Invalid month': 'Mes inválido.',
  'Invalid budgets payload': 'Datos de presupuesto inválidos.',
  'Route not found': 'Ruta no encontrada.',
  // Auth gate (WU2): backend copy stays English; the UI renders it in es-AR.
  'Invalid passphrase': 'Contraseña incorrecta.',
  'Too many failed attempts': 'Demasiados intentos fallidos; espere unos segundos.',
  'too many failed attempts; try again in 60s': 'Demasiados intentos fallidos; espere 60 segundos.',
  'Authentication is disabled': 'La autenticación está deshabilitada.',
};

/** Maps a known backend error message to es-AR; unknown messages pass through unchanged.
 * Fallback layer only: structured errors are translated by `translateApiError`. */
export function translateApiMessage(message: string): string {
  return API_MESSAGE_TRANSLATIONS[message] ?? message;
}

/**
 * es-AR templates keyed by the backend's structured error reason (issue #103).
 * Each template reproduces the exact visible copy the old message/detail
 * parsers produced; a template returns undefined when its dynamic meta is
 * missing so the caller can fall back to the exact-message table.
 */
const REASON_TEMPLATES: Partial<Record<ErrorReason, (meta: Record<string, unknown>) => string | undefined>> = {
  TRADE_EXCEEDS_BALANCE: (meta) => {
    const { type, ticker, quantity, date, balance } = meta;
    if (typeof type !== 'string' || typeof ticker !== 'string' || typeof date !== 'string') return undefined;
    const noun = type === 'sell' ? 'venta' : 'compra';
    const fix = type === 'sell' ? 'esa venta' : 'esa compra';
    return `La ${noun} de ${quantity} ${ticker} del ${date} supera el saldo de ${balance}; corregí primero ${fix}.`;
  },
  AUTH_LOCKED: (meta) =>
    typeof meta.seconds === 'number' ? `Demasiados intentos fallidos; espere ${meta.seconds} segundos.` : undefined,
  RATE_REQUIRED_FOR_CURRENCY: () => 'El tipo de cambio es obligatorio al cambiar a una moneda que no es ARS.',
  CATEGORY_HAS_CHILDREN: () => 'No se puede borrar una categoría con subcategorías.',
  INVALID_NAME: () => 'Nombre inválido.',
  INVALID_PARENT_ID: () => 'Categoría padre inválida.',
  NOTHING_TO_UPDATE: () => 'No hay nada para actualizar.',
  INVALID_CATEGORY_ID: () => 'Identificador de categoría inválido.',
  INVALID_TRANSACTION_ID: () => 'Identificador de transacción inválido.',
  INVALID_DATE_RANGE: () => 'Rango de fechas inválido.',
  INVALID_PERIOD: () => 'Período inválido.',
  INVALID_DATE: () => 'Fecha inválida.',
  INVALID_MONTH: () => 'Mes inválido.',
  INVALID_BUDGETS_PAYLOAD: () => 'Datos de presupuesto inválidos.',
  ROUTE_NOT_FOUND: () => 'Ruta no encontrada.',
  INVALID_PASSPHRASE: () => 'Contraseña incorrecta.',
  AUTH_DISABLED: () => 'La autenticación está deshabilitada.',
};

/** Single translation entry point for API errors: structured reason template
 * first, then the legacy exact-message table, then the raw (English) message. */
export function translateApiError(err: ApiError): string {
  const template = err.reason !== undefined ? REASON_TEMPLATES[err.reason as ErrorReason] : undefined;
  const translated = template?.(err.meta ?? {});
  if (translated !== undefined) return translated;
  return translateApiMessage(err.message);
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: string[]; reason?: string; meta?: Record<string, unknown> };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: string[] = [],
    readonly reason?: string,
    readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Registered by the App shell; invoked on unexpected 401 UNAUTHORIZED
 * responses so the session can drop back to the login gate (WU2). */
let unauthorizedHandler: (() => void) | null = null;

/** Sets the 401 handler (pass null to unregister). Login/status calls never
 * trigger it: they are the auth flow itself. */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
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
    if (res.status === 401 && body?.error?.code === 'UNAUTHORIZED' && path !== '/auth/login' && path !== '/auth/status') {
      unauthorizedHandler?.();
    }
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? `Solicitud fallida (${res.status})`,
      body?.error?.details ?? [],
      body?.error?.reason,
      body?.error?.meta,
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
  /** Logs in with the passphrase; `remember` extends the cookie to 30 days. */
  login(passphrase: string, remember: boolean): Promise<void> {
    return request('/auth/login', { method: 'POST', body: JSON.stringify({ passphrase, remember }) });
  },
  /** Clears the session cookie server-side. */
  logout(): Promise<void> {
    return request('/auth/logout', { method: 'POST' });
  },
  /** Whether the current session is authenticated (public endpoint). */
  authStatus(): Promise<boolean> {
    return request<{ authenticated: boolean }>('/auth/status').then((s) => s.authenticated);
  },
  listTransactions(params: { month?: string; direction?: 'expense' | 'income' } = {}): Promise<import('./types').ApiTransaction[]> {
    return request(`/transactions${qs(params)}`);
  },
  createTransaction(input: CreateTransactionInput): Promise<import('./types').ApiTransaction> {
    return request('/transactions', { method: 'POST', body: JSON.stringify(input) });
  },
  updateTransaction(id: number, input: CreateTransactionInput): Promise<import('./types').ApiTransaction> {
    return request(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  },
  deleteTransaction(id: number): Promise<void> {
    return request(`/transactions/${id}`, { method: 'DELETE' });
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
  getDeletedCategories(): Promise<CategoryNode[]> {
    return request<Array<{ id: number; name: string; parentId: number | null }>>('/categories/deleted').then((list) =>
      list.map((c) => ({ ...c, children: [] })),
    );
  },
  restoreCategory(id: number): Promise<CategoryNode> {
    return request<{ id: number; name: string; parentId: number | null }>(`/categories/${id}/restore`, { method: 'POST' }).then(
      (c) => ({ ...c, children: [] }),
    );
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
  getIndicators(): Promise<IndicatorView[]> {
    return request('/indicators');
  },
  refreshIndicators(force: boolean): Promise<{ results: IndicatorRefreshResult[] }> {
    return request(`/indicators/refresh${force ? '?force=true' : ''}`, { method: 'POST' });
  },
  getPortfolio(): Promise<PortfolioSummary> {
    return request('/portfolio');
  },
  refreshPortfolio(force: boolean): Promise<{ results: PortfolioRefreshResult[] }> {
    return request(`/portfolio/refresh${force ? '?force=true' : ''}`, { method: 'POST' });
  },
  listTrades(): Promise<Trade[]> {
    return request('/portfolio/trades');
  },
  createTrade(input: TradeInput): Promise<Trade> {
    return request('/portfolio/trades', { method: 'POST', body: JSON.stringify(input) });
  },
  updateTrade(id: number, input: TradeInput): Promise<Trade> {
    return request(`/portfolio/trades/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  },
  deleteTrade(id: number): Promise<void> {
    return request(`/portfolio/trades/${id}`, { method: 'DELETE' });
  },
  getPortfolioHistory(range: SeriesRange, currency: SeriesCurrency, force = false): Promise<HistoryResponse> {
    return request(`/portfolio/history${qs({ range, currency, force: force ? 'true' : undefined })}`);
  },
  getPositionHistory(id: number, range: SeriesRange, currency: SeriesCurrency, force = false): Promise<HistoryResponse> {
    return request(`/portfolio/positions/${id}/history${qs({ range, currency, force: force ? 'true' : undefined })}`);
  },
};

/** Plain (unindented) category name lookup for lists. */
export function categoryNameMap(nodes: CategoryNode[]): Map<number, string> {
  const map = new Map<number, string>();
  const walk = (list: CategoryNode[]): void => {
    for (const node of list) {
      map.set(node.id, node.name);
      walk(node.children);
    }
  };
  walk(nodes);
  return map;
}
