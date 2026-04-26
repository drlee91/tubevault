const ONE_HOUR_MS = 60 * 60 * 1000;

export function backoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  const computed = 1000 * Math.pow(4, attempts - 1);
  return Math.min(computed, ONE_HOUR_MS);
}
