import { isArDateString, PeriodKey, ValidationError } from '@finanzas/domain';
import type { CreateTransactionInput, Transaction, TransactionPatch, TransactionService } from '@finanzas/domain';
import { Router } from 'express';
import { wrap } from '../errors';

export interface TransactionsRouterDeps {
  transactionService: TransactionService;
}

/** API shape: the transaction date field is `date` (design API contract). */
export interface ApiTransaction {
  id: number;
  direction: string;
  amountMinor: number;
  currency: string;
  rate: number;
  date: string;
  categoryId: number;
  note: string;
}

export function toApiTransaction(tx: Transaction): ApiTransaction {
  return {
    id: tx.id as number,
    direction: tx.direction,
    amountMinor: tx.amountMinor,
    currency: tx.currency,
    rate: tx.rate,
    date: tx.txDate,
    categoryId: tx.categoryId,
    note: tx.note,
  };
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0)
    throw new ValidationError('Invalid transaction id', ['id must be a positive integer'], 'INVALID_TRANSACTION_ID');
  return id;
}

function toCreateInput(body: Record<string, unknown>): CreateTransactionInput {
  const date = typeof body.date === 'string' ? body.date : undefined;
  return {
    direction: body.direction as CreateTransactionInput['direction'],
    amountMinor: body.amountMinor as number,
    currency: body.currency as string,
    rate: body.rate as number | undefined,
    txDate: date as string,
    categoryId: body.categoryId as number,
    note: body.note as string | undefined,
  };
}

export function transactionsRouter(deps: TransactionsRouterDeps): Router {
  const router = Router();
  const { transactionService } = deps;

  router.post('/transactions',
    wrap(async (req, res) => {
      const tx = await transactionService.create(toCreateInput(req.body as Record<string, unknown>));
      res.status(201).json(toApiTransaction(tx));
    }),
  );

  router.get('/transactions',
    wrap(async (req, res) => {
      const q = req.query as Record<string, string | undefined>;
      let from: Date | undefined;
      let to: Date | undefined;
      if (q.month !== undefined) {
        const bounds = PeriodKey.parse('month', q.month).bounds();
        from = bounds.start;
        to = bounds.end;
      } else if (q.from !== undefined || q.to !== undefined) {
        if (!q.from || !q.to || !isArDateString(q.from) || !isArDateString(q.to)) {
          throw new ValidationError(
            'Invalid date range',
            ['from and to must be valid YYYY-MM-DD dates and provided together'],
            'INVALID_DATE_RANGE',
          );
        }
        from = new Date(`${q.from}T00:00:00Z`);
        to = new Date(`${q.to}T00:00:00Z`);
      }
      // Note: `from`/`to` query params are inclusive day boundaries (ET-3),
      // while `month` uses exact AR-tz bounds.
      const txList = await transactionService.list({
        from,
        to,
        categoryId: q.categoryId !== undefined ? Number(q.categoryId) : undefined,
        direction: q.direction as 'expense' | 'income' | undefined,
      });
      res.json(txList.map(toApiTransaction));
    }),
  );

  router.patch('/transactions/:id',
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      // The domain owns patch semantics: whitelist, merge over the stored row
      // and the W1 invariant (a non-ARS currency change requires a rate).
      const tx = await transactionService.update(id, req.body as TransactionPatch);
      res.json(toApiTransaction(tx));
    }),
  );

  router.delete('/transactions/:id',
    wrap(async (req, res) => {
      await transactionService.remove(parseId(req.params.id));
      res.status(204).end();
    }),
  );

  return router;
}
