import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import type { GoalView } from '../../types';
import GoalsPage from '../GoalsPage';

const goalA: GoalView = {
  id: 1,
  name: 'Viaje',
  targetMinor: 100000,
  currency: 'ARS',
  deadline: '2026-10-15',
  createdAt: '2026-08-01T12:00:00.000Z',
  priority: 0,
  completed: false,
  automaticMinor: 30000,
  manualAportesMinor: 10000,
  manualRetirosMinor: 0,
  manualNetMinor: 10000,
  totalMinor: 40000,
  remainingMinor: 60000,
  daysRemaining: 68,
  requiredPaceMinor: 20000,
};

const goalB: GoalView = {
  id: 2,
  name: 'Fondo',
  targetMinor: 50000,
  currency: 'ARS',
  deadline: null,
  createdAt: '2026-08-02T12:00:00.000Z',
  priority: 1,
  completed: true,
  automaticMinor: 40000,
  manualAportesMinor: 10000,
  manualRetirosMinor: 0,
  manualNetMinor: 10000,
  totalMinor: 50000,
  remainingMinor: 0,
  daysRemaining: null,
  requiredPaceMinor: null,
};

function mockList(goals: GoalView[] = [goalA, goalB]): void {
  vi.spyOn(api, 'listGoals').mockResolvedValue(goals);
}

describe('GoalsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders progress, the automatic/manual trace, the Completada badge and the deadline pace', async () => {
    mockList();
    render(<GoalsPage />);

    expect(await screen.findByTestId('goal-1')).toBeInTheDocument();
    // Progress with es-AR amounts and percent.
    expect(screen.getByTestId('goal-progress-1')).toHaveTextContent('$ 400,00 de $ 1.000,00 (40%)');
    // Visible trace: how much was automatic vs manual.
    expect(screen.getByTestId('goal-split-1')).toHaveTextContent('Automático: $ 300,00 · Manual: $ 100,00');
    // Deadline: days remaining + required pace, no verdict anywhere.
    expect(screen.getByTestId('goal-deadline-1')).toHaveTextContent(
      'Límite: 15/10/2026 · Faltan 68 días · Ritmo necesario: $ 200,00/mes',
    );
    expect(screen.queryByText(/vas bien|vas mal/i)).not.toBeInTheDocument();
    // Completed goal stays listed with its badge; goals without deadline show no pace line.
    expect(screen.getByTestId('goal-completed-2')).toHaveTextContent('Completada');
    expect(screen.queryByTestId('goal-deadline-2')).not.toBeInTheDocument();
  });

  it('renders the empty state when there are no goals', async () => {
    mockList([]);
    render(<GoalsPage />);
    expect(await screen.findByTestId('goals-empty')).toHaveTextContent('Aún no hay metas');
  });

  it('shows the fetch error with role=alert and Reintentar reloads', async () => {
    const listGoals = vi.spyOn(api, 'listGoals').mockRejectedValue(new Error('metas caídas'));
    const user = userEvent.setup();
    render(<GoalsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('metas caídas');
    expect(screen.queryByTestId('goals-empty')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('retry-goals'));
    await waitFor(() => expect(listGoals).toHaveBeenCalledTimes(2));
  });

  it('creates a goal through the API with minor units (es-AR decimal comma)', async () => {
    mockList([]);
    const createGoal = vi.spyOn(api, 'createGoal').mockResolvedValue(goalA);
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goals-empty');

    await user.type(screen.getByTestId('goal-name'), 'Viaje');
    await user.type(screen.getByTestId('goal-target'), '1000,50');
    await user.click(screen.getByTestId('goal-submit'));

    expect(createGoal).toHaveBeenCalledWith({ name: 'Viaje', targetMinor: 100050, currency: 'ARS', deadline: null });
  });

  it('rejects an empty create with a validation error and does not call the API', async () => {
    mockList([]);
    const createGoal = vi.spyOn(api, 'createGoal').mockResolvedValue(goalA);
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goals-empty');

    await user.click(screen.getByTestId('goal-submit'));

    expect(await screen.findByRole('alert')).toHaveTextContent('El nombre es obligatorio.');
    expect(createGoal).not.toHaveBeenCalled();
  });

  it('registers an aporte with the goal amount and reloads the list', async () => {
    mockList();
    const adjust = vi.spyOn(api, 'addGoalAdjustment').mockResolvedValue({ id: 7, goalId: 1, amountMinor: 50000, createdAt: '' });
    const listGoals = vi.spyOn(api, 'listGoals').mockResolvedValue([goalA, goalB]);
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    await user.type(screen.getByTestId('goal-amount-1'), '500');
    await user.click(screen.getByTestId('goal-aporte-1'));

    expect(adjust).toHaveBeenCalledWith(1, { kind: 'aporte', amountMinor: 50000 });
    await waitFor(() => expect(listGoals).toHaveBeenCalledTimes(2));
  });

  it('registers a retiro and rejects a non-positive amount without calling the API', async () => {
    mockList();
    const adjust = vi.spyOn(api, 'addGoalAdjustment').mockResolvedValue({ id: 8, goalId: 1, amountMinor: -1000, createdAt: '' });
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    await user.click(screen.getByTestId('goal-retiro-1'));
    expect(await screen.findByRole('alert')).toHaveTextContent('El monto debe ser un número positivo.');
    expect(adjust).not.toHaveBeenCalled();

    await user.type(screen.getByTestId('goal-amount-1'), '10');
    await user.click(screen.getByTestId('goal-retiro-1'));
    expect(adjust).toHaveBeenCalledWith(1, { kind: 'retiro', amountMinor: 1000 });
  });

  it('reorders with Subir/Bajar by sending the swapped id array', async () => {
    mockList();
    const reorder = vi.spyOn(api, 'reorderGoals').mockResolvedValue([goalB, goalA]);
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    // First goal cannot go up; lowering it swaps the two ids.
    expect(screen.getByTestId('goal-up-1')).toBeDisabled();
    await user.click(screen.getByTestId('goal-down-1'));
    expect(reorder).toHaveBeenCalledWith([2, 1]);
  });

  it('edits a goal name through the inline form', async () => {
    mockList();
    const updateGoal = vi.spyOn(api, 'updateGoal').mockResolvedValue({ ...goalA, name: 'Viaje 2027' });
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    await user.click(screen.getByTestId('goal-edit-1'));
    const card = screen.getByTestId('goal-1');
    const nameInput = within(card).getByTestId('goal-name');
    expect(nameInput).toHaveValue('Viaje');
    await user.clear(nameInput);
    await user.type(nameInput, 'Viaje 2027');
    await user.click(within(card).getByTestId('goal-submit'));

    expect(updateGoal).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: 'Viaje 2027', targetMinor: 100000, currency: 'ARS', deadline: '2026-10-15' }),
    );
  });

  it('deletes a goal only after confirming', async () => {
    mockList();
    const deleteGoal = vi.spyOn(api, 'deleteGoal').mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<GoalsPage />);
    await screen.findByTestId('goal-1');

    await user.click(screen.getByTestId('goal-delete-1'));
    expect(deleteGoal).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('goal-confirm-delete-1'));
    expect(deleteGoal).toHaveBeenCalledWith(1);
  });
});
