import { useState } from 'react';
import { ApiError, api, translateApiError, translateApiMessage } from '../api';
import { parseEsArAmount } from '../amount';
import type { CreateGoalInput, GoalView, UpdateGoalInput } from '../types';

export interface GoalFormProps {
  /** Edit mode: prefill every field from this goal and PATCH on submit. */
  initial?: GoalView;
  onSaved: (goal: GoalView) => void;
  onCancel?: () => void;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Savings-goal create/edit form: name, target, currency and optional deadline.
 * The running total is never an input here — progress only moves through the
 * automatic surplus and the per-goal aportar/retirar buttons. */
export default function GoalForm({ initial, onSaved, onCancel }: GoalFormProps): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '');
  const [target, setTarget] = useState(initial ? String(initial.targetMinor / 100) : '');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(initial?.currency ?? 'ARS');
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function resetForm(): void {
    setName('');
    setTarget('');
    setDeadline('');
    setErrors([]);
  }

  function errorText(err: unknown): string {
    if (err instanceof ApiError) return translateApiError(err);
    return translateApiMessage(err instanceof Error ? err.message : 'No se pudo guardar la meta.');
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const details: string[] = [];
    if (name.trim() === '') details.push('El nombre es obligatorio.');
    const parsed = parseEsArAmount(target);
    if (parsed === null || parsed <= 0) details.push('El objetivo debe ser un monto positivo.');
    if (deadline !== '' && !isValidDate(deadline)) details.push('La fecha límite debe ser una fecha válida.');
    if (details.length > 0) {
      setErrors(details);
      return;
    }
    setErrors([]);
    setSubmitting(true);
    try {
      const targetMinor = Math.round((parsed as number) * 100);
      const saved =
        initial !== undefined
          ? await api.updateGoal(initial.id, {
              name: name.trim(),
              targetMinor,
              currency,
              deadline: deadline === '' ? null : deadline,
            } satisfies UpdateGoalInput)
          : await api.createGoal({
              name: name.trim(),
              targetMinor,
              currency,
              deadline: deadline === '' ? null : deadline,
            } satisfies CreateGoalInput);
      onSaved(saved);
      if (initial === undefined) resetForm();
    } catch (err) {
      setErrors([errorText(err)]);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel(): void {
    onCancel?.();
    resetForm();
  }

  return (
    <form className="transaction-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
      <label>
        Nombre
        <input
          type="text"
          placeholder="Viaje a Bariloche"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="goal-name"
        />
      </label>
      <label>
        Objetivo ({currency})
        <input
          type="text"
          inputMode="decimal"
          placeholder="500000"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          data-testid="goal-target"
        />
      </label>
      <label>
        Moneda
        <select value={currency} onChange={(e) => setCurrency(e.target.value as 'ARS' | 'USD')} data-testid="goal-currency">
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      </label>
      <label>
        Fecha límite (opcional)
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} data-testid="goal-deadline" />
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={submitting} data-testid="goal-submit">
          {submitting ? 'Guardando…' : initial !== undefined ? 'Guardar cambios' : 'Crear meta'}
        </button>
        {initial !== undefined && (
          <button type="button" className="link muted" onClick={handleCancel} disabled={submitting} data-testid="goal-cancel">
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
