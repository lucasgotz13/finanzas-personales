import { arDateString } from '@finanzas/domain';
import { useState } from 'react';
import { api } from '../api';
import { formatMonth } from '../dates';
import { useApi } from '../hooks/useApi';
import BudgetEditor, { BudgetStatusView } from '../components/BudgetEditor';
import type { CategoryNode } from '../types';

function flattenTree(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}

/** Budgets page: edit caps and review the current month's over-budget status (BM-1..4). */
export default function BudgetsPage(): JSX.Element {
  const [month, setMonth] = useState(arDateString(new Date()).slice(0, 7));
  const categories = useApi(() => api.getCategoryTree(), []);
  const budgets = useApi(() => api.getBudgets(), []);
  const status = useApi(() => api.getBudgetStatus(month), [month, budgets.data]);

  return (
    <>
      <section className="card">
        <h2>Topes mensuales (ARS)</h2>
        {categories.error && (
          <div className="error-box" role="alert">
            {categories.error}{' '}
            <button type="button" className="link" data-testid="retry-categories" onClick={() => categories.reload()}>
              Reintentar
            </button>
          </div>
        )}
        <BudgetEditor
          categories={flattenTree(categories.data ?? [])}
          initialCaps={budgets.data ?? {}}
          loading={categories.loading || budgets.loading}
          onSave={async (map) => {
            await api.putBudgets(map);
            budgets.reload();
          }}
        />
      </section>
      <section className="card">
        <h2>Estado — {formatMonth(month)}</h2>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes del estado" />
        {status.error && (
          <div className="error-box" role="alert">
            {status.error}{' '}
            <button type="button" className="link" data-testid="retry-status" onClick={() => status.reload()}>
              Reintentar
            </button>
          </div>
        )}
        {status.loading ? <div className="empty">Cargando…</div> : status.data && (
          <BudgetStatusView
            status={status.data}
            categoryNames={Object.fromEntries(flattenTree(categories.data ?? []).map((c) => [c.id, c.name]))}
          />
        )}
      </section>
    </>
  );
}
