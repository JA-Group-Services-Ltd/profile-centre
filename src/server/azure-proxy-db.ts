// REMOVED — Azure SQL proxy has been fully replaced by Airo SQLite.
// Stubs kept to satisfy TypeScript imports in azure-schema.ts.
export async function rawExecute(_sql: string, _params?: unknown[]): Promise<void> {}
export async function rawQuery<T = unknown>(_sql: string, _params?: unknown[]): Promise<T[]> { return []; }
export const execute = rawExecute;
export default { execute: rawExecute, rawExecute, rawQuery };
