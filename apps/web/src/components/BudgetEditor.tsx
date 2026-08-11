import { useEffect, useState } from 'react';
import { translateApiMessage } from '../api';
import type { BudgetStatus } from '../types';
import { parseEsArAmount } from '../amount';

export interface BudgetEditorProps {
  categories: Array<{ id: number; name: string }>;
  initialCaps: Record<string, number>;
  onSave: (caps: Record<string, number>) => Promise<void>;
}

/** ARS currency formatting for minor-unit amounts (same pattern as SummaryView). */
function formatMinor(minor: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(minor / 100);
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
  const [success, setSuccess] = useState(false);

  // Transient success message: clears ~2s after it appears (and on unmount).
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(false), 2000);
    return () => clearTimeout(t);
  }, [success]);

  async function handleSave(): Promise<void> {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const map: Record<string, number> = {};
      for (const cat of categories) {
        const raw = caps[String(cat.id)];
        if (raw !== undefined && raw !== '') {
          // es-AR amount parsing: dot = thousands, comma = decimal (issue #45).
          const value = parseEsArAmount(raw);
          if (value === null || value <= 0) {
            throw new Error(`El tope para "${cat.name}" debe ser un monto positivo.`);
          }
          map[String(cat.id)] = Math.round(value * 100);
        }
      }
      await onSave(map);
      setSuccess(true);
    } catch (err) {
      setError(translateApiMessage(err instanceof Error ? err.message : 'No se pudieron guardar los presupuestos.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
    >
      {categories.length === 0 ? (
        <div className="empty">Aún no hay categorías para presupuestar.</div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Tope mensual (ARS)</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td>{cat.name}</td>
                <td>
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={`Tope mensual de ${cat.name}`}
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
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="success-box" role="status" data-testid="budget-success">
          Presupuestos guardados.
        </div>
      )}
      <button type="submit" className="primary" disabled={saving} data-testid="budget-save">
        {saving ? 'Guardando…' : 'Guardar presupuestos'}
      </button>
    </form>
  );
}

/** Reads the over-budget status of every budgeted category plus the global budget (BM-2, BM-4). */
export function BudgetStatusView({ status, categoryNames }: { status: BudgetStatus; categoryNames?: Record<number, string> }): JSX.Element {
  return (
    <div>
      <p data-testid="global-status" className="money">
        Global: {formatMinor(status.global.consumed)} / {formatMinor(status.global.cap)}{' '}
        <span className={`badge ${status.global.overBudget ? 'over' : 'ok'}`}>{status.global.overBudget ? 'Sobre el presupuesto' : 'OK'}</span>
      </p>
      {status.categories.length === 0 ? (
        <div className="empty">Aún no hay presupuestos configurados para este mes.</div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Tope</th>
              <th>Consumido</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {status.categories.map((c) => (
              <tr key={c.categoryId}>
                <td>{categoryNames?.[c.categoryId] ?? c.categoryId}</td>
                <td className="money">{formatMinor(c.cap)}</td>
                <td className="money">{formatMinor(c.consumed)}</td>
                <td>
                  <span className={`badge ${c.overBudget ? 'over' : 'ok'}`}>{c.overBudget ? 'Sobre el presupuesto' : 'OK'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
