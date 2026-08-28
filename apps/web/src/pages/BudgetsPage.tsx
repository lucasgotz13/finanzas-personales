import { arDateString } from '@finanzas/domain';
import { useMemo, useState } from 'react';
import { api } from '../api';
import { formatMonth } from '../dates';
import { useApi } from '../hooks/useApi';
import BudgetEditor, { BudgetStatusView } from '../components/BudgetEditor';
import type { CategoryNode } from '../types';

function flattenTree(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}

/** Budgets page: edit caps and review the current month's over-budget status (BM-1..4). */
export default function BudgetsPage({ active = true }: { active?: boolean }): JSX.Element {
  const [month, setMonth] = useState(arDateString(new Date()).slice(0, 7));
  const categories = useApi(() => api.getCategoryTree(), [], active);
  const budgets = useApi(() => api.getBudgets(), [], active);
  const status = useApi(() => api.getBudgetStatus(month), [month, budgets.data], active);
  const flatCategories = useMemo(() => flattenTree(categories.data ?? []), [categories.data]);
  // Saving before the budgets have landed at least once would PUT a map that
  // silently deletes every saved cap: gate the save on a successful load.
  const budgetsLoaded = budgets.data !== null;

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
        {budgets.error && (
          <div className="error-box" role="alert">
            {budgets.error}{' '}
            <button type="button" className="link" data-testid="retry-budgets" onClick={() => budgets.reload()}>
              Reintentar
            </button>
          </div>
        )}
        <BudgetEditor
          categories={flatCategories}
          initialCaps={budgets.data ?? {}}
          loading={categories.loading || budgets.loading}
          canSave={budgetsLoaded}
          onSave={async (map) => {
            await api.putBudgets(map);
            budgets.reload();
          }}
        />
      </section>
      <section className="card">
        <h2>Estado — {formatMonth(month)}</h2>
        <div className="filters">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes del estado" />
        </div>
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
            categoryNames={Object.fromEntries(flatCategories.map((c) => [c.id, c.name]))}
          />
        )}
      </section>
    </>
  );
}
