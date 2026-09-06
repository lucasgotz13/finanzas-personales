import type { Row } from '@libsql/client';

/** Map a positional result row to an object keyed by the result columns. */
export function toObject(row: Row, columns: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) {
    obj[columns[i]] = row[i];
  }
  return obj;
}
