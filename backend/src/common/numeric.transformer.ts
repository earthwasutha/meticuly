import type { ValueTransformer } from 'typeorm';

/** Postgres returns NUMERIC columns as strings; expose them as JS numbers. */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/** Round to 3 decimals to keep quantity arithmetic stable (matches NUMERIC(14,3)). */
export const round3 = (value: number) => Math.round(value * 1000) / 1000;
