import type { Client } from '@libsql/client';
import { Goal, GoalAdjustment } from '@finanzas/domain';
import type { GoalAdjustmentRepository, GoalRepository } from '@finanzas/domain';

import { toObject } from './row';

interface GoalRow {
  id: number;
  name: string;
  target_minor: number;
  currency: string;
  deadline: string | null;
  created_at: string;
  priority: number;
}

interface GoalAdjustmentRow {
  id: number;
  goal_id: number;
  amount_minor: number;
  created_at: string;
}

function toGoal(row: GoalRow): Goal {
  return new Goal({
    id: row.id,
    name: row.name,
    targetMinor: row.target_minor,
    currency: row.currency,
    deadline: row.deadline,
    createdAt: row.created_at,
    priority: row.priority,
  });
}

function toAdjustment(row: GoalAdjustmentRow): GoalAdjustment {
  return new GoalAdjustment({
    id: row.id,
    goalId: row.goal_id,
    amountMinor: row.amount_minor,
    createdAt: row.created_at,
  });
}

/** SQLite savings-goal store; reads come back in waterfall order (priority, creation, id). */
export class SqliteGoalRepository implements GoalRepository {
  constructor(private db: Client) {}

  async create(goal: Goal): Promise<Goal> {
    const result = await this.db.execute({
      sql: `INSERT INTO goals (name, target_minor, currency, deadline, created_at, priority)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [goal.name, goal.targetMinor, goal.currency, goal.deadline, goal.createdAt, goal.priority],
    });
    return new Goal({ ...goal, id: Number(result.lastInsertRowid) });
  }

  async update(id: number, goal: Goal): Promise<Goal | null> {
    const result = await this.db.execute({
      sql: `UPDATE goals SET name = ?, target_minor = ?, currency = ?, deadline = ?, created_at = ?, priority = ?
            WHERE id = ?`,
      args: [goal.name, goal.targetMinor, goal.currency, goal.deadline, goal.createdAt, goal.priority, id],
    });
    if (result.rowsAffected === 0) return null;
    return new Goal({ ...goal, id });
  }

  async findById(id: number): Promise<Goal | null> {
    const result = await this.db.execute({ sql: 'SELECT * FROM goals WHERE id = ?', args: [id] });
    const row = result.rows[0] ? toObject(result.rows[0], result.columns) : undefined;
    return row ? toGoal(row as unknown as GoalRow) : null;
  }

  async listAll(): Promise<Goal[]> {
    const result = await this.db.execute('SELECT * FROM goals ORDER BY priority, created_at, id');
    return result.rows.map((row) => toGoal(toObject(row, result.columns) as unknown as GoalRow));
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.execute({ sql: 'DELETE FROM goals WHERE id = ?', args: [id] });
    return result.rowsAffected > 0;
  }
}

/** SQLite manual-movement store for savings goals. */
export class SqliteGoalAdjustmentRepository implements GoalAdjustmentRepository {
  constructor(private db: Client) {}

  async create(adj: GoalAdjustment): Promise<GoalAdjustment> {
    const result = await this.db.execute({
      sql: 'INSERT INTO goal_adjustments (goal_id, amount_minor, created_at) VALUES (?, ?, ?)',
      args: [adj.goalId, adj.amountMinor, adj.createdAt],
    });
    return new GoalAdjustment({ ...adj, id: Number(result.lastInsertRowid) });
  }

  async listAll(): Promise<GoalAdjustment[]> {
    const result = await this.db.execute('SELECT * FROM goal_adjustments ORDER BY created_at, id');
    return result.rows.map((row) => toAdjustment(toObject(row, result.columns) as unknown as GoalAdjustmentRow));
  }

  async deleteByGoal(goalId: number): Promise<void> {
    await this.db.execute({ sql: 'DELETE FROM goal_adjustments WHERE goal_id = ?', args: [goalId] });
  }
}
