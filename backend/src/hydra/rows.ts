import type { HydraValue } from "./client";

export function unwrapHydraValue(
  value: HydraValue | undefined,
): unknown {
  return value?.value;
}

export function cleanHydraRows<T>(
  columns: string[],
  rows: HydraValue[][],
): T[] {
  return rows.map((row) => {
    const result: Record<string, unknown> = {};

    columns.forEach((column, index) => {
      result[column] = unwrapHydraValue(row[index]);
    });

    return result as T;
  });
}