import { useState } from 'react';
import type { BudgetStatus } from '../types';

export interface BudgetEditorProps {
  categories: Array<{ id: number; name: string }>;
  initialCaps: Record<string, number>;
  onSave: (caps: Record<string, number>) => Promise<void>;
}

/** ARS currency formatting for minor-unit amounts (same pattern as SummaryView). */
function formatMinor(minor: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ARS' }).format(minor / 100);
}

/** Per-category monthly caps editor; saving PUTs the whole map in minor units (BM-3). */
export default function BudgetEditor({ categories, initialCaps, onSave }: BudgetEditorProps): JSX.Element {
  const [caps, setCaps] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => {
      const minor = initialCaps[String(c.id)];
      return [String(c.id), minor ? String(minor / 100) : ''];
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    setError(null);
    setSaving(true);
    try {
      const map: Record<string, number> = {};
      for (const cat of categories) {
        const raw = caps[String(cat.id)];
        if (raw !== undefined && raw !== '') {
          const value = Math.round(Number(raw) * 100);
          if (!Number.isFinite(value) || value <= 0) {
            throw new Error(`Cap for "${cat.name}" must be a positive amount.`);
          }
          map[String(cat.id)] = value;
        }
      }
      await onSave(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save budgets.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {categories.length === 0 ? (
        <div className="empty">No categories to budget.</div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Category</th>
              <th>Monthly cap (ARS)</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td>{cat.name}</td>
                <td>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={caps[String(cat.id)] ?? ''}
                    onChange={(e) => setCaps({ ...caps, [String(cat.id)]: e.target.value })}
                    data-testid={`cap-${cat.id}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && <div className="error-box">{error}</div>}
      <button className="primary" onClick={handleSave} disabled={saving} data-testid="budget-save">
        {saving ? 'Saving…' : 'Save budgets'}
      </button>
    </div>
  );
}

/** Reads the over-budget status of every budgeted category plus the global budget (BM-2, BM-4). */
export function BudgetStatusView({ status, categoryNames }: { status: BudgetStatus; categoryNames?: Record<number, string> }): JSX.Element {
  return (
    <div>
      <p data-testid="global-status">
        Global: {formatMinor(status.global.consumed)} / {formatMinor(status.global.cap)}{' '}
        <span className={`badge ${status.global.overBudget ? 'over' : 'ok'}`}>{status.global.overBudget ? 'OVER BUDGET' : 'OK'}</span>
      </p>
      {status.categories.length === 0 ? (
        <div className="empty">No budgets configured for this month.</div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Category</th>
              <th>Cap</th>
              <th>Consumed</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {status.categories.map((c) => (
              <tr key={c.categoryId}>
                <td>{categoryNames?.[c.categoryId] ?? c.categoryId}</td>
                <td>{formatMinor(c.cap)}</td>
                <td>{formatMinor(c.consumed)}</td>
                <td>
                  <span className={`badge ${c.overBudget ? 'over' : 'ok'}`}>{c.overBudget ? 'OVER' : 'OK'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
