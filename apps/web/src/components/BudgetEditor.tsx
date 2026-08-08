import { useState } from 'react';
import type { BudgetStatus } from '../types';

export interface BudgetEditorProps {
  categories: Array<{ id: number; name: string }>;
  initialCaps: Record<string, number>;
  onSave: (caps: Record<string, number>) => Promise<void>;
}

/** Per-category monthly caps editor; saving PUTs the whole map (BM-3). */
export default function BudgetEditor({ categories, initialCaps, onSave }: BudgetEditorProps): JSX.Element {
  const [caps, setCaps] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => [String(c.id), String(initialCaps[String(c.id)] ?? '')])),
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
          const value = Number(raw);
          if (!Number.isInteger(value) || value <= 0) {
            throw new Error(`Cap for "${cat.name}" must be a positive integer.`);
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
                    min="1"
                    step="1"
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
export function BudgetStatusView({ status }: { status: BudgetStatus }): JSX.Element {
  return (
    <div>
      <p data-testid="global-status">
        Global: {status.global.consumed} / {status.global.cap} ARS{' '}
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
                <td>{c.categoryId}</td>
                <td>{c.cap}</td>
                <td>{c.consumed}</td>
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
