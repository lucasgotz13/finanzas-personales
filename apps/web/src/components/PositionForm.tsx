import { useState } from 'react';
import { api, translateApiMessage } from '../api';
import { parseEsArAmount } from '../amount';
import type { Position, PositionEdit } from '../types';

export interface PositionFormProps {
  /** Edit mode: prefill from this position and PATCH on submit; ticker is immutable. */
  initial?: PositionEdit;
  onCreated: (position: Position) => void;
  onUpdate?: (position: Position) => void;
  onCancel?: () => void;
}

/** Manual position form (PI-6): ticker, quantity and avg cost in USD. */
export default function PositionForm({ initial, onCreated, onUpdate, onCancel }: PositionFormProps): JSX.Element {
  const [ticker, setTicker] = useState(initial?.ticker ?? '');
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '');
  const [avgCost, setAvgCost] = useState(initial ? String(initial.avgCostMinor / 100) : '');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const details: string[] = [];
    const qty = parseEsArAmount(quantity);
    const avg = parseEsArAmount(avgCost);
    if (ticker.trim() === '') details.push('El ticker es obligatorio.');
    if (qty === null || qty <= 0) details.push('La cantidad debe ser un número positivo.');
    if (avg === null || avg <= 0) details.push('El costo promedio debe ser un número positivo.');
    if (details.length > 0) {
      setErrors(details);
      return;
    }
    setErrors([]);
    setSubmitting(true);
    try {
      const avgCostMinor = Math.round((avg as number) * 100);
      if (initial) {
        onUpdate?.(await api.updatePosition(initial.id, { quantity: qty as number, avgCostMinor }));
      } else {
        onCreated(await api.createPosition({ ticker: ticker.trim(), quantity: qty as number, avgCostMinor }));
        setQuantity('');
        setAvgCost('');
      }
    } catch (err) {
      setErrors([translateApiMessage(err instanceof Error ? err.message : 'No se pudo guardar la posición.')]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="transaction-form" onSubmit={handleSubmit} noValidate>
      <label>
        Ticker
        <input type="text" placeholder="AAPL" value={ticker} onChange={(e) => setTicker(e.target.value)} disabled={initial !== undefined} data-testid="ticker" />
      </label>
      <label>
        Cantidad
        <input type="text" inputMode="decimal" placeholder="10" value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid="quantity" />
      </label>
      <label>
        Costo promedio (USD)
        <input type="text" inputMode="decimal" placeholder="180" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} data-testid="avg-cost" />
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={submitting} data-testid="submit">
          {submitting ? 'Guardando…' : initial ? 'Guardar cambios' : 'Agregar'}
        </button>
        {initial && (
          <button type="button" className="link muted" onClick={onCancel} disabled={submitting} data-testid="cancel">
            Cancelar
          </button>
        )}
      </div>
      {errors.length > 0 && (
        <div className="error-box" role="alert">
          {errors.map((err) => (
            <div key={err}>{err}</div>
          ))}
        </div>
      )}
    </form>
  );
}
